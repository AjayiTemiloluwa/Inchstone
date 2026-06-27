import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const deedId = searchParams.get('deedId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = { userId }

    if (deedId) {
      where.deedId = deedId
    }

    if (startDate && endDate) {
      where.entryDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const entries = await prisma.financialEntry.findMany({
      where,
      orderBy: { entryDate: 'desc' },
    })

    // Calculate totals
    const totalIncome = entries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0)

    const totalExpense = entries
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0)

    return NextResponse.json({ entries, totalIncome, totalExpense })
  } catch (error) {
    console.error('Failed to fetch financial entries', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { deedId, entryDate, type, amount, currency, category, description } = body

    if (!type || !amount || !category) {
      return NextResponse.json({ error: 'type, amount, and category are required' }, { status: 400 })
    }

    if (!['income', 'expense'].includes(type)) {
      return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
    }

    const entry = await prisma.financialEntry.create({
      data: {
        userId,
        deedId: deedId || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        type,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        category,
        description: description || null,
      },
    })

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    console.error('Failed to create financial entry', error)
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

    await prisma.financialEntry.deleteMany({
      where: { id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete financial entry', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
