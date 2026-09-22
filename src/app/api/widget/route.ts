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
  kind: 'plan' | 'alarms' | 'messages' | 'clock' | 'note'
  note?: string // free-text page — the user's own line, fully styleable
  styles?: Record<string, { color?: string; size?: number; weight?: number }>
  bg?: string
  accent?: string
}

const DEFAULT_PAGES: WidgetPage[] = [
  { kind: 'plan', accent: '#B8935A' },
  { kind: 'clock', accent: '#B8935A' },
]

function todayRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
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
  if (url.searchParams.has('pref')) return NextResponse.json({ widget: config })

  const { start, end } = todayRange()
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
      pages: config.pages,
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
        title: t.title, time: t.startTime, completed: t.completed, progress: t.progress, isFrog: t.isFrog,
      })),
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
  if (Array.isArray(body.pages)) data.pages = body.pages.slice(0, 10)
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