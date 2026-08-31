import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import {
  dueTaskNotifications,
  stampTaskNotification,
  TASK_SCAN_WINDOW_HOURS,
  type TaskNotificationKind,
} from '@/lib/taskNotifications'

/**
 * GET /api/tasks/due — the foreground ringer's feed.
 * Returns deed notifications due RIGHT NOW (10-min countdown heads-up,
 * very-important reminder alarm, starting-now cue) using the same one-shot
 * stamp logic the cron pusher uses.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      completed: false,
      startTime: {
        gte: new Date(now.getTime() - TASK_SCAN_WINDOW_HOURS * 60 * 60 * 1000),
        lte: new Date(now.getTime() + TASK_SCAN_WINDOW_HOURS * 60 * 60 * 1000),
      },
    },
  })

  const due = tasks.flatMap(t =>
    dueTaskNotifications(t, now).map(kind => ({
      taskId: t.id,
      kind,
      title: t.title,
      startTime: t.startTime,
      endTime: t.endTime,
      estimatedDuration: t.estimatedDuration,
      reminderMinutes: t.reminderMinutes,
      isImportant: t.isImportant,
      notifyDeed: t.notifyDeed,
      endWarnMinutes: t.endWarnMinutes,
    }))
  )

  return NextResponse.json({ due })
}

/** POST /api/tasks/due — stamp a notification as delivered (rung/dismissed). */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, kind } = (await req.json()) as { taskId?: string; kind?: TaskNotificationKind }
  if (!taskId || !kind || !['countdown', 'reminder', 'start', 'ending', 'finish'].includes(kind)) {
    return NextResponse.json({ error: 'taskId and a valid kind are required' }, { status: 400 })
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  await stampTaskNotification(taskId, kind)
  return NextResponse.json({ ok: true })
}