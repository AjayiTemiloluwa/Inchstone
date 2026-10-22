import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// ── Reflection Templates (single item) ──
// PUT   /api/reflections/[id]  — update { content? }
// DELETE /api/reflections/[id] — delete

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { content } = body

    if (content === undefined) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const reflection = await prisma.reflection.update({
      where: { id, userId },
      data: { content: String(content).trim() },
      include: {
        item: {
          select: { id: true, title: true, layer: true },
        },
      },
    })

    return NextResponse.json({ success: true, reflection })
  } catch (error) {
    console.error('Failed to update reflection', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH is an alias for PUT
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(req, ctx)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    await prisma.reflection.delete({
      where: { id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete reflection', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
