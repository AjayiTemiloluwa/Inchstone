import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/** Bulk-reorder sections within a plan: array order becomes orderIndex 0..n */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const sectionIds: string[] = Array.isArray(body.sectionIds) ? body.sectionIds : []
    if (sectionIds.length === 0) return NextResponse.json({ error: 'sectionIds is required' }, { status: 400 })

    // Only touch sections owned by this user
    const owned = await prisma.planSection.findMany({
      where: { id: { in: sectionIds }, userId },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map(s => s.id))

    await prisma.$transaction(
      sectionIds
        .filter(sid => ownedIds.has(sid))
        .map((sid, idx) => prisma.planSection.update({ where: { id: sid }, data: { orderIndex: idx } }))
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reorder sections', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}