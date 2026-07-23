import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // Format: YYYY-MM
    const section = searchParams.get('section') // "Need", "Want", "Offerings"

    if (!month) {
      return NextResponse.json({ error: 'month parameter is required (YYYY-MM)' }, { status: 400 })
    }

    const where: any = { userId, month }
    if (section) where.section = section

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { category: 'asc' },
    })

    // Also fetch section allocations
    const allocations = await prisma.sectionAllocation.findMany({
      where: { userId, month },
    })

    return NextResponse.json({ budgets, allocations })
  } catch (error) {
    console.error('Failed to fetch budgets', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { category, amount, month, section } = body

    if (!category || amount === undefined || !month || !section) {
      return NextResponse.json({ error: 'category, amount, month, and section are required' }, { status: 400 })
    }

    if (!['Need', 'Want', 'Offerings'].includes(section)) {
      return NextResponse.json({ error: 'section must be Need, Want, or Offerings' }, { status: 400 })
    }

    const budget = await prisma.budget.upsert({
      where: {
        userId_category_month_section: {
          userId,
          category,
          month,
          section,
        },
      },
      update: { amount: parseFloat(amount) },
      create: {
        userId,
        section,
        category,
        amount: parseFloat(amount),
        month,
      },
    })

    return NextResponse.json({ success: true, budget })
  } catch (error) {
    console.error('Failed to upsert budget', error)
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

    await prisma.budget.deleteMany({
      where: { id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete budget', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
