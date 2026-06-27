import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    // Build update payload dynamically (only include provided fields)
    const updateData: any = {}
    const allowedFields = ['title', 'description', 'weight', 'status', 'completed', 'category', 'layer', 'parentId', 'startDate', 'endDate', 'theme', 'focusQuestion', 'anchorScripture']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'weight' || field === 'layer') {
          updateData[field] = parseInt(body[field])
        } else if ((field === 'startDate' || field === 'endDate') && body[field]) {
          updateData[field] = new Date(body[field])
        } else {
          updateData[field] = body[field]
        }
      }
    }

    const updated = await prisma.item.update({
      where: { id, userId },
      data: updateData
    })

    return NextResponse.json({ success: true, item: updated })
  } catch (error) {
    console.error('Failed to update item', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    await prisma.item.deleteMany({
      where: { id, userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete item', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
