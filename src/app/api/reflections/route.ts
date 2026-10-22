import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

// ── Reflection Templates ──
// GET  /api/reflections?timePeriod=day&periodKey=2026-10-22   — list saved reflections for a period
// POST /api/reflections                                      — create { itemId?, timePeriod, periodKey, content }

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const timePeriod = searchParams.get('timePeriod') as TimePeriod | null
    const periodKey = searchParams.get('periodKey') || null

    const where: any = { userId }
    if (timePeriod) where.timePeriod = timePeriod
    if (periodKey) where.periodKey = periodKey

    const reflections = await prisma.reflection.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        item: {
          select: { id: true, title: true, layer: true },
        },
      },
    })

    return NextResponse.json({ reflections })
  } catch (error) {
    console.error('Failed to fetch reflections', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { itemId, timePeriod, periodKey, content } = body

    if (!timePeriod || !['day', 'week', 'month', 'quarter', 'year'].includes(timePeriod)) {
      return NextResponse.json({ error: 'timePeriod is required (day | week | month | quarter | year)' }, { status: 400 })
    }
    if (!periodKey || String(periodKey).trim() === '') {
      return NextResponse.json({ error: 'periodKey is required' }, { status: 400 })
    }
    if (!content || String(content).trim() === '') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const reflection = await prisma.reflection.create({
      data: {
        userId,
        itemId: itemId || null,
        timePeriod,
        periodKey: String(periodKey).trim(),
        content: String(content).trim(),
      },
      include: {
        item: {
          select: { id: true, title: true, layer: true },
        },
      },
    })

    return NextResponse.json({ success: true, reflection })
  } catch (error) {
    console.error('Failed to create reflection', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH() {
  return NextResponse.json({ error: 'Use PUT /api/reflections/[id]' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Use PUT /api/reflections/[id]' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Use DELETE /api/reflections/[id]' }, { status: 405 })
}
