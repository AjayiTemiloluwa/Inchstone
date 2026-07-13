import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // Format: YYYY-MM

    if (!month) {
      return NextResponse.json({ error: 'month parameter is required (YYYY-MM)' }, { status: 400 })
    }

    const budgets = await prisma.budget.findMany({
      where: { userId, month },
    })

    return NextResponse.json({ budgets })
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
    const { category, amount, month } = body

    if (!category || amount === undefined || !month) {
      return NextResponse.json({ error: 'category, amount, and month are required' }, { status: 400 })
    }

    const budget = await prisma.budget.upsert({
      where: {
        userId_category_month: {
          userId,
          category,
          month,
        },
      },
      update: { amount: parseFloat(amount) },
      create: {
        userId,
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
