import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ALARM_RING_GRACE_MINUTES, computeNextFire, pushAlarmToUser } from '@/lib/alarmScheduler'
import {
  buildTaskPayload,
  dueTaskNotifications,
  pushTaskToUser,
  stampTaskNotification,
  TASK_SCAN_WINDOW_HOURS,
} from '@/lib/taskNotifications'

/**
 * GET /api/cron/alarms — alarm dispatcher, plan-agnostic.
 *
 * Vercel Hobby only allows daily crons, so vercel.json no longer declares
 * one. Point any external every-minute scheduler (cron-job.org, Upstash
 * QStash, GitHub Actions, or a Pro-plan Vercel Cron) at this endpoint.
 * If CRON_SECRET is set, callers must send `Authorization: Bearer <secret>`
 * or `x-cron-secret: <secret>` (Vercel Cron sends the Bearer automatically).
 *
 * Pushes every due alarm (enabled, nextFire <= now) to its owner's devices,
 * then advances nextFire to the next occurrence.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const bearer = req.headers.get('authorization')
    const alt = req.headers.get('x-cron-secret')
    if (bearer !== `Bearer ${secret}` && alt !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const due = await prisma.alarm.findMany({
    where: { enabled: true, nextFire: { lte: now } },
  })

  const graceMs = ALARM_RING_GRACE_MINUTES * 60_000
  let sent = 0
  let skippedStale = 0
  for (const alarm of due) {
    // Same grace rule as the foreground ringer: an alarm whose moment passed
    // long ago (scheduler down, device off) is advanced silently — a push
    // hours late would be just as wrong as a ring hours late.
    const fireAt = alarm.nextFire ? alarm.nextFire.getTime() : null
    if (fireAt != null && now.getTime() - fireAt > graceMs) {
      skippedStale++
    } else {
      try {
        await pushAlarmToUser(alarm.userId, alarm)
        sent++
      } catch (e) {
        console.error('Alarm dispatch failed', alarm.id, e)
      }
    }
    await prisma.alarm.update({
      where: { id: alarm.id },
      data: {
        lastFired: now,
        nextFire: computeNextFire(alarm.time, alarm.days, now, alarm.tz),
      },
    })
  }

  // ── Task notifications (deeds with a schedule) ─────────────────────────
  // Countdown heads-up (every scheduled task), the very-important alarm and
  // the starting-now push. Same stamp logic as /api/tasks/due, so this cron
  // and the in-app ringer never double-fire.
  const scheduled = await prisma.task.findMany({
    where: {
      completed: false,
      startTime: {
        gte: new Date(now.getTime() - TASK_SCAN_WINDOW_HOURS * 60 * 60 * 1000),
        lte: new Date(now.getTime() + TASK_SCAN_WINDOW_HOURS * 60 * 60 * 1000),
      },
    },
  })

  let taskPushes = 0
  for (const t of scheduled) {
    for (const kind of dueTaskNotifications(t, now)) {
      try {
        await pushTaskToUser(t.userId, buildTaskPayload(t, kind))
        taskPushes++
      } catch (e) {
        console.error('Task notification dispatch failed', t.id, kind, e)
      }
      await stampTaskNotification(t.id, kind, now)
    }
  }

  return NextResponse.json({ ok: true, fired: sent, checked: due.length, skippedStale, taskPushes })
}