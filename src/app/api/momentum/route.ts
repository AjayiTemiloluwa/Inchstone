import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import type { MomentumStats } from '@/lib/momentum'

/**
 * GET /api/momentum?today=yyyy-MM-dd — the numbers behind the Momentum chip:
 * deeds finished all-time (XP), today, yesterday and the best day of the last
 * 90 days. Days are the deeds' own calendar dates (stored as UTC midnights),
 * keyed by the caller's local "today".
 */
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const todayParam = new URL(req.url).searchParams.get('today')
  const today = todayParam && /^\d{4}-\d{2}-\d{2}$/.test(todayParam) ? todayParam : new Date().toISOString().slice(0, 10)
  const todayStart = new Date(`${today}T00:00:00.000Z`)
  const day = 86_400_000
  const since = new Date(todayStart.getTime() - 90 * day)

  const [total, perDay] = await Promise.all([
    prisma.task.count({ where: { userId, completed: true } }),
    prisma.task.groupBy({
      by: ['date'],
      where: { userId, completed: true, date: { gte: since, lt: new Date(todayStart.getTime() + day) } },
      _count: { _all: true },
    }),
  ])

  const counts = new Map<string, number>()
  for (const row of perDay) {
    if (!row.date) continue
    const key = row.date.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + row._count._all)
  }
  const yesterday = new Date(todayStart.getTime() - day).toISOString().slice(0, 10)
  const stats: MomentumStats = {
    total,
    today: counts.get(today) ?? 0,
    yesterday: counts.get(yesterday) ?? 0,
    // the record to beat: best of the earlier days, so today can break it
    bestDay: Math.max(0, ...[...counts].filter(([k]) => k !== today).map(([, n]) => n)),
  }
  return NextResponse.json(stats)
}
