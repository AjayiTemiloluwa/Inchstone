import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { GOAL_STATUSES } from '@/lib/plans/types'
import { recordStatusChange, validateLinkedItemId } from '@/lib/plans/statusLog'

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic partial update payloads */

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.planMilestone.findFirst({
      where: { id, userId },
      include: { goal: { select: { id: true, startDate: true, targetDate: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: any = {}
    if (body.title !== undefined) {
      const t = String(body.title).trim()
      if (!t) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      data.title = t
    }
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null
    if (body.linkedItemId !== undefined) {
      const v = await validateLinkedItemId(userId, body.linkedItemId)
      if (v === false) {
        return NextResponse.json({ error: 'linked item not found' }, { status: 400 })
      }
      data.linkedItemId = v
    }

    if (body.targetDate !== undefined) {
      const targetDate = new Date(body.targetDate)
      if (Number.isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: 'invalid targetDate' }, { status: 400 })
      }
      // Keep milestone inside its goal's window even when edited later (§4)
      const gStart = new Date(existing.goal.startDate.getFullYear(), existing.goal.startDate.getMonth(), existing.goal.startDate.getDate())
      const gEnd = new Date(existing.goal.targetDate.getFullYear(), existing.goal.targetDate.getMonth(), existing.goal.targetDate.getDate(), 23, 59, 59)
      if (targetDate < gStart || targetDate > gEnd) {
        return NextResponse.json(
          { error: 'Milestone date must fall between the goal’s start and target date' },
          { status: 400 }
        )
      }
      data.targetDate = targetDate
    }

    if (body.status !== undefined) {
      if (!(GOAL_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      }
      data.status = body.status
    }

    const updated = await prisma.planMilestone.update({ where: { id }, data })

    if (data.status !== undefined && data.status !== existing.status) {
      await recordStatusChange({
        userId,
        parentType: 'milestone',
        parentId: updated.id,
        oldStatus: existing.status,
        newStatus: data.status,
        note: body.statusNote ?? null,
      })
    }

    return NextResponse.json({ success: true, milestone: updated })
  } catch (error) {
    console.error('Failed to update milestone', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    // Clean the polymorphic history log alongside the milestone
    const milestone = await prisma.planMilestone.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction([
      prisma.statusLogEntry.deleteMany({ where: { parentType: 'milestone', parentId: milestone.id } }),
      prisma.planMilestone.deleteMany({ where: { id, userId } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete milestone', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}