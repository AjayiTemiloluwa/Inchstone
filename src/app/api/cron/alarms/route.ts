import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ALARM_RING_GRACE_MINUTES, computeNextFire, pushAlarmToUser } from '@/lib/alarmScheduler'
import { DEADLINE_CLOSED, dueReminders, reminderPayload, stampOffsets } from '@/lib/applications'
import { sendNotification } from '@/lib/pushNotifications'
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

  // ── Application deadline reminders (Challenge → Applications) ──────────
  // Each offset (1 week, 3 days, 1 day, 3 hours… before the deadline) fires
  // once; the stamp is shared with the in-app alarm so neither double-fires.
  const apps = await prisma.application.findMany({
    where: {
      archived: false,
      status: { notIn: [...DEADLINE_CLOSED] },
      deadline: { not: null, lte: new Date(now.getTime() + 15 * 86400000) },
    },
    select: { id: true, userId: true, title: true, organization: true, status: true, deadline: true, reminderOffsets: true, remindersSent: true },
  })
  let applicationPushes = 0
  for (const a of apps) {
    const { due: off, silent } = dueReminders(a, now)
    if (off === null && !silent.length) continue
    if (off !== null) {
      const subs = await prisma.pushSubscription.findMany({ where: { userId: a.userId } })
      for (const s of subs) {
        try {
          const ok = await sendNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, reminderPayload(a, off))
          if (ok) applicationPushes++
          else await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        } catch (e) {
          console.error('Application reminder failed', a.id, e)
        }
      }
    }
    await prisma.application
      .update({ where: { id: a.id }, data: { remindersSent: stampOffsets(a.remindersSent, off === null ? silent : [...silent, off]) } })
      .catch(() => {})
  }

  return NextResponse.json({ ok: true, fired: sent, checked: due.length, skippedStale, taskPushes, applicationPushes })
}