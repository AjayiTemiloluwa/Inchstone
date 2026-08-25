/* eslint-disable @typescript-eslint/no-explicit-any -- error passthrough, matches api/items conventions */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { REVIEW_CADENCES } from '@/lib/plans/types'
import { isMonthKey, isValidMonthRange } from '@/lib/plans/duration'

/** All of the user's Long-Term Plans with light trees for progress rollups */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const plans = await prisma.longTermPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            goals: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                status: true,
                isDraft: true,
                archived: true,
                overallGoal: true,
                startDate: true,
                targetDate: true,
              },
            },
          },
        },
        reviewSessions: {
          orderBy: { conductedAt: 'desc' },
          select: { id: true, conductedAt: true, summaryNote: true },
        },
      },
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Failed to fetch plans', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/** Create a Plan - an empty shell with zero Sections */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const title = body.title?.trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    if (!isMonthKey(body.startMonth) || !isMonthKey(body.endMonth)) {
      return NextResponse.json({ error: 'startMonth and endMonth must be YYYY-MM' }, { status: 400 })
    }
    if (!isValidMonthRange(body.startMonth, body.endMonth)) {
      return NextResponse.json({ error: 'endMonth must not be before startMonth' }, { status: 400 })
    }
    const cadence = body.reviewCadence || 'monthly'
    if (!(REVIEW_CADENCES as readonly string[]).includes(cadence)) {
      return NextResponse.json({ error: 'invalid reviewCadence' }, { status: 400 })
    }

    const plan = await prisma.longTermPlan.create({
      data: {
        userId,
        title,
        startMonth: body.startMonth,
        endMonth: body.endMonth,
        anchorNote: body.anchorNote?.trim() || null,
        reviewCadence: cadence,
      },
    })

    return NextResponse.json({ success: true, plan })
  } catch (error: any) {
    console.error('Failed to create plan', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
