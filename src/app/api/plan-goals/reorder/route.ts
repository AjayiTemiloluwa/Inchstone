import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/** Bulk-reorder goals within a section: array order becomes orderIndex 0..n */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const goalIds: string[] = Array.isArray(body.goalIds) ? body.goalIds : []
    if (goalIds.length === 0) return NextResponse.json({ error: 'goalIds is required' }, { status: 400 })

    const owned = await prisma.planGoal.findMany({
      where: { id: { in: goalIds }, userId },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map(g => g.id))

    await prisma.$transaction(
      goalIds
        .filter(gid => ownedIds.has(gid))
        .map((gid, idx) => prisma.planGoal.update({ where: { id: gid }, data: { orderIndex: idx } }))
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reorder goals', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}