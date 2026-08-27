import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { computeNextFire } from '@/lib/alarmScheduler'

/** GET /api/alarms — list the user's alarms with a live `due` flag. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alarms = await prisma.alarm.findMany({
    where: { userId },
    orderBy: [{ enabled: 'desc' }, { time: 'asc' }],
  })
  const now = Date.now()
  return NextResponse.json({
    alarms: alarms.map(a => ({
      ...a,
      due: a.enabled && !!a.nextFire && a.nextFire.getTime() <= now,
    })),
  })
}

/** POST /api/alarms — create { title, time "HH:mm", days "0,1,2" }. */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, time, days } = await req.json()
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
      nextFire: computeNextFire(time, daysStr),
    },
  })
  return NextResponse.json({ alarm })
}