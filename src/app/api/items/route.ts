import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const items = await prisma.item.findMany({
      where: { userId },
      orderBy: [
        { layer: 'asc' },
        { startDate: 'asc' }
      ],
      include: {
        tasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const categories = await prisma.userCategory.findMany({
      where: { userId }
    })

    return NextResponse.json({ items, categories })
  } catch (error) {
    console.error('Failed to fetch items', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { layer, parentId, title, description, weight, status, category, startDate, endDate, theme, focusQuestion, anchorScripture } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const item = await prisma.item.create({
      data: {
        userId,
        layer: parseInt(layer || '5'),
        parentId: parentId || null,
        title,
        description: description || null,
        weight: weight !== undefined ? parseFloat(weight) : 1,
        status: status || 'active',
        progress: 0,
        completed: false,
        category: category || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isRecurring: false,
        theme: theme || null,
        focusQuestion: focusQuestion || null,
        anchorScripture: anchorScripture || null,
      }
    })

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Failed to create item', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.item.deleteMany({
      where: { id, userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete item', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
