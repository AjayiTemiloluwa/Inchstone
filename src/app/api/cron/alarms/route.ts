import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ALARM_CATCH_UP_HOURS, ALARM_RING_GRACE_MINUTES, computeNextFire, pushAlarmToUser } from '@/lib/alarmScheduler'
import { logNotification } from '@/lib/notificationLog'
import { DEADLINE_CLOSED, dueReminders, reminderPayload, stampOffsets } from '@/lib/applications'
import { sendNotification } from '@/lib/pushNotifications'
import {
  buildTaskPayload,
  dueTaskNotifications,
  isLate,
  MISSED_DIGEST_THRESHOLD,
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
    // Within the grace window it is a live alarm. Past it but still the same day
    // (ALARM_CATCH_UP_HOURS) it is rolled back as a "Missed alarm" push; older is advanced silently.
    const fireAt = alarm.nextFire ? alarm.nextFire.getTime() : null
    const overdueMs = fireAt != null ? now.getTime() - fireAt : 0
    if (overdueMs > ALARM_CATCH_UP_HOURS * 3_600_000) {
      skippedStale++
    } else {
      try {
        await pushAlarmToUser(alarm.userId, alarm, { late: overdueMs > graceMs })
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
  // Missed deeds (start/reminder that passed while the scheduler or phone was down) are rolled back
  // per user; a long backlog collapses into one digest so a phone coming back online is not spammed.
  const missed = new Map<string, { t: (typeof scheduled)[number]; kind: 'start' | 'reminder' }[]>()
  for (const t of scheduled) {
    for (const kind of dueTaskNotifications(t, now, { catchUp: true })) {
      if (isLate(t, kind, now)) {
        const list = missed.get(t.userId) ?? []
        // One missed line per deed even if both its reminder and start slipped.
        if (!list.some((m) => m.t.id === t.id)) list.push({ t, kind: kind as 'start' | 'reminder' })
        missed.set(t.userId, list)
        await stampTaskNotification(t.id, kind, now)
        continue
      }
      try {
        await pushTaskToUser(t.userId, buildTaskPayload(t, kind, now), kind)
        taskPushes++
      } catch (e) {
        console.error('Task notification dispatch failed', t.id, kind, e)
      }
      await stampTaskNotification(t.id, kind, now)
    }
  }
  for (const [userId, list] of missed) {
    try {
      if (list.length >= MISSED_DIGEST_THRESHOLD) {
        const names = list.slice(0, 3).map((m) => m.t.title).join(', ')
        await pushTaskToUser(userId, {
          title: `🕘 You missed ${list.length} deeds today`,
          body: `${names}${list.length > 3 ? ` and ${list.length - 3} more` : ''}. Tap to catch up.`,
          url: '/dashboard',
          tag: 'missed-digest',
          late: true,
        } as unknown as ReturnType<typeof buildTaskPayload>, 'missed-digest')
        taskPushes++
      } else {
        for (const m of list) {
          await pushTaskToUser(userId, buildTaskPayload(m.t, m.kind, now), m.kind)
          taskPushes++
        }
      }
    } catch (e) {
      console.error('Missed-deed catch-up failed', userId, e)
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
      const rp = reminderPayload(a, off)
      await logNotification(a.userId, { kind: 'application', title: rp.title, body: rp.body, url: rp.url })
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