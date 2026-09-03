import { google } from 'googleapis'
import prisma from '@/lib/prisma'

/* ────────────────────────────────────────────────────────────────────────────
 * Google Calendar sync — single shared module.
 *
 * Modes:
 *   · "pull"  — Google events flow IN to Inchstone (Day timeline + Month calendar).
 *   · "two"    — pull, PLUS scheduled deeds push OUT to Google (one-shot =
 *                single event; repeating = one master RRULE event).
 *
 * Config comes from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
 * GOOGLE_CALENDAR_ID (.env.local), default calendar id "primary".
 * Tokens live in the existing UserToken row (provider: "google").
 * ──────────────────────────────────────────────────────────────────────────── */

export type GoogleSyncMode = 'pull' | 'two'

const SCOPES_PULL = ['https://www.googleapis.com/auth/calendar.readonly']
const SCOPES_TWO = ['https://www.googleapis.com/auth/calendar.events']

export function googleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  )
}

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || 'primary'
}

/** Absolute base of the app, derived from the incoming request (works on Vercel + local dev). */
export function getRequestOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    req.headers.get('host') ||
    'localhost:3000'
  return `${proto}://${host}`
}

export function getRedirectUri(req: Request): string {
  const origin = getRequestOrigin(req)
  // Local dev always derives from the request so the port always matches the
  // running server; non-local origins (production) honour an explicit
  // GOOGLE_REDIRECT_URI override when provided.
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (!isLocal && configured) return configured
  return `${origin}/api/calendar/callback`
}

function getOAuthClient(redirectUri?: string) {
  if (!googleConfigured()) throw new Error('Google OAuth is not configured')
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri,
  )
}

export function buildAuthUrl({ mode, state, redirectUri }: { mode: GoogleSyncMode; state: string; redirectUri: string }): string {
  const client = getOAuthClient(redirectUri)
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: mode === 'two' ? SCOPES_TWO : SCOPES_PULL,
    state,
  })
}

/* ── Tokens ─────────────────────────────────────────────────────────────── */

export async function mintTokens({
  userId, code, redirectUri, requestedMode,
}: {
  userId: string; code: string; redirectUri: string; requestedMode?: string | null
}): Promise<GoogleSyncMode> {
  const client = getOAuthClient(redirectUri)
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri })
  const scopes = Array.isArray(tokens.scope) ? tokens.scope.join(' ') : (tokens.scope || '')
  const grantedTwo = scopes.includes('calendar.events')
  // Honour the mode the user picked in the UI; fall back to whatever the
  // granted scopes actually cover (never claim two-way without write scope).
  const mode: GoogleSyncMode =
    requestedMode === 'two'
      ? (grantedTwo ? 'two' : 'pull')
      : requestedMode === 'pull'
        ? 'pull'
        : (grantedTwo ? 'two' : 'pull')

  if (!tokens.access_token) throw new Error('Google returned no access token')

  await prisma.userToken.upsert({
    where: { userId_provider: { userId, provider: 'google' } },
    create: {
      userId,
      provider: 'google',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes,
      syncMode: mode,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes,
      syncMode: mode,
    },
  })
  return mode
}

export async function getSyncState(
  userId: string,
): Promise<{ connected: boolean; mode: GoogleSyncMode | null; lastSyncedAt: Date | null }> {
  const row = await prisma.userToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  })
  if (!row) return { connected: false, mode: null, lastSyncedAt: null }
  return {
    connected: true,
    mode: row.syncMode === 'two' ? 'two' : 'pull',
    lastSyncedAt: row.lastSyncedAt,
  }
}

async function getAuthedCalendar(userId: string) {
  const row = await prisma.userToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  })
  if (!row?.accessToken) return null

  const client = getOAuthClient()

  // Refresh proactively when the access token is within 5 min of expiry.
  if (
    row.expiryDate &&
    row.refreshToken &&
    row.expiryDate.getTime() - Date.now() < 5 * 60_000
  ) {
    try {
      client.setCredentials({ refresh_token: row.refreshToken })
      const { credentials } = await client.refreshAccessToken()
      if (credentials.access_token) {
        await prisma.userToken.update({
          where: { id: row.id },
          data: {
            accessToken: credentials.access_token,
            expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            refreshToken: credentials.refresh_token ?? row.refreshToken,
          },
        })
        row.accessToken = credentials.access_token
        row.expiryDate = credentials.expiry_date ? new Date(credentials.expiry_date) : null
        row.refreshToken = credentials.refresh_token ?? row.refreshToken
      }
    } catch {
      /* the API call will surface the real auth error */
    }
  }

  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken ?? undefined,
  })

  const calendar = google.calendar({ version: 'v3', auth: client })
  return { calendar, calendarId: calendarId() }
}

/* ── Pull (Google → Inchstone, both modes) ─────────────────────────── */

export interface GoogleEventLike {
  id?: string
  summary?: string
  start?: { dateTime?: string | null; date?: string | null }
  end?: { dateTime?: string | null; date?: string | null }
  recurringEventId?: string | null
}

export async function syncGoogleEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<{ count: number }> {
  const authed = await getAuthedCalendar(userId)

  if (!authed) return { count: 0 }
  const { calendar, calendarId } = authed

  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    maxResults: 2500,
    orderBy: 'startTime',
  })

  const items = (res.data.items || []).filter(
    (e): e is NonNullable<typeof e> => !!e.id && !!(e.start?.dateTime || e.start?.date),
  )
  const fetchedIds = new Set<string>()

  for (const ev of items) {
    fetchedIds.add(ev.id!)

    const allDay = !!ev.start?.date
    const rawStart = allDay ? new Date(`${ev.start!.date!}T00:00:00`) : new Date(ev.start!.dateTime!)
    let rawEnd: Date
    if (allDay) {
      const e = ev.end?.date ? new Date(`${ev.end.date}T00:00:00`) : rawStart
      rawEnd = new Date(Math.max(e.getTime(), rawStart.getTime() + 30 * 60_000))
    } else {
      rawEnd = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(rawStart.getTime() + 60 * 60_000)
    }

    await prisma.event.upsert({
      where: { userId_googleEventId: { userId, googleEventId: ev.id! } },
      create: {
        userId,
        title: ev.summary || '(Untitled)',
        startTime: rawStart,
        endTime: rawEnd,
        type: 'google',
        googleEventId: ev.id!,
        recurringEventId: ev.recurringEventId || null,
      },
      update: {
        title: ev.summary || '(Untitled)',
        startTime: rawStart,
        endTime: rawEnd,
        type: 'google',
        recurringEventId: ev.recurringEventId || null,
      },
    })
  }

  // Deletions propagate: drop local google rows in the window Google no longer returns.

  if (fetchedIds.size > 0) {

    await prisma.event.deleteMany({
      where: {
        userId,
        type: 'google',
        startTime: { gte: timeMin },
        endTime: { lte: timeMax },
        googleEventId: { notIn: [...fetchedIds] },
      },
    })
  }

  await prisma.userToken.updateMany({
    where: { userId, provider: 'google' },
    data: { lastSyncedAt: new Date() },
  })

  return { count: items.length }
}

/* ── Push (Inchstone → Google, two-way only) ───────────────────────── */

export interface GoogleSyncableTask {
  id: string
  title: string
  date: Date | string
  startTime: Date | string | null
  endTime: Date | string | null
  isHabit?: boolean
  isRecurring?: boolean
  recurrencePattern?: string | null
  recurrenceEnd?: Date | string | null
  googleEventId?: string | null
  googleRecurringEventId?: string | null
}

function asDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d
}

/** Inchstone recurrence pattern → Google RRULE (with UNTIL if bounded). */
export function taskToRRule(task: GoogleSyncableTask): string | null {
  if (!task.isRecurring || !task.recurrencePattern) return null
  const anchor = task.startTime ? asDate(task.startTime) : asDate(task.date)
  const weekday = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][anchor.getDay()]
  let rule = ''
  switch (task.recurrencePattern) {
    case 'daily':
      rule = 'FREQ=DAILY'
      break
    case 'weekly':
      rule = `FREQ=WEEKLY;BYDAY=${weekday}`
      break
    case 'biweekly':
      rule = `FREQ=WEEKLY;INTERVAL=2;BYDAY=${weekday}`
      break
    case 'monthly':
      rule = `FREQ=MONTHLY;BYMONTHDAY=${anchor.getDate()}`
      break
    case 'yearly':
      rule = `FREQ=YEARLY;BYMONTH=${anchor.getMonth() + 1};BYMONTHDAY=${anchor.getDate()}`
      break
    case 'weekdays':
      rule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
      break
    default:
      return null
  }
  if (task.recurrenceEnd) {
    const until = asDate(task.recurrenceEnd)
    rule += `;UNTIL=${until.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
  }
  return rule
}

function buildEventPayload(task: GoogleSyncableTask): Record<string, unknown> {
  const start = task.startTime ? asDate(task.startTime) : asDate(task.date)
  const end = task.endTime ? asDate(task.endTime) : new Date(start.getTime() + 30 * 60_000)
  const rrule = taskToRRule(task)
  const payload: Record<string, unknown> = {
    summary: task.title,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: true },
  }
  if (rrule) payload.recurrence = [rrule]
  return payload
}
async function createGoogleEvent(userId: string, task: GoogleSyncableTask): Promise<string | null> {
  const authed = await getAuthedCalendar(userId)
  if (!authed) return null
  const { calendar, calendarId } = authed
  const res = await calendar.events.insert({
    calendarId,
    requestBody: buildEventPayload(task),
  })
  return res.data.id || null
}

async function updateGoogleEvent(userId: string, eventId: string, task: GoogleSyncableTask): Promise<void> {
  const authed = await getAuthedCalendar(userId)
  if (!authed) return
  const { calendar, calendarId } = authed
  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: buildEventPayload(task),
  })
}

async function deleteGoogleEvent(userId: string, eventId: string): Promise<void> {
  if (!eventId) return
  const authed = await getAuthedCalendar(userId)
  if (!authed) return
  const { calendar, calendarId } = authed
  await calendar.events.delete({ calendarId, eventId }).catch(() => {})
}

async function deleteRecurringOccurrence(
  userId: string,
  masterEventId: string,
  occurrenceStart: Date,
): Promise<void> {
  if (!masterEventId) return
  const authed = await getAuthedCalendar(userId)
  if (!authed) return
  const { calendar, calendarId } = authed
  try {
    const { data } = await calendar.events.instances({
      calendarId,
      eventId: masterEventId,
      // Narrow to the one occurrence we care about.
      timeMin: new Date(occurrenceStart.getTime() - 60_000).toISOString(),
      timeMax: new Date(occurrenceStart.getTime() + 60_000).toISOString(),
      maxResults: 10,
    })
    const instance = (data.items || []).find(inst => {
      const st = inst.start?.dateTime || inst.start?.date
      return !!st && new Date(st).getTime() === occurrenceStart.getTime()
    })
    if (instance?.id) {
      await calendar.events.delete({ calendarId, eventId: instance.id }).catch(() => {})
    }
  } catch {
    /* series already gone — nothing to cancel */
  }
}

/*
 * Keep a single task's Google representation in sync with Inchstone.
 *  · eligible (non-habit, scheduled) → create/update the pushed event
 *    (recurring = master RRULE event; one-shot = single event).
 *  · no longer eligible (unscheduled / habit / schedule removed) → remove any
 *    previously pushed event and clear the stored id.
 */

export async function pushTaskToGoogle(
  userId: string,
  task: GoogleSyncableTask,
): Promise<void> {
  try {
    const state = await getSyncState(userId)
    if (!(state.connected && state.mode === 'two')) return

    const masterId = task.googleRecurringEventId || null
    const singleId = task.googleEventId || null

    if (task.isHabit || !task.startTime || !task.endTime) {

      if (singleId) {

        await deleteGoogleEvent(userId, singleId)
        await prisma.task.update({
          where: { id: task.id },
          data: { googleEventId: null },
        })
      }
      if (masterId) {

        await deleteGoogleEvent(userId, masterId)
        await prisma.task.update({
          where: { id: task.id },
          data: { googleRecurringEventId: null },
        })
      }
      return


    }

    if (task.isRecurring) {
      // Only the origin (earliest instance of the series) owns the master
      // RRULE event — materialized instances must not create their own.
      const earliest = await prisma.task.findFirst({
        where: { userId, title: task.title, isRecurring: true, isHabit: false },
        orderBy: { date: 'asc' },
        select: { id: true },
      })
      if (earliest?.id !== task.id) return

      if (masterId) {

        await updateGoogleEvent(userId, masterId, task)
      } else {

        const created = await createGoogleEvent(userId, task)
        if (created) {

          await prisma.task.update({
            where: { id: task.id },
            data: { googleRecurringEventId: created },
          })
        }
      }
    } else {

      if (singleId) {

        await updateGoogleEvent(userId, singleId, task)
      } else {

        const created = await createGoogleEvent(userId, task)
        if (created) {

          await prisma.task.update({
            where: { id: task.id },
            data: { googleEventId: created },
          })
        }
      }
    }
  } catch (e) {
    // Fire-and-forget contract: sync failures must never break the deed request.



    console.error('[gcal] pushTaskToGoogle failed', e)
  }
}

/**
 * Remove a task's Google presence (used by DELETE /api/tasks/[id]).
 *  · one-shot deed → delete its single pushed event
 *  · origin of a recurring series + deleteAll → delete the master event
 *  · single-instance delete (origin or materialized instance) → cancel just
 *    that occurrence on the master event
 */
export async function deleteTaskFromGoogle(
  userId: string,
  task: GoogleSyncableTask,
  opts: { deleteAll?: boolean } = {},
): Promise<void> {
  try {
    // One-shot deed → remove its single pushed event.
    if (task.googleEventId && !task.googleRecurringEventId) {
      await deleteGoogleEvent(userId, task.googleEventId)
    }

    // Origin of a pushed recurring series → deleteAll removes the whole
    // master event; a single-instance delete only cancels that occurrence.
    if (task.googleRecurringEventId) {
      if (opts.deleteAll) {
        await deleteGoogleEvent(userId, task.googleRecurringEventId)
      } else if (task.startTime) {
        await deleteRecurringOccurrence(userId, task.googleRecurringEventId, new Date(task.startTime))
      }
    }

    // A materialized instance has no Google ids of its own — find the origin
    // task that owns the master event and cancel just that occurrence.
    if (
      !task.googleEventId &&
      !task.googleRecurringEventId &&
      task.isRecurring &&
      !task.isHabit &&
      task.startTime
    ) {
      const origin = await prisma.task.findFirst({
        where: {
          userId,
          isRecurring: true,
          isHabit: false,
          title: task.title,
          googleRecurringEventId: { not: null },
        },
        orderBy: { date: 'asc' },
      })
      if (origin?.googleRecurringEventId) {
        await deleteRecurringOccurrence(userId, origin.googleRecurringEventId, new Date(task.startTime))
      }
    }

    // Harmless if the row was already deleted (e.g. called after task.delete).
    await prisma.task.update({
      where: { id: task.id },
      data: {
        googleEventId: null,
        googleRecurringEventId: null,
      },
    }).catch(() => {})
  } catch (e) {
    console.error('[gcal] deleteTaskFromGoogle failed', e)
  }
}