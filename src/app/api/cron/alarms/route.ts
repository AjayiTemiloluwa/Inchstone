import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { computeNextFire, pushAlarmToUser } from '@/lib/alarmScheduler'

/**
 * GET /api/cron/alarms — fired every minute by Vercel Cron (vercel.json).
 * Pushes every due alarm (enabled, nextFire <= now) to its owner's devices,
 * then advances nextFire to the next occurrence.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const header = req.headers.get('authorization')
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const due = await prisma.alarm.findMany({
    where: { enabled: true, nextFire: { lte: now } },
  })

  let sent = 0
  for (const alarm of due) {
    try {
      await pushAlarmToUser(alarm.userId, alarm)
      sent++
    } catch (e) {
      console.error('Alarm dispatch failed', alarm.id, e)
    }
    await prisma.alarm.update({
      where: { id: alarm.id },
      data: {
        lastFired: now,
        nextFire: computeNextFire(alarm.time, alarm.days, now),
      },
    })
  }

  return NextResponse.json({ ok: true, fired: sent, checked: due.length })
}