import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/* eslint-disable @typescript-eslint/no-explicit-any -- error.message passthrough, matches api/items conventions */

/** Add a Section to a Plan — name + optional description only, no PDP fields here (§3) */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const name = body.name?.trim()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!body.planId) return NextResponse.json({ error: 'planId is required' }, { status: 400 })

    const plan = await prisma.longTermPlan.findFirst({ where: { id: body.planId, userId } })
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const last = await prisma.planSection.findFirst({
      where: { planId: plan.id },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })

    const section = await prisma.planSection.create({
      data: {
        userId,
        planId: plan.id,
        name,
        description: body.description?.trim() || null,
        orderIndex: (last?.orderIndex ?? -1) + 1,
      },
    })

    return NextResponse.json({ success: true, section })
  } catch (error: any) {
    console.error('Failed to create section', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}