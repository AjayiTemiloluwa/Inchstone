import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { GOAL_STATUSES } from '@/lib/plans/types'
import { recordStatusChange, validateLinkedItemId } from '@/lib/plans/statusLog'

type Ctx = { params: Promise<{ id: string }> }

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic partial update payloads */

const TEXT_FIELDS = [
  'overallGoal',
  'developmentOpportunity',
  'actionsPlanned',
  'resourcesAndSupport',
  'successCriteria',
] as const

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.planGoal.findFirst({
      where: { id, userId },
      include: { section: { include: { plan: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const plan = existing.section.plan

    const data: any = {}
    for (const f of TEXT_FIELDS) {
      if (body[f] !== undefined) data[f] = body[f]?.trim() || null
    }
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
    if (body.targetDate !== undefined) data.targetDate = new Date(body.targetDate)
    if (body.archived !== undefined) data.archived = Boolean(body.archived)
    if (body.orderIndex !== undefined) data.orderIndex = parseInt(body.orderIndex, 10) || 0
    if (body.linkedItemId !== undefined) {
      const v = await validateLinkedItemId(userId, body.linkedItemId)
      if (v === false) {
        return NextResponse.json({ error: 'linked item not found' }, { status: 400 })
      }
      data.linkedItemId = v
    }

    // Draft flag recomputes whenever any PDP text changes
    if (Object.keys(data).some(k => (TEXT_FIELDS as readonly string[]).includes(k))) {
      const merged = { ...existing, ...data }
      const complete =
        merged.overallGoal &&
        merged.developmentOpportunity &&
        merged.actionsPlanned &&
        merged.resourcesAndSupport &&
        merged.successCriteria
      data.isDraft = !complete
    }

    if (body.status !== undefined) {
      if (!(GOAL_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      }
      data.status = body.status
    }

    const updated = await prisma.planGoal.update({ where: { id }, data })

    // History log entry for every status change (§5) — optional note attached
    if (data.status !== undefined && data.status !== existing.status) {
      await recordStatusChange({
        userId,
        parentType: 'goal',
        parentId: updated.id,
        oldStatus: existing.status,
        newStatus: data.status,
        note: body.statusNote ?? null,
      })
    }

    // Warn (not block) when dates fall outside the plan range (§3)
    const warnings: string[] = []
    const [y0, m0] = plan.startMonth.split('-').map(Number)
    const [y1, m1] = plan.endMonth.split('-').map(Number)
    const rangeStart = new Date(y0, m0 - 1, 1)
    const rangeEnd = new Date(y1, m1, 0, 23, 59, 59)
    const effStart = (data.startDate ?? existing.startDate)
    const effTarget = (data.targetDate ?? existing.targetDate)
    if (effStart < rangeStart || effStart > rangeEnd) warnings.push('start_date_outside_plan')
    if (effTarget < rangeStart || effTarget > rangeEnd) warnings.push('target_date_outside_plan')

    return NextResponse.json({ success: true, goal: updated, warnings })
  } catch (error) {
    console.error('Failed to update goal', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    // Collect first so the polymorphic history log can be cleaned up too
    const goal = await prisma.planGoal.findFirst({
      where: { id, userId },
      include: { milestones: { select: { id: true } } },
    })
    if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const milestoneIds = goal.milestones.map(m => m.id)
    await prisma.$transaction([
      prisma.statusLogEntry.deleteMany({ where: { parentType: 'goal', parentId: goal.id } }),
      prisma.statusLogEntry.deleteMany({ where: { parentType: 'milestone', parentId: { in: milestoneIds } } }),
      prisma.planGoal.deleteMany({ where: { id, userId } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete goal', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}