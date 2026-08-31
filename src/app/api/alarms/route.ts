import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { ALARM_RING_GRACE_MINUTES, computeNextFire } from '@/lib/alarmScheduler'

/** GET /api/alarms — list the user's alarms with a live `due` flag. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alarms = await prisma.alarm.findMany({
    where: { userId },
    orderBy: [{ enabled: 'desc' }, { time: 'asc' }],
  })
  const nowMs = Date.now()
  const graceMs = ALARM_RING_GRACE_MINUTES * 60_000
  const out = []
  for (const a of alarms) {
    const fire = a.enabled && a.nextFire ? a.nextFire.getTime() : null
    if (fire != null && fire <= nowMs) {
      if (nowMs - fire > graceMs) {
        // Stale — its moment passed long ago (the app was closed). Never ring
        // it late: silently advance to the next occurrence instead.
        const nextFire = computeNextFire(a.time, a.days, new Date(), a.tz)
        const updated = await prisma.alarm
          .update({ where: { id: a.id }, data: { nextFire } })
          .catch(() => null)
        out.push({ ...a, nextFire: updated ? updated.nextFire : nextFire, due: false })
        continue
      }
      out.push({ ...a, due: true })
      continue
    }
    out.push({ ...a, due: false })
  }
  return NextResponse.json({ alarms: out })
}

/** POST /api/alarms — create { title, time "HH:mm", days "0,1,2", tz }. */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, time, days, tz } = await req.json()
  if (!title?.trim() || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time || '')) {
    return NextResponse.json({ error: 'Title and valid time (HH:mm) required' }, { status: 400 })
  }

  const daysStr = Array.isArray(days) && days.length ? days.join(',') : '0,1,2,3,4,5,6'
  const alarm = await prisma.alarm.create({
    data: {
      userId,
      title: title.trim().slice(0, 80),
      time,
      days: daysStr,
      // The timezone the time was set in — HH:mm means THAT place's clock,
      // never the server's.
      tz: typeof tz === 'string' && tz ? tz : null,
      nextFire: computeNextFire(time, daysStr, new Date(), typeof tz === 'string' ? tz : null),
    },
  })
  return NextResponse.json({ alarm })
}