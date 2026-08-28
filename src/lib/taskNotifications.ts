import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/pushNotifications'

/**
 * Task notification engine — the server-side half of deed reminders.
 *
 * Three one-shot notifications per scheduled task:
 *  · countdown — every scheduled task, "⏳ in 10 minutes" heads-up
 *  · reminder  — very-important tasks, user-chosen alarm lead before start
 *  · start     — every scheduled task, "▶ starting now"
 *
 * The `*NotifiedAt` stamps make each fire exactly once no matter how many
 * times the cron endpoint or the in-app ringer polls.
 */

export type TaskNotificationKind = 'countdown' | 'reminder' | 'start'

/** How long before startTime the every-task countdown push fires. */
export const COUNTDOWN_LEAD_MINUTES = 10

/** Grace window after startTime in which a late "start" push is still sent. */
export const START_PUSH_GRACE_MINUTES = 5

/** Cap the scan window so the cron never walks old history. */
export const TASK_SCAN_WINDOW_HOURS = 24

export interface SchedulableTask {
  id: string
  userId: string
  title: string
  date: Date | string
  startTime: Date | string | null
  endTime: Date | string | null
  isImportant: boolean
  reminderMinutes: number | null
  countdownNotifiedAt: Date | string | null
  reminderNotifiedAt: Date | string | null
  startNotifiedAt: Date | string | null
}

const MIN = 60_000

function ts(v: Date | string | null | undefined): number | null {
  if (!v) return null
  return new Date(v).getTime()
}

/** Absolute time (ms) the important-task alarm should ring — null if none. */
export function reminderTime(t: Pick<SchedulableTask, 'startTime' | 'reminderMinutes'>): number | null {
  const start = ts(t.startTime)
  if (start == null || t.reminderMinutes == null) return null
  return start - t.reminderMinutes * MIN
}

/** Which notifications does this task owe right now? */
export function dueTaskNotifications(
  t: SchedulableTask,
  now: Date = new Date()
): TaskNotificationKind[] {
  const start = ts(t.startTime)
  if (start == null) return []
  const n = now.getTime()
  const due: TaskNotificationKind[] = []

  // Pre-start countdown — every scheduled task, once.
  const cd = start - COUNTDOWN_LEAD_MINUTES * MIN
  if (!ts(t.countdownNotifiedAt) && n >= cd && n < start) due.push('countdown')

  // Important-task alarm — user-chosen lead, once. A lead of 0 ("at start
  // time") fires inside the same grace window as the start push.
  const r = reminderTime(t)
  if (t.isImportant && r != null && !ts(t.reminderNotifiedAt)) {
    const alarmEnd = t.reminderMinutes === 0
      ? start + START_PUSH_GRACE_MINUTES * MIN
      : start
    if (n >= r && n < alarmEnd) due.push('reminder')
  }

  // Starting-now — once, inside a small grace window so a slightly late cron
  // still delivers, but a task from hours ago never spams.
  if (!ts(t.startNotifiedAt) && n >= start && n < start + START_PUSH_GRACE_MINUTES * MIN) {
    due.push('start')
  }

  return due
}

function fmtTime(v: Date | string): string {
  return new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dayUrl(v: Date | string): string {
  return `/day/${new Date(v).toISOString().substring(0, 10)}`
}

/** Web-push payload for a task notification (consumed by public/sw.js). */
export function buildTaskPayload(t: SchedulableTask, kind: TaskNotificationKind) {
  if (!t.startTime) throw new Error('buildTaskPayload requires a startTime')
  const start = fmtTime(t.startTime)
  const end = t.endTime ? fmtTime(t.endTime) : null
  const window = end ? `${start} – ${end}` : start
  const url = dayUrl(t.date)

  if (kind === 'countdown') {
    return {
      title: `⏳ In ${COUNTDOWN_LEAD_MINUTES} min: ${t.title}`,
      body: `Starts at ${window}. The countdown is running.`,
      url,
      tag: `task-${t.id}-countdown`,
    }
  }
  if (kind === 'reminder') {
    const m = t.reminderMinutes ?? 0
    const lead = m === 0 ? 'Starting now' : m >= 60 ? `${m / 60}h to go` : `${m} min to go`
    return {
      title: `⏰ ${lead}: ${t.title}`,
      body: `Very important — scheduled ${window}.`,
      url,
      tag: `task-${t.id}-reminder`,
      requireInteraction: true,
      vibrate: [380, 160, 380],
    }
  }
  return {
    title: `▶ Starting now: ${t.title}`,
    body: `It's ${window}. Countdown's live on your day.`,
    url,
    tag: `task-${t.id}-start`,
  }
}

/** Push one task notification to every device of the owner; prunes dead endpoints. */
export async function pushTaskToUser(
  userId: string,
  payload: ReturnType<typeof buildTaskPayload>
) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  let sent = 0
  for (const s of subs) {
    const ok = await sendNotification(
      { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
      payload as { title: string; body: string; icon?: string; url?: string }
    )
    if (ok) sent++
    else await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
  }
  return sent
}

/** Mark one notification kind as delivered so it never fires twice. */
export async function stampTaskNotification(
  taskId: string,
  kind: TaskNotificationKind,
  when: Date = new Date()
) {
  const data =
    kind === 'countdown'
      ? { countdownNotifiedAt: when }
      : kind === 'reminder'
        ? { reminderNotifiedAt: when }
        : { startNotifiedAt: when }
  await prisma.task.update({ where: { id: taskId }, data }).catch(() => {})
}