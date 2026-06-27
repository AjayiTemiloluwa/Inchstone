import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const reviews = await prisma.review.findMany({
      where: { userId },
      orderBy: { periodStart: 'desc' }
    })

    return NextResponse.json({ reviews })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { itemId, periodType, periodStart, mood, energy, reflection, wins, misses, tomorrowTop3 } = body

    const review = await prisma.review.create({
      data: {
        userId,
        itemId,
        periodType,
        periodStart: new Date(periodStart),
        mood,
        energy,
        reflection,
        wins,
        misses,
        tomorrowTop3
      }
    })

    return NextResponse.json({ success: true, review })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, ...updateFields } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const updateData: any = {}
    const allowedFields = ['itemId', 'periodType', 'periodStart', 'mood', 'energy', 'reflection', 'wins', 'misses', 'tomorrowTop3', 'partnerNotes', 'stats']

    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        if (field === 'periodStart') {
          updateData[field] = new Date(updateFields[field])
        } else {
          updateData[field] = updateFields[field]
        }
      }
    }

    const updated = await prisma.review.updateMany({
      where: { id, userId },
      data: updateData
    })

    return NextResponse.json({ success: true, updated: updated.count > 0 })
  } catch (error) {
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

    await prisma.review.deleteMany({
      where: { id, userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
