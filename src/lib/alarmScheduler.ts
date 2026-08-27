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

/** Next occurrence of an "HH:mm" alarm on one of `days`, after `from`. */
export function computeNextFire(time: string, days: string, from = new Date()): Date | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!m) return null
  const hour = parseInt(m[1], 10)
  const minute = parseInt(m[2], 10)
  const allowed = parseDays(days)
  if (allowed.size === 0) return null
  for (let i = 0; i < 8; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    d.setHours(hour, minute, 0, 0)
    if (d.getTime() <= from.getTime()) continue
    if (allowed.has(d.getDay())) return d
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