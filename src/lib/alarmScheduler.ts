import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/pushNotifications'

/** Days string "0,1,2" (0=Sun) → Set of JS day numbers. */
export function parseDays(days: string): Set<number> {
  return new Set(
    days
      .split(',')
      .map(d => parseInt(d.trim(), 10))
      .filter(d => !Number.isNaN(d) && d >= 0 && d <= 6)
  )
}

/**
 * Offset (ms) to add to a UTC instant to get the wall-clock time in `tz`.
 * No tz → the server's own timezone (local dev). Uses Intl so DST is handled.
 */
function tzOffsetMs(utcMs: number, tz?: string | null): number {
  if (!tz) return -new Date(utcMs).getTimezoneOffset() * 60_000
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - utcMs
}

/**
 * A due alarm rings in the foreground / pushes via cron only if it became due
 * within this window. Anything older (the app was closed past the moment, the
 * scheduler was down) is silently advanced to its next occurrence — a stale
 * alarm never rings or buzzes hours late.
 */
export const ALARM_RING_GRACE_MINUTES = 5

/**
 * Next occurrence of an "HH:mm" alarm on one of `days`, after `from`.
 * The time is interpreted in the alarm's OWN timezone (`tz`, captured from
 * the browser at creation) — never the server's — so a 06:00 alarm rings at
 * 06:00 where the user actually is, even though the server runs in UTC.
 */
export function computeNextFire(time: string, days: string, from = new Date(), tz?: string | null): Date | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!m) return null
  const hour = parseInt(m[1], 10)
  const minute = parseInt(m[2], 10)
  const allowed = parseDays(days)
  if (allowed.size === 0) return null

  for (let i = 0; i < 8; i++) {
    const dayProbe = from.getTime() + i * 86_400_000
    const local = new Date(dayProbe + tzOffsetMs(dayProbe, tz))
    const y = local.getUTCFullYear()
    const mo = local.getUTCMonth()
    const d = local.getUTCDate()
    // Weekday of that local calendar date.
    const weekday = new Date(Date.UTC(y, mo, d)).getUTCDay()
    if (!allowed.has(weekday)) continue

    // The UTC instant whose wall-clock time in `tz` is HH:mm on that date.
    const naive = Date.UTC(y, mo, d, hour, minute, 0, 0)
    const candidate = new Date(naive - tzOffsetMs(naive, tz))
    if (candidate.getTime() <= from.getTime()) continue
    return candidate
  }
  return null
}

type Sub = { endpoint: string; p256dh: string; auth: string }

/** Push an alarm to every subscription of a user; prunes dead endpoints. */
export async function pushAlarmToUser(userId: string, alarm: { id: string; title: string; time: string }) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  const body = `${alarm.title} — it's ${alarm.time}.`
  for (const s of subs) {
    const ok = await sendNotification(
      { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
      { title: '⏰ Alarm', body, icon: '/api/icon?sizes=192x192', url: '/dashboard' }
    )
    if (!ok) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
  }
  return subs.length
}

export type { Sub }