import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = { userId }

    if (startDate && endDate) {
      where.startTime = { gte: new Date(startDate) }
      where.endTime = { lte: new Date(endDate) }
    }

    const events = await prisma.event.findMany({
      where,
      include: { files: true },
      orderBy: { startTime: 'asc' }
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to fetch events', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, startTime, endTime, score, comment, type, completed, scheduledTime } = body

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: 'title, startTime, and endTime are required' }, { status: 400 })
    }

    const event = await prisma.event.create({
      data: {
        userId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        type: type || 'event',
        completed: completed || false,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        score: score || null,
        comment: comment || null,
      }
    })

    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error('Failed to create event', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, title, startTime, endTime, score, comment, type, completed, scheduledTime } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (startTime !== undefined) updateData.startTime = new Date(startTime)
    if (endTime !== undefined) updateData.endTime = new Date(endTime)
    if (score !== undefined) updateData.score = score
    if (comment !== undefined) updateData.comment = comment
    if (type !== undefined) updateData.type = type
    if (completed !== undefined) updateData.completed = completed
    if (scheduledTime !== undefined) updateData.scheduledTime = new Date(scheduledTime)

    const updated = await prisma.event.updateMany({
      where: { id, userId },
      data: updateData
    })

    return NextResponse.json({ success: true, updated: updated.count > 0 })
  } catch (error) {
    console.error('Failed to update event', error)
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

    await prisma.event.deleteMany({
      where: { id, userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete event', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}