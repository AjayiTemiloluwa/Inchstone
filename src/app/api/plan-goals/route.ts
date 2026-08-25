
/* eslint-disable @typescript-eslint/no-explicit-any -- error passthrough, matches api/items conventions */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { GOAL_STATUSES } from '@/lib/plans/types'
import { recordStatusChange, validateLinkedItemId } from '@/lib/plans/statusLog'

const TEXT_FIELDS = [
  'overallGoal',
  'developmentOpportunity',
  'actionsPlanned',
  'resourcesAndSupport',
  'successCriteria',
] as const

/**
 * Add a Goal to a Section (§3).
 * - targetDate defaults to the parent Plan's end month when omitted → forces draft
 * - startDate defaults to the parent Plan's start month (Gantt bar origin)
 * - Dates outside the plan range produce warnings, not blocks
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.sectionId) return NextResponse.json({ error: 'sectionId is required' }, { status: 400 })

    const section = await prisma.planSection.findFirst({
      where: { id: body.sectionId, userId },
      include: { plan: true },
    })
    if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    const plan = section.plan

    const texts: Record<string, string | null> = {}
    for (const f of TEXT_FIELDS) texts[f] = body[f]?.trim() || null

    // Start date defaults to plan's start month (§3)
    const [py0, pm0] = plan.startMonth.split('-').map(Number)
    const startDate = body.startDate ? new Date(body.startDate) : new Date(py0, pm0 - 1, 1)
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'invalid startDate' }, { status: 400 })
    }

    // Target date defaults to plan's end month → such a goal can never be complete
    const [py1, pm1] = plan.endMonth.split('-').map(Number)
    const explicitTarget = Boolean(body.targetDate)
    const targetDate = body.targetDate ? new Date(body.targetDate) : new Date(py1, pm1, 0)
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'invalid targetDate' }, { status: 400 })
    }

    const complete =
      explicitTarget &&
      Object.values(texts).every(v => Boolean(v))
    const isDraft = body.isDraft !== undefined ? Boolean(body.isDraft) : !complete

    let status = 'not_started'
    if (body.status !== undefined) {
      if (!(GOAL_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      }
      status = body.status
    }

    const last = await prisma.planGoal.findFirst({
      where: { sectionId: section.id },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })

    // §8: optional tracker link must exist and belong to this user
    let linkedItemId: string | null = null
    if (body.linkedItemId !== undefined) {
      const v = await validateLinkedItemId(userId, body.linkedItemId)
      if (v === false) {
        return NextResponse.json({ error: 'linked item not found' }, { status: 400 })
      }
      linkedItemId = v
    }

    const goal = await prisma.planGoal.create({
      data: {
        userId,
        sectionId: section.id,
        ...texts,
        startDate,
        targetDate,
        status,
        isDraft,
        orderIndex: (last?.orderIndex ?? -1) + 1,
        linkedItemId,
      },
    })

    if (status !== 'not_started') {
      await recordStatusChange({
        userId,
        parentType: 'goal',
        parentId: goal.id,
        oldStatus: null,
        newStatus: status,
        note: body.statusNote ?? null,
      })
    }

    // Warn (not block) when dates fall outside the plan range (§3)
    const warnings: string[] = []
    const rangeStart = new Date(py0, pm0 - 1, 1)
    const rangeEnd = new Date(py1, pm1, 0, 23, 59, 59)
    if (startDate < rangeStart || startDate > rangeEnd) warnings.push('start_date_outside_plan')
    if (targetDate < rangeStart || targetDate > rangeEnd) warnings.push('target_date_outside_plan')

    return NextResponse.json({ success: true, goal, warnings })
  } catch (error: any) {
    console.error('Failed to create goal', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}