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

    const incoming = await prisma.partner.findMany({
      where: { connectionUserId: userId, status: 'accepted', shareProgress: true },
      select: { id: true, userId: true, name: true, email: true },
    })

    const sharedWithMe = []
    for (const p of incoming) {
      const tasks = await prisma.task.findMany({
        where: { userId: p.userId, date: { gte: dayStart, lt: dayEnd } },
        select: { completed: true },
      })
      sharedWithMe.push({
        id: p.id,
        name: p.name,
        email: p.email,
        tasksTotal: tasks.length,
        tasksDone: tasks.filter(t => t.completed).length,
      })
    }

    const outgoing = await prisma.partner.findMany({
      where: { userId, status: 'accepted', shareProgress: true },
      select: { name: true, email: true },
    })

    return NextResponse.json({ success: true, sharedWithMe, iShareWith: outgoing })
  } catch (error) {
    console.error('Failed to load shared progress:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}