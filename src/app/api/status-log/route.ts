import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/** History log for one Goal or Milestone (§5), newest first */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parentType = req.nextUrl.searchParams.get('parentType')
    const parentId = req.nextUrl.searchParams.get('parentId')
    if ((parentType !== 'goal' && parentType !== 'milestone') || !parentId) {
      return NextResponse.json({ error: 'parentType and parentId are required' }, { status: 400 })
    }

    const entries = await prisma.statusLogEntry.findMany({
      where: { userId, parentType, parentId },
      orderBy: { loggedAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Failed to fetch status log', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/** Append an ad-hoc note-only entry to a Goal's history (no status change) */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parentType = body.parentType
    const parentId = body.parentId
    if ((parentType !== 'goal' && parentType !== 'milestone') || !parentId) {
      return NextResponse.json({ error: 'parentType and parentId are required' }, { status: 400 })
    }
    const note = body.note?.trim()
    if (!note) return NextResponse.json({ error: 'note is required' }, { status: 400 })

    let exists: unknown = null
    if (parentType === 'goal') {
      exists = await prisma.planGoal.findFirst({ where: { id: parentId, userId }, select: { id: true, status: true } })
    } else {
      exists = await prisma.planMilestone.findFirst({ where: { id: parentId, userId }, select: { id: true, status: true } })
    }
    const parent = exists as { id: string; status: string } | null
    if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const entry = await prisma.statusLogEntry.create({
      data: {
        userId,
        parentType,
        parentId,
        oldStatus: parent.status,
        newStatus: parent.status,
        note,
      },
    })

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    console.error('Failed to append status log note', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}