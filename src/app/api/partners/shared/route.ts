import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/partners/shared
 * Consent-gated progress feed:
 *  · sharedWithMe — partners who linked with me AND turned on "share progress"
 *  · iShareWith   — the partners who can currently see my progress
 * Sharing is always opt-in per partner; nothing leaks by default.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const weekStart = new Date(dayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const incoming = await prisma.partner.findMany({
      where: { connectionUserId: userId, status: 'accepted', shareProgress: true },
      select: { id: true, userId: true, name: true, email: true, shareWhat: true },
    })

    const sharedWithMe = []
    for (const p of incoming) {
      const scopes = new Set((p.shareWhat || 'deeds').split(',').filter(Boolean))
      const entry: Record<string, unknown> = {
        id: p.id,
        name: p.name,
        email: p.email,
        scopes: [...scopes],
      }
      if (scopes.has('deeds')) {
        const tasks = await prisma.task.findMany({
          where: { userId: p.userId, date: { gte: dayStart, lt: dayEnd } },
          select: { completed: true },
        })
        entry.tasksTotal = tasks.length
        entry.tasksDone = tasks.filter(t => t.completed).length
      }
      if (scopes.has('habits')) {
        const habits = await prisma.task.findMany({
          where: { userId: p.userId, isHabit: true, date: { gte: dayStart, lt: dayEnd } },
          select: { completed: true },
        })
        entry.habitsDone = habits.filter(h => h.completed).length
        entry.habitsTotal = habits.length
      }
      if (scopes.has('frog')) {
        const frog = await prisma.task.findFirst({
          where: { userId: p.userId, isFrog: true, date: { gte: dayStart, lt: dayEnd } },
          select: { completed: true },
        })
        entry.frogDone = frog ? frog.completed : null
      }
      if (scopes.has('week')) {
        const weekTasks = await prisma.task.findMany({
          where: { userId: p.userId, date: { gte: weekStart, lt: weekEnd } },
          select: { completed: true },
        })
        entry.weekTotal = weekTasks.length
        entry.weekDone = weekTasks.filter(t => t.completed).length
      }
      sharedWithMe.push(entry)
    }

    const outgoing = await prisma.partner.findMany({
      where: { userId, status: 'accepted', shareProgress: true },
      select: { name: true, email: true, shareWhat: true },
    })

    return NextResponse.json({ success: true, sharedWithMe, iShareWith: outgoing })
  } catch (error) {
    console.error('Failed to load shared progress:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}