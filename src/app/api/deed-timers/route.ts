import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { taskEndTime } from '@/lib/taskNotifications'

/**
 * GET /api/deed-timers — the pinned-countdown feed.
 *
 * Returns today's scheduled, opt-in (notifyDeed) deeds that have a time, so
 * the client can pin a LIVE countdown to the notification bar for each one
 * (updated in-place via the service worker) and fire the light "finished"
 * alarm the moment the end time passes.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      notifyDeed: true,
      completed: false,
      startTime: { not: null },
      date: { gte: startOfToday, lt: endOfToday },
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      estimatedDuration: true,
      isImportant: true,
      color: true,
      finishNotifiedAt: true,
    },
    orderBy: { startTime: 'asc' },
  })

  const timers = tasks
    .map(t => {
      const end = taskEndTime(t)
      return {
        taskId: t.id,
        title: t.title,
        startTime: t.startTime,
        endTime: t.endTime,
        estimatedEnd: end ? new Date(end).toISOString() : null,
        isImportant: t.isImportant,
        color: t.color,
      }
    })
    .filter(t => t.estimatedEnd != null)

  return NextResponse.json({ timers })
}