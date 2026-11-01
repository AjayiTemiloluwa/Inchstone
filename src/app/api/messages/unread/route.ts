import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { conversationAnchorId } from '@/lib/partnerChat'

// GET /api/messages/unread — unread messages for the signed-in user:
//   { total, byPartner: { <my partner row id>: count } }

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const grouped = await prisma.nudge.groupBy({
    by: ['partnerId'],
    where: { receiverId: userId, read: false },
    _count: { _all: true },
  })
  const total = grouped.reduce((n, g) => n + g._count._all, 0)
  if (!total) return NextResponse.json({ total: 0, byPartner: {} })

  // Messages anchor to one shared conversation row; map each to MY row.
  const rows = await prisma.partner.findMany({ where: { userId, status: 'accepted' } })
  const byPartner: Record<string, number> = {}
  for (const row of rows) {
    const anchor = await conversationAnchorId(row)
    const g = grouped.find((x) => x.partnerId === anchor)
    if (g) byPartner[row.id] = g._count._all
  }
  return NextResponse.json({ total, byPartner })
}
