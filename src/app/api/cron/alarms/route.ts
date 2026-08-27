import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { computeNextFire, pushAlarmToUser } from '@/lib/alarmScheduler'

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