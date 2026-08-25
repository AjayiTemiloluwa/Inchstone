import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic partial update payloads */

type Ctx = { params: Promise<{ id: string }> }

/** Rename / re-describe / reorder one Section */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.planSection.findFirst({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: any = {}
    if (body.name !== undefined) {
      const n = String(body.name).trim()
      if (!n) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      data.name = n
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.orderIndex !== undefined) data.orderIndex = parseInt(body.orderIndex, 10) || 0

    const section = await prisma.planSection.update({ where: { id }, data })
    return NextResponse.json({ success: true, section })
  } catch (error) {
    console.error('Failed to update section', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    // Collect descendant ids so the polymorphic history log is cleaned up too
    const section = await prisma.planSection.findFirst({
      where: { id, userId },
      include: { goals: { include: { milestones: { select: { id: true } } } } },
    })
    if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const goalIds = section.goals.map(g => g.id)
    const milestoneIds = section.goals.flatMap(g => g.milestones.map(m => m.id))

    await prisma.$transaction([
      prisma.statusLogEntry.deleteMany({ where: { parentType: 'goal', parentId: { in: goalIds } } }),
      prisma.statusLogEntry.deleteMany({ where: { parentType: 'milestone', parentId: { in: milestoneIds } } }),
      prisma.planSection.deleteMany({ where: { id, userId } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete section', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}