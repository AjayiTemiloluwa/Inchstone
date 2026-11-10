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

/** Each user's own main calendar. (A shared GOOGLE_CALENDAR_ID would point every user at one person's calendar.) */
function calendarId(): string {
  return 'primary'
}

/** The timezone deeds are written in. Repeating events need a named zone. */
export const TZ = process.env.APP_TIMEZONE || 'Africa/Lagos'

/** Weekday / day / month of an instant as seen in TZ (not the server's UTC). */
function zonedParts(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  )
  return { weekday: String(parts.weekday).slice(0, 2).toUpperCase(), day: Number(parts.day), month: Number(parts.month) }
}

/** Midnight of a calendar date (yyyy-MM-dd) in TZ, as an instant. */
function zonedMidnight(date: string): Date {
  const probe = new Date(`${date}T12:00:00Z`)
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value || 'GMT'
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/)
  const offsetMin = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - offsetMin * 60_000)
}

const statusOf = (e: unknown) => Number((e as { code?: number; status?: number; response?: { status?: number } })?.response?.status ?? (e as { code?: number }).code ?? (e as { status?: number }).status ?? 0)
const isGone = (e: unknown) => [404, 410].includes(statusOf(e))

/** Absolute base of the app, derived from the incoming request (works on Vercel + local dev). */
export function getRequestOrigin(req: Request): string {
  const proto = (req.headers.get('x-forwarded-proto') || 'http').split(',')[0].trim()
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
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim().replace(/\/+$/, '')
  // A localhost value copied from a dev .env must never be used on the live
  // site: Google would send the user back to their own machine.
  const configuredIsLocal = !!configured && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(configured)
  if (!isLocal && configured && !configuredIsLocal) return configured
  if (isLocal) return `${origin}/api/calendar/callback`
  // Public site: always the one production address (registered in Google
  // Cloud), even from a preview deployment.
  const fixed = (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/+$/, '')
  return `${fixed || origin.replace(/^http:\/\//i, 'https://')}/api/calendar/callback`
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
): Promise<{ connected: boolean; mode: GoogleSyncMode | null; lastSyncedAt: Date | null; needsReconnect?: boolean }> {
  const row = await prisma.userToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  })
  if (!row) return { connected: false, mode: null, lastSyncedAt: null }
  // Google revoked or expired the grant (e.g. an OAuth app in Testing mode
  // expires refresh tokens after 7 days): show "reconnect", not "connected".
  if (!row.accessToken) return { connected: false, needsReconnect: true, mode: row.syncMode === 'two' ? 'two' : 'pull', lastSyncedAt: row.lastSyncedAt }
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
    } catch (e) {
      const msg = String((e as { response?: { data?: { error?: string } } })?.response?.data?.error || (e as Error)?.message || '')
      if (/invalid_grant|unauthorized_client/i.test(msg)) {
        // The refresh token is dead: mark the connection so the user is asked to reconnect.
        await prisma.userToken.update({ where: { id: row.id }, data: { accessToken: '' } }).catch(() => {})
        console.warn('[gcal] Google grant expired or revoked for', userId)
        return null
      }
    }
  }

  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken ?? undefined,
    expiry_date: row.expiryDate?.getTime(),
  })
  // The library refreshes on its own when a call hits an expired token; keep what it gets.
  client.on('tokens', (t) => {
    if (!t.access_token) return
    void prisma.userToken.update({
      where: { id: row.id },
      data: {
        accessToken: t.access_token,
        expiryDate: t.expiry_date ? new Date(t.expiry_date) : null,
        ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
      },
    }).catch(() => {})
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

  // showDeleted is essential for deletion propagation: a deleted event arrives
  // here explicitly with status 'cancelled' (carrying its id), so the local
  // row can be removed no matter which window it was originally pulled into.
  // With the default (false) Google silently omits deletions and the app
  // calendar goes stale.
  const fetchedIds = new Set<string>()
  let liveCount = 0
  let pageToken: string | undefined

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      showDeleted: true,
      maxResults: 2500,
      orderBy: 'startTime',
      pageToken,
    })

    for (const ev of res.data.items || []) {
      if (!ev.id) continue

      fetchedIds.add(ev.id)

      // Explicit deletion → drop the local row wherever it lives (not just
      // inside this window). A cancelled recurring master also takes every
      // expanded occurrence the app pulled from it.
      if (ev.status === 'cancelled') {
        await prisma.event.deleteMany({
          where: { userId, type: 'google', googleEventId: ev.id },
        })
        if (!ev.recurringEventId && ev.recurrence?.length) {
          await prisma.event.deleteMany({
            where: { userId, type: 'google', recurringEventId: ev.id },
          })
        }
        continue
      }

      if (!ev.start?.dateTime && !ev.start?.date) continue

      const allDay = !!ev.start.date
      const rawStart = allDay ? zonedMidnight(ev.start.date!) : new Date(ev.start.dateTime!)
      let rawEnd: Date
      if (allDay) {
        // All-day end dates are exclusive; stop a minute before the next midnight.
        const e = ev.end?.date ? new Date(zonedMidnight(ev.end.date).getTime() - 60_000) : rawStart
        rawEnd = new Date(Math.max(e.getTime(), rawStart.getTime() + 30 * 60_000))
      } else {
        rawEnd = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(rawStart.getTime() + 60 * 60_000)
      }

      const data = {
        title: ev.summary || '(Untitled)',
        startTime: rawStart,
        endTime: rawEnd,
        type: 'google',
        recurringEventId: ev.recurringEventId || null,
      }
      // Two syncs can run at once (Day page + settings card): if both try to
      // create the row, the loser updates instead of failing the request.
      await prisma.event.upsert({
        where: { userId_googleEventId: { userId, googleEventId: ev.id } },
        create: {
          userId,
          title: ev.summary || '(Untitled)',
          startTime: rawStart,
          endTime: rawEnd,
          type: 'google',
          googleEventId: ev.id,
          recurringEventId: ev.recurringEventId || null,
        },
        update: data,
      }).catch(async (e: { code?: string }) => {
        if (e?.code !== 'P2002') throw e
        await prisma.event.update({ where: { userId_googleEventId: { userId, googleEventId: ev.id! } }, data })
      })
      liveCount++
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  // Deletions reconcile even when the window is now EMPTY on Google — no guard
  // on fetchedIds.size. (The old `if (fetchedIds.size > 0)` guard was the bug:
  // deleting the last event in a window made Google return an empty list, the
  // reconcile was skipped, and the app calendar kept the ghost forever.)
  // Rows without a googleEventId (manually imported) are never touched.
  await prisma.event.deleteMany({
    where: {
      userId,
      type: 'google',
      // Everything overlapping the window: Google returned all of those.
      startTime: { lt: timeMax },
      endTime: { gt: timeMin },
      ...(fetchedIds.size > 0
        ? { googleEventId: { notIn: [...fetchedIds] } }
        : { googleEventId: { not: null } }),
    },
  })

  await prisma.userToken.updateMany({
    where: { userId, provider: 'google' },
    data: { lastSyncedAt: new Date() },
  })

  return { count: liveCount }
}

/* ── Push (Inchstone → Google, two-way only) ───────────────────────── */

export interface GoogleSyncableTask {
  id: string
  title: string
  date: Date | string | null
  startTime: Date | string | null
  endTime: Date | string | null
  isHabit?: boolean
  isRecurring?: boolean
  recurrencePattern?: string | null
  recurrenceEnd?: Date | string | null
  googleEventId?: string | null
  googleRecurringEventId?: string | null
  goalId?: string | null
}

function asDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d
}

/** Inchstone recurrence pattern → Google RRULE (with UNTIL if bounded). */
export function taskToRRule(task: GoogleSyncableTask): string | null {
  if (!task.isRecurring || !task.recurrencePattern) return null
  const anchor = task.startTime ? asDate(task.startTime) : asDate(task.date!)
  const z = zonedParts(anchor)
  const weekday = z.weekday
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
      rule = `FREQ=MONTHLY;BYMONTHDAY=${z.day}`
      break
    case 'yearly':
      rule = `FREQ=YEARLY;BYMONTH=${z.month};BYMONTHDAY=${z.day}`
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
  const start = task.startTime ? asDate(task.startTime) : asDate(task.date!)
  const end = task.endTime ? asDate(task.endTime) : new Date(start.getTime() + 30 * 60_000)
  const rrule = taskToRRule(task)
  const payload: Record<string, unknown> = {
    summary: task.title,
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
    reminders: { useDefault: true },
    status: 'confirmed', // brings back an event that was deleted in Google
    source: { title: 'Inchstone', url: 'https://myinchstone.vercel.app' },
  }
  if (rrule) payload.recurrence = [rrule]
  return payload
}
/** A fixed Google id per deed (base32hex), so a repeated create can never duplicate it. */
const eventIdFor = (task: GoogleSyncableTask, kind: 'one' | 'series') => `ins${kind === 'series' ? 'r' : 'o'}${task.id.replace(/-/g, '').toLowerCase()}`

async function createGoogleEvent(userId: string, task: GoogleSyncableTask, kind: 'one' | 'series'): Promise<string | null> {
  const authed = await getAuthedCalendar(userId)
  if (!authed) return null
  const { calendar, calendarId } = authed
  const id = eventIdFor(task, kind)
  try {
    const res = await calendar.events.insert({ calendarId, requestBody: { id, ...buildEventPayload(task) } })
    return res.data.id || id
  } catch (e) {
    // Already created (a racing save, or re-creating after a delete): update it instead.
    if (statusOf(e) === 409) {
      await calendar.events.update({ calendarId, eventId: id, requestBody: buildEventPayload(task) })
      return id
    }
    throw e
  }
}

/** Patch the pushed event; if it was deleted in Google, create it again. Returns the live id. */
async function updateGoogleEvent(userId: string, eventId: string, task: GoogleSyncableTask, kind: 'one' | 'series'): Promise<string | null> {
  const authed = await getAuthedCalendar(userId)
  if (!authed) return eventId
  const { calendar, calendarId } = authed
  try {
    await calendar.events.patch({ calendarId, eventId, requestBody: buildEventPayload(task) })
    return eventId
  } catch (e) {
    if (isGone(e)) return createGoogleEvent(userId, task, kind)
    throw e
  }
}

async function deleteGoogleEvent(userId: string, eventId: string): Promise<void> {
  if (!eventId) return
  const authed = await getAuthedCalendar(userId)
  if (!authed) return
  const { calendar, calendarId } = authed
  await calendar.events.delete({ calendarId, eventId }).catch((e) => { if (!isGone(e)) throw e })
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
      await calendar.events.delete({ calendarId, eventId: instance.id }).catch((e) => { if (!isGone(e)) throw e })
    }
  } catch {
    /* series already gone — nothing to cancel */
  }
}

/**
 * Cut a pushed recurring series short at `fromDate` — that occurrence and
 * everything after it stops existing in Google, matching a "this and all
 * future" delete in Inchstone. Implemented as an UNTIL clamp on the master
 * event's RRULE (any pre-existing UNTIL is replaced).
 */
async function truncateRecurringSeries(
  userId: string,
  masterEventId: string,
  fromDate: Date,
): Promise<void> {
  if (!masterEventId) return
  const authed = await getAuthedCalendar(userId)
  if (!authed) return
  const { calendar, calendarId } = authed
  try {
    const { data } = await calendar.events.get({ calendarId, eventId: masterEventId })
    const rules = (data.recurrence || []).filter(rule => rule.toUpperCase().startsWith('RRULE'))
    if (rules.length === 0) return

    // UNTIL is inclusive, so stop one second before the first dropped occurrence.
    const until = new Date(fromDate.getTime() - 1000)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
    const truncated = rules.map(rule => {
      const base = rule
        .split(';')
        .filter(part => !part.toUpperCase().startsWith('UNTIL'))
        .join(';')
      return `${base};UNTIL=${until}`
    })

    await calendar.events.patch({
      calendarId,
      eventId: masterEventId,
      requestBody: { recurrence: truncated },
    })
  } catch {
    /* series already gone — nothing to truncate */
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
      // It became a series: its old one-off event goes.
      if (singleId) {
        await deleteGoogleEvent(userId, singleId)
        await prisma.task.update({ where: { id: task.id }, data: { googleEventId: null } }).catch(() => {})
      }
      // Only the origin (earliest occurrence) owns the master RRULE event. An
      // edit made from a later occurrence pushes the origin instead.
      const origin = await prisma.task.findFirst({
        where: { userId, title: task.title, isRecurring: true, isHabit: false, ...(task.goalId ? { goalId: task.goalId } : {}) },
        orderBy: { date: 'asc' },
      })
      if (!origin) return
      const series = origin.id === task.id ? task : (origin as unknown as GoogleSyncableTask)
      const seriesMaster = origin.googleRecurringEventId
      const live = seriesMaster ? await updateGoogleEvent(userId, seriesMaster, series, 'series') : await createGoogleEvent(userId, series, 'series')
      if (live && live !== seriesMaster) {
        await prisma.task.update({ where: { id: origin.id }, data: { googleRecurringEventId: live } })
      }
    } else {
      // It stopped repeating: its old series master goes.
      if (masterId) {
        await deleteGoogleEvent(userId, masterId)
        await prisma.task.update({ where: { id: task.id }, data: { googleRecurringEventId: null } }).catch(() => {})
      }
      const live = singleId ? await updateGoogleEvent(userId, singleId, task, 'one') : await createGoogleEvent(userId, task, 'one')
      if (live && live !== singleId) {
        await prisma.task.update({ where: { id: task.id }, data: { googleEventId: live } })
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
 *  · truncateFrom set → keep only the part of the series before that date
 *    (the master's RRULE is clamped with an UNTIL)
 *  · single-instance delete (origin or materialized instance) → cancel just
 *    that occurrence on the master event
 */
export async function deleteTaskFromGoogle(
  userId: string,
  task: GoogleSyncableTask,
  opts: { deleteAll?: boolean; truncateFrom?: Date | null; masterId?: string | null } = {},
): Promise<void> {
  try {
    // The caller looked the series id up before deleting rows locally (the
    // origin that holds it may already be gone).
    if (opts.masterId && !task.googleRecurringEventId) task = { ...task, googleRecurringEventId: opts.masterId }
    // One-shot deed → remove its single pushed event.
    if (task.googleEventId && !task.googleRecurringEventId) {
      await deleteGoogleEvent(userId, task.googleEventId)
    }

    // Origin of a pushed recurring series → deleteAll removes the whole
    // master event; truncateFrom keeps the earlier occurrences only; a
    // single-instance delete cancels just the clicked occurrence.
    if (task.googleRecurringEventId) {
      if (opts.deleteAll) {
        await deleteGoogleEvent(userId, task.googleRecurringEventId)
      } else if (opts.truncateFrom) {
        await truncateRecurringSeries(userId, task.googleRecurringEventId, opts.truncateFrom)
      } else if (task.startTime) {
        await deleteRecurringOccurrence(userId, task.googleRecurringEventId, new Date(task.startTime))
      }
    }

    // A materialized instance has no Google ids of its own — find the origin
    // task that owns the master event and act on that occurrence/series.
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
          ...(task.goalId ? { goalId: task.goalId } : {}),
          googleRecurringEventId: { not: null },
        },
        orderBy: { date: 'asc' },
      })
      if (origin?.googleRecurringEventId) {
        if (opts.deleteAll) {
          await deleteGoogleEvent(userId, origin.googleRecurringEventId)
        } else if (opts.truncateFrom) {
          await truncateRecurringSeries(userId, origin.googleRecurringEventId, opts.truncateFrom)
        } else {
          await deleteRecurringOccurrence(userId, origin.googleRecurringEventId, new Date(task.startTime))
        }
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