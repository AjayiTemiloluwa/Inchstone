import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications?since=<ISO> — the notifications the server sent this user since `since`
 * (the browser passes the start of its own day), newest first. This is the "roll back" view: it
 * includes pushes the phone never showed, so nothing from today is lost.
 */
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = new URL(req.url).searchParams.get('since')
  const parsed = raw ? new Date(raw) : null
  const floor = new Date(Date.now() - 24 * 3_600_000)
  const since = parsed && !Number.isNaN(parsed.getTime()) && parsed > floor ? parsed : floor

  const items = await prisma.notificationLog.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ items })
}
