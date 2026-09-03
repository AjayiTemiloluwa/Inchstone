import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { getSyncState, pushTaskToGoogle } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

/**
 * Two-way only: when the user enables two-way sync, push their already-scheduled
 * deeds (next {days} days) out to Google so existing deeds appear too —
 * not just deeds created after enabling.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const state = await getSyncState(userId)
    if (!(state.connected && state.mode === 'two')) {
      return NextResponse.json({ error: 'Two-way sync is not active' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    const days = Math.min(365, Math.max(1, Number(body?.days) || 60))

    const now = new Date()
    const horizon = new Date(now.getTime() + days * 86_400_000)

    const candidates = await prisma.task.findMany({
      where: {
        userId,
        isHabit: false,
        startTime: { gte: now },
        endTime: { not: null },
        // Not yet pushed: neither Google id set.
        AND: [{ googleEventId: null }, { googleRecurringEventId: null }],
      },
      take: 250,
    })

    // Only the origin (earliest instance) of a recurring series may push —
    // materialized instances must not create their own Google events.
    const tasks: typeof candidates = []
    for (const t of candidates) {
      if (t.isRecurring) {
        const earliest = await prisma.task.findFirst({
          where: { userId, title: t.title, isRecurring: true, isHabit: false },
          orderBy: { date: 'asc' },
          select: { id: true },
        })
        if (earliest?.id !== t.id) continue
      }
      tasks.push(t)
    }

    let pushed = 0
    for (const task of tasks) {
      const before = !!(task.googleEventId || task.googleRecurringEventId)
      await pushTaskToGoogle(userId, task)

      const fresh = await prisma.task.findUnique({
        where: { id: task.id },
        select: { googleEventId: true, googleRecurringEventId: true },
      })
      const after = !!(fresh?.googleEventId || fresh?.googleRecurringEventId)
      if (!before && after) pushed++
    }

    return NextResponse.json({ ok: true, pushed, scanned: tasks.length, horizon })
  } catch (error) {
    console.error('Failed to backfill calendar sync', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}