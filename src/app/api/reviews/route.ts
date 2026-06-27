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
