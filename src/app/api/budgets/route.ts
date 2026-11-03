import { NextResponse } from 'next/server'
import { FinanceError, upsertBudget } from '@/lib/finance/service'
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
    const result = await upsertBudget(userId, await req.json().catch(() => ({})))
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof FinanceError) return NextResponse.json({ error: error.message }, { status: error.status })
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
