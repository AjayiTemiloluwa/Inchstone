import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { bestStreak, both, currentStreak, lastDays, shiftDay } from '@/lib/streaks'

// GET  /api/checkins?today=yyyy-MM-dd — your streak, and for every linked
//      partner: whether they checked in today, their streak and your shared
//      ("together") streak, with the last 14 days for both.
// POST /api/checkins { day, mood?, note? } — check in for your day.
//
// A partner's check-ins are only visible through an accepted link between you.

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('today')
  const today = isDay(q) ? q : new Date().toISOString().slice(0, 10)
  const since = shiftDay(today, -400)

  const partners = await prisma.partner.findMany({
    where: { userId, status: 'accepted', connectionUserId: { not: null } },
    select: { id: true, name: true, connectionUserId: true },
  })
  const ids = [userId, ...partners.map((p) => p.connectionUserId!)]
  const rows = await prisma.checkIn.findMany({
    where: { userId: { in: ids }, day: { gte: since } },
    select: { userId: true, day: true, mood: true, note: true },
  })
  const byUser = new Map<string, Set<string>>()
  for (const r of rows) (byUser.get(r.userId) ?? byUser.set(r.userId, new Set()).get(r.userId)!).add(r.day)
  const mine = byUser.get(userId) ?? new Set<string>()
  const window = lastDays(today, 14)
  const todayRow = rows.find((r) => r.userId === userId && r.day === today)

  return NextResponse.json({
    today,
    me: {
      checkedIn: mine.has(today),
      mood: todayRow?.mood ?? null,
      note: todayRow?.note ?? null,
      streak: currentStreak(mine, today),
      best: bestStreak(mine),
      total: mine.size,
      days: window.map((d) => mine.has(d)),
    },
    partners: partners.map((p) => {
      const theirs = byUser.get(p.connectionUserId!) ?? new Set<string>()
      const together = both(mine, theirs)
      return {
        partnerId: p.id,
        name: p.name,
        checkedIn: theirs.has(today),
        streak: currentStreak(theirs, today),
        together: currentStreak(together, today),
        bestTogether: bestStreak(together),
        days: window.map((d) => theirs.has(d)),
      }
    }),
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!isDay(b.day)) return NextResponse.json({ error: 'day (yyyy-MM-dd) is required' }, { status: 400 })
  // Only today or yesterday (timezones differ; no back-filling streaks).
  const serverToday = new Date().toISOString().slice(0, 10)
  if (b.day < shiftDay(serverToday, -1) || b.day > shiftDay(serverToday, 1)) {
    return NextResponse.json({ error: 'You can only check in for today' }, { status: 400 })
  }
  const mood = Number.isInteger(b.mood) && b.mood >= 1 && b.mood <= 5 ? b.mood : null
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 280) : null
  const row = await prisma.checkIn.upsert({
    where: { userId_day: { userId, day: b.day } },
    create: { userId, day: b.day, mood, note },
    update: { mood, note },
  })
  return NextResponse.json({ checkIn: row })
}
