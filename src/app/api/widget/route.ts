import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

/*
 * /api/widget — data + config for the native home-screen widget app.
 *
 *  GET                → full bundle: today's deeds, next alarms, latest partner
 *                       messages, plans, plus the user's widget design.
 *  GET  ?pref=1       → widget design only (pages, rotation, toggles).
 *  PUT                → save the widget design (pages, rotateSeconds, toggles).
 *  POST ?rotate       → regenerate the widget secret ("unlink device").
 *  POST               → return the pairing secret (Settings → Widget shows it).
 *  DELETE             → reset the design to defaults.
 */

export type WidgetPage = {
  kind: 'plan' | 'timers' | 'tasks' | 'alarms' | 'messages' | 'clock' | 'note'
  note?: string // free-text page — the user's own line, fully styleable
  styles?: Record<string, { color?: string; size?: number; weight?: number }>
  bg?: string
  accent?: string
}

const DEFAULT_PAGES: WidgetPage[] = [
  { kind: 'plan', accent: '#B8935A' },
  { kind: 'clock', accent: '#B8935A' },
]

/**
 * Today, as the PHONE sees it. Task.date is UTC midnight of the day it belongs to, so "today" is the
 * phone's local date at UTC midnight. The app sends its time zone (?tz=Africa/Lagos); the server's own
 * clock (UTC on Vercel) would show yesterday's deeds for an hour after local midnight.
 */
function todayRange(tz: string): { start: Date; end: Date } {
  let ymd: string
  try {
    ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  }
  const start = new Date(`${ymd}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

const HEX = /^#[0-9a-fA-F]{6}$/
/** Only well-formed pages reach the phone (a bad colour would crash the native widget). */
function cleanPages(pages: unknown[]): WidgetPage[] {
  const kinds = ['plan', 'timers', 'tasks', 'alarms', 'messages', 'clock', 'note']
  return pages.slice(0, 10).flatMap((raw) => {
    const p = raw as WidgetPage
    if (!p || !kinds.includes(p.kind)) return []
    const out: WidgetPage = { kind: p.kind }
    if (p.kind === 'note') out.note = String(p.note ?? '').slice(0, 280)
    if (p.accent && HEX.test(p.accent)) out.accent = p.accent
    if (p.bg && HEX.test(p.bg)) out.bg = p.bg
    if (p.styles && typeof p.styles === 'object') {
      const styles: NonNullable<WidgetPage['styles']> = {}
      for (const [k, s] of Object.entries(p.styles)) {
        if (!['title', 'secondary', 'dayLabel', 'clock'].includes(k) || !s) continue
        const st: { color?: string; size?: number } = {}
        if (s.color && HEX.test(s.color)) st.color = s.color
        if (typeof s.size === 'number' && s.size >= 8 && s.size <= 48) st.size = s.size
        styles[k] = st
      }
      out.styles = styles
    }
    return [out]
  })
}

/**
 * The pages the phone shows: the design, minus what the Plan / Alarms / Partner messages switches turn
 * off. Plan covers the deed pages (plan, timers, tasks). Never empty: a clock is shown instead.
 */
function visiblePages(config: { pages: unknown; showPlan: boolean; showAlarms: boolean; showMessages: boolean }): WidgetPage[] {
  const pages = cleanPages(Array.isArray(config.pages) ? config.pages : []).filter((p) =>
    ['plan', 'timers', 'tasks'].includes(p.kind) ? config.showPlan
      : p.kind === 'alarms' ? config.showAlarms
        : p.kind === 'messages' ? config.showMessages
          : true)
  return pages.length ? pages : [{ kind: 'clock', accent: '#B8935A' }]
}

async function ensureConfig(userId: string) {
  const existing = await prisma.widgetConfig.findUnique({ where: { userId } })
  if (existing) return existing
  return prisma.widgetConfig.create({
    data: {
      userId,
      secret: randomBytes(24).toString('base64url'),
      pages: DEFAULT_PAGES as unknown as object[],
    },
  })
}

// Secret auth: the native widget app can't hold a Clerk session, so it
// presents the pairing secret. Returns the config's userId or null.
async function userIdFromSecret(secret: string): Promise<string | null> {
  const config = await prisma.widgetConfig.findUnique({ where: { secret } })
  return config?.userId ?? null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  let userId: string | null = null
  const secret = url.searchParams.get('secret')
  if (secret) {
    userId = await userIdFromSecret(secret)
    if (!userId) return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  } else {
    const clerk = await auth()
    userId = clerk.userId
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = await ensureConfig(userId)
  // Settings reads the design (and when the phone last synced); the secret stays out of it.
  if (url.searchParams.has('pref')) return NextResponse.json({ widget: { ...config, secret: undefined } })

  // The phone's time zone decides "today"; fall back to the user's scout zone, then Lagos.
  const tz = url.searchParams.get('tz') || (await prisma.scoutProfile.findUnique({ where: { userId }, select: { tz: true } }))?.tz || 'Africa/Lagos'

  // A paired phone is calling: note it, so Settings can show "Phone last synced …".
  if (secret) {
    await prisma.widgetConfig.update({ where: { userId }, data: { lastSyncAt: new Date(), lastSyncAgent: (url.searchParams.get('v') || req.headers.get('user-agent') || '').slice(0, 120) } }).catch(() => undefined)
  }

  // ?rev=1 → just the tasks revision (one cheap query), so the widget can poll often and only
  // download the full bundle when something actually changed.
  if (url.searchParams.has('rev')) {
    const r = todayRange(tz)
    const agg = await prisma.task.aggregate({ where: { userId, date: { gte: r.start, lt: r.end } }, _max: { updatedAt: true }, _count: true })
    return NextResponse.json({ rev: (agg._max.updatedAt?.getTime() ?? 0) + agg._count })
  }

  const { start, end } = todayRange(tz)
  const [todayTasks, activeItems, alarms, messages] = await Promise.all([
    prisma.task.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
      take: 24,
    }),
    prisma.item.findMany({
      where: { userId, status: 'active', layer: { in: [2, 3] } },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    prisma.alarm.findMany({
      where: { userId, enabled: true },
      orderBy: { nextFire: 'asc' },
      take: 6,
    }),
    prisma.nudge.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const nextUp =
    todayTasks.find((t) => !t.completed && t.startTime) || todayTasks.find((t) => !t.completed)

  return NextResponse.json({
    widget: {
      pages: visiblePages(config),
      rotateSeconds: config.rotateSeconds,
      showAlarms: config.showAlarms,
      showMessages: config.showMessages,
      showPlan: config.showPlan,
    },
    plan: {
      next: nextUp
        ? { title: nextUp.title, time: nextUp.startTime, progress: nextUp.progress, completed: nextUp.completed, isFrog: nextUp.isFrog }
        : null,
      deeds: todayTasks.map((t) => ({
        id: t.id, title: t.title, time: t.startTime, completed: t.completed, progress: t.progress, isFrog: t.isFrog,
      })),
      // Changes whenever a deed is added, edited, ticked or deleted, so the widget can tell at a glance
      // that what it shows is stale (see ?rev below).
      rev: todayTasks.reduce((m, t) => Math.max(m, t.updatedAt.getTime()), 0) + todayTasks.length,
      goals: activeItems.map((g) => ({ title: g.title, progress: g.progress })),
      dayProgress:
        todayTasks.length > 0
          ? Math.round(todayTasks.reduce((s, t) => s + (t.completed ? 100 : t.progress), 0) / todayTasks.length)
          : 0,
    },
    alarms: alarms.map((a) => ({ title: a.title, time: a.time, nextFire: a.nextFire, days: a.days })),
    messages: messages.map((m) => ({ from: m.senderId === userId ? 'You' : 'Partner', text: m.message, at: m.createdAt, read: m.read })),
    now: new Date().toISOString(),
  })
}

export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    pages?: WidgetPage[]
    rotateSeconds?: number
    showAlarms?: boolean
    showMessages?: boolean
    showPlan?: boolean
  }

  const data: Record<string, unknown> = {}
  if (Array.isArray(body.pages)) data.pages = cleanPages(body.pages) as unknown as object[]
  if (typeof body.rotateSeconds === 'number') data.rotateSeconds = Math.min(Math.max(body.rotateSeconds, 5), 120)
  if (typeof body.showAlarms === 'boolean') data.showAlarms = body.showAlarms
  if (typeof body.showMessages === 'boolean') data.showMessages = body.showMessages
  if (typeof body.showPlan === 'boolean') data.showPlan = body.showPlan

  await ensureConfig(userId)
  const config = await prisma.widgetConfig.update({ where: { userId }, data })
  const safe = { ...config, secret: undefined }
  return NextResponse.json({ widget: safe })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)

  if (url.searchParams.has('rotate')) {
    const secret = randomBytes(24).toString('base64url')
    await ensureConfig(userId)
    await prisma.widgetConfig.update({ where: { userId }, data: { secret } })
    return NextResponse.json({ secret })
  }

  const config = await ensureConfig(userId)
  return NextResponse.json({ secret: config.secret })
}

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureConfig(userId)
  await prisma.widgetConfig.update({
    where: { userId },
    data: {
      pages: DEFAULT_PAGES as unknown as object[],
      rotateSeconds: 15,
      showAlarms: true,
      showMessages: true,
      showPlan: true,
    },
  })
  return NextResponse.json({ ok: true })
}