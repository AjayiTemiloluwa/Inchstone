import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { computeNextFire } from '@/lib/alarmScheduler'

type Ctx = { params: Promise<{ id: string }> }

/** PATCH /api/alarms/:id — { enabled } toggle or { action: "snooze" } (+5 min). */
export async function PATCH(req: Request, ctx: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const alarm = await prisma.alarm.findFirst({ where: { id, userId } })
  if (!alarm) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (body.action === 'snooze') {
    const next = new Date(Date.now() + 5 * 60 * 1000)
    const updated = await prisma.alarm.update({
      where: { id },
      data: { enabled: true, nextFire: next },
    })
    return NextResponse.json({ alarm: updated })
  }

  const enabled = typeof body.enabled === 'boolean' ? body.enabled : !alarm.enabled
  const updated = await prisma.alarm.update({
    where: { id },
    data: {
      enabled,
      nextFire: enabled ? computeNextFire(alarm.time, alarm.days) : null,
    },
  })
  return NextResponse.json({ alarm: updated })
}

/** DELETE /api/alarms/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  await prisma.alarm.deleteMany({ where: { id, userId } })
  return NextResponse.json({ success: true })
}