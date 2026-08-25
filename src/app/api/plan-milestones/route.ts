import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { GOAL_STATUSES } from '@/lib/plans/types'
import { validateLinkedItemId } from '@/lib/plans/statusLog'

/* eslint-disable @typescript-eslint/no-explicit-any -- request body validation */

/**
 * Add a Milestone under a Goal (§4).
 * The target date MUST sit between the Goal's start and target date — this
 * constraint hard-blocks (per spec) unlike the plan-range warning on goals.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const title = body.title?.trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    if (!body.goalId) return NextResponse.json({ error: 'goalId is required' }, { status: 400 })
    if (!body.targetDate) return NextResponse.json({ error: 'targetDate is required' }, { status: 400 })

    const goal = await prisma.planGoal.findFirst({
      where: { id: body.goalId, userId },
      select: { id: true, startDate: true, targetDate: true },
    })
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const targetDate = new Date(body.targetDate)
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'invalid targetDate' }, { status: 400 })
    }
    const startOfDay = new Date(goal.startDate.getFullYear(), goal.startDate.getMonth(), goal.startDate.getDate())
    const endOfTargetDay = new Date(goal.targetDate.getFullYear(), goal.targetDate.getMonth(), goal.targetDate.getDate(), 23, 59, 59)
    if (targetDate < startOfDay || targetDate > endOfTargetDay) {
      return NextResponse.json(
        { error: 'Milestone date must fall between the goal’s start and target date' },
        { status: 400 }
      )
    }

    if (body.status !== undefined && !(GOAL_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }

    // §8: optional tracker link must exist and belong to this user
    let linkedItemId: string | null = null
    if (body.linkedItemId !== undefined) {
      const v = await validateLinkedItemId(userId, body.linkedItemId)
      if (v === false) {
        return NextResponse.json({ error: 'linked item not found' }, { status: 400 })
      }
      linkedItemId = v
    }

    const milestone = await prisma.planMilestone.create({
      data: {
        userId,
        goalId: goal.id,
        title,
        targetDate,
        status: body.status || 'not_started',
        notes: body.notes?.trim() || null,
        linkedItemId,
      },
    })

    return NextResponse.json({ success: true, milestone })
  } catch (error: any) {
    console.error('Failed to create milestone', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}