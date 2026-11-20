import prisma from '@/lib/prisma'
import { buildTaskPayload, taskEndTime, type SchedulableTask } from '@/lib/taskNotifications'
import { DEADLINE_CLOSED, parseOffsets, reminderPayload } from '@/lib/applications'

/**
 * The phone's own schedule — what the Android companion app (widget-app/)
 * needs to notify you with Inchstone CLOSED, without waiting on the server.
 *
 * Why: web push depends on a server job that should run every minute, but the
 * free schedulers run it every few hours. The phone app instead downloads the
 * next 36 hours of moments (deed starts, very-important reminders, alarms,
 * application deadlines) and sets its own exact alarms for them, plus one
 * always-on card in the notification bar with today's deeds and live status.
 *
 * While a phone app with this feature has synced recently, the server stops
 * sending its own copies of those notifications (see phoneAlertsOn), so you
 * never get the same thing twice.
 */

/** How far ahead the phone schedules. It re-syncs every ~15 min, so this is a generous buffer. */
export const PHONE_HORIZON_HOURS = 36

/** A phone that synced within this long is trusted to deliver the notifications itself. */
export const PHONE_FRESH_HOURS = 6

/** Phone app versions that schedule their own notifications ("widget-app 2.0" and later). */
export function isAlertingAgent(agent: string | null | undefined): boolean {
  const m = /^widget-app (\d+)\./.exec(agent ?? '')
  return !!m && Number(m[1]) >= 2
}

/** Is a paired phone currently delivering this user's deed / alarm / application notifications? */
export function phoneAlertsActive(cfg: { lastSyncAt: Date | null; lastSyncAgent: string | null } | null, now = new Date()): boolean {
  if (!cfg?.lastSyncAt || !isAlertingAgent(cfg.lastSyncAgent)) return false
  return now.getTime() - cfg.lastSyncAt.getTime() <= PHONE_FRESH_HOURS * 3_600_000
}

export async function phoneAlertsOn(userId: string, now = new Date()): Promise<boolean> {
  const cfg = await prisma.widgetConfig
    .findUnique({ where: { userId }, select: { lastSyncAt: true, lastSyncAgent: true } })
    .catch(() => null)
  return phoneAlertsActive(cfg, now)
}

export type PhoneAlertKind = 'start' | 'reminder' | 'alarm' | 'application'

export interface PhoneAlert {
  /** Stable id: the phone uses it to schedule, replace and cancel exactly one alarm per moment. */
  id: string
  kind: PhoneAlertKind
  at: string
  title: string
  body: string
  /** Path to open on tap. */
  url: string
  /** Ring like an alarm (very-important reminders, alarms, deadlines within 3 h). Otherwise one normal buzz. */
  loud: boolean
  taskId?: string
}

export interface PhoneDeed {
  id: string
  title: string
  start: string | null
  end: string | null
  completed: boolean
  important: boolean
}

type TaskRow = SchedulableTask & { completed: boolean }

/** Pure: the alerts for a set of deeds, alarms and applications, from `now` to the horizon. */
export function buildPhoneAlerts(
  input: {
    tasks: TaskRow[]
    alarms: { id: string; title: string; time: string; nextFire: Date | null }[]
    apps: { id: string; title: string; organization: string | null; status: string; deadline: Date | null; reminderOffsets: string; remindersSent: string }[]
  },
  now: Date,
  tz: string,
): PhoneAlert[] {
  const n = now.getTime()
  const to = n + PHONE_HORIZON_HOURS * 3_600_000
  const inWindow = (ms: number) => ms > n && ms <= to
  const out: PhoneAlert[] = []

  for (const t of input.tasks) {
    if (t.completed || !t.startTime) continue
    const start = new Date(t.startTime).getTime()
    // One buzz per deed, at its start. Before that the bar card already says "Up next".
    if (inWindow(start)) {
      const p = buildTaskPayload(t, 'start', new Date(start), tz)
      out.push({ id: `start-${t.id}-${start}`, kind: 'start', at: new Date(start).toISOString(), title: p.title, body: p.body, url: p.url, loud: false, taskId: t.id })
    }
    // The very-important alarm the user set on a deed.
    if (t.isImportant && t.reminderMinutes != null) {
      const at = start - t.reminderMinutes * 60_000
      if (inWindow(at)) {
        const p = buildTaskPayload(t, 'reminder', new Date(at), tz)
        out.push({ id: `reminder-${t.id}-${at}`, kind: 'reminder', at: new Date(at).toISOString(), title: p.title, body: p.body, url: p.url, loud: true, taskId: t.id })
      }
    }
  }

  for (const a of input.alarms) {
    const at = a.nextFire?.getTime()
    if (at == null || !inWindow(at)) continue
    out.push({ id: `alarm-${a.id}-${at}`, kind: 'alarm', at: new Date(at).toISOString(), title: '⏰ Alarm', body: `${a.title} — it's ${a.time}.`, url: '/dashboard', loud: true })
  }

  for (const a of input.apps) {
    if (!a.deadline || DEADLINE_CLOSED.has(a.status)) continue
    const sent = new Set(parseOffsets(a.remindersSent))
    for (const off of parseOffsets(a.reminderOffsets)) {
      if (sent.has(off)) continue
      const at = a.deadline.getTime() - off * 60_000
      if (!inWindow(at)) continue
      const p = reminderPayload(a, off)
      out.push({ id: `app-${a.id}-${off}`, kind: 'application', at: new Date(at).toISOString(), title: p.title, body: p.body, url: p.url, loud: off <= 180 })
    }
  }

  return out.sort((x, y) => x.at.localeCompare(y.at))
}

/** Everything the phone needs: today's deeds (for the bar card) and the alerts to schedule. */
export async function phoneSchedule(userId: string, tz: string, now = new Date()) {
  const from = new Date(now.getTime() - 18 * 3_600_000)
  const to = new Date(now.getTime() + PHONE_HORIZON_HOURS * 3_600_000)
  const [tasks, alarms, apps] = await Promise.all([
    prisma.task.findMany({
      where: { userId, startTime: { gte: from, lte: to } },
      orderBy: { startTime: 'asc' },
      take: 80,
    }),
    prisma.alarm.findMany({ where: { userId, enabled: true, nextFire: { gt: now, lte: to } }, take: 20 }),
    prisma.application.findMany({
      where: { userId, archived: false, deadline: { not: null, gt: now, lte: new Date(to.getTime() + 15 * 86_400_000) } },
      select: { id: true, title: true, organization: true, status: true, deadline: true, reminderOffsets: true, remindersSent: true },
    }),
  ])

  const deeds: PhoneDeed[] = tasks.map((t) => {
    const end = taskEndTime(t)
    return {
      id: t.id,
      title: t.title,
      start: t.startTime ? t.startTime.toISOString() : null,
      end: end != null ? new Date(end).toISOString() : null,
      completed: t.completed,
      important: t.isImportant,
    }
  })

  return { now: now.toISOString(), tz, deeds, alerts: buildPhoneAlerts({ tasks, alarms, apps }, now, tz) }
}
