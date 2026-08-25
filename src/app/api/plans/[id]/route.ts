import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { REVIEW_CADENCES } from '@/lib/plans/types'
import { isMonthKey, isValidMonthRange } from '@/lib/plans/duration'

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic partial update payloads */

type Ctx = { params: Promise<{ id: string }> }

/** Full plan tree: sections → goals → milestones, plus review sessions */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const plan = await prisma.longTermPlan.findFirst({
      where: { id, userId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            goals: {
              orderBy: { orderIndex: 'asc' },
              include: { milestones: { orderBy: { targetDate: 'asc' } } },
            },
          },
        },
        reviewSessions: { orderBy: { conductedAt: 'desc' } },
      },
    })
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Failed to fetch plan', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.longTermPlan.findFirst({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: any = {}
    if (body.title !== undefined) {
      const t = String(body.title).trim()
      if (!t) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      data.title = t
    }
    if (body.startMonth !== undefined || body.endMonth !== undefined) {
      const s = body.startMonth ?? existing.startMonth
      const e = body.endMonth ?? existing.endMonth
      if (!isMonthKey(s) || !isMonthKey(e) || !isValidMonthRange(s, e)) {
        return NextResponse.json({ error: 'Invalid month range' }, { status: 400 })
      }
      data.startMonth = s
      data.endMonth = e
    }
    if (body.anchorNote !== undefined) data.anchorNote = body.anchorNote?.trim() || null
    if (body.reviewCadence !== undefined) {
      if (!(REVIEW_CADENCES as readonly string[]).includes(body.reviewCadence)) {
        return NextResponse.json({ error: 'invalid reviewCadence' }, { status: 400 })
      }
      data.reviewCadence = body.reviewCadence
    }

    const plan = await prisma.longTermPlan.update({ where: { id }, data })
    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error('Failed to update plan', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    // Collect all descendant ids so the polymorphic history log is cleaned up too
    const plan = await prisma.longTermPlan.findFirst({
      where: { id, userId },
      include: {
        sections: {
          select: {
            goals: { select: { id: true, milestones: { select: { id: true } } } },
          },
        },
      },
    })
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const goalIds = plan.sections.flatMap(s => s.goals.map(g => g.id))
    const milestoneIds = plan.sections.flatMap(s => s.goals.flatMap(g => g.milestones.map(m => m.id)))

    await prisma.$transaction([
      prisma.statusLogEntry.deleteMany({ where: { parentType: 'goal', parentId: { in: goalIds } } }),
      prisma.statusLogEntry.deleteMany({ where: { parentType: 'milestone', parentId: { in: milestoneIds } } }),
      prisma.longTermPlan.deleteMany({ where: { id, userId } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete plan', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}