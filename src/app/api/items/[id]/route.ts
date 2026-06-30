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
    const allowedFields = ['title', 'description', 'weight', 'status', 'completed', 'progress', 'category', 'layer', 'parentId', 'startDate', 'endDate', 'theme', 'focusQuestion', 'anchorScripture', 'isRecurring', 'recurrencePattern', 'recurrenceEnd', 'reflection']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'layer') {
          updateData[field] = parseInt(body[field])
        } else if (field === 'weight' || field === 'progress') {
          updateData[field] = parseFloat(body[field])
        } else if ((field === 'startDate' || field === 'endDate' || field === 'recurrenceEnd') && body[field]) {
          updateData[field] = new Date(body[field])
        } else if (field === 'parentId') {
          if (body[field]) {
            updateData.parent = { connect: { id: body[field] } }
          } else if (body[field] === null) {
            updateData.parent = { disconnect: true }
          }
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

// PATCH is an alias for PUT – allows partial field updates
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(req, ctx)
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
