import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

/** Past ReviewSessions for a Plan, newest first (§7) */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const sessions = await prisma.reviewSession.findMany({
      where: { planId: id, userId },
      orderBy: { conductedAt: 'desc' },
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch review sessions', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/** Record that a review pass happened, with optional overall reflection (§7) */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const plan = await prisma.longTermPlan.findFirst({ where: { id, userId }, select: { id: true } })
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const session = await prisma.reviewSession.create({
      data: {
        userId,
        planId: plan.id,
        summaryNote: body.summaryNote?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, session })
  } catch (error) {
    console.error('Failed to create review session', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}