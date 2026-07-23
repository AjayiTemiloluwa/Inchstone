import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const authResult = await auth()
    const { userId } = authResult
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('itemId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const purse = searchParams.get('purse')

    const where: any = { userId }

    if (itemId) where.itemId = itemId
    if (purse) where.purse = purse

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

    // Purse balances (across ALL entries, no filter)
    const allEntries = await prisma.financialEntry.findMany({ where: { userId } })
    let mainBalance = 0
    let savingsBalance = 0
    for (const e of allEntries) {
      if (e.purse === 'savings') {
        if (e.type === 'income' || e.type === 'transfer_in') savingsBalance += e.amount
        else if (e.type === 'expense' || e.type === 'transfer_out') savingsBalance -= e.amount
      } else {
        if (e.type === 'income' || e.type === 'transfer_in') mainBalance += e.amount
        else if (e.type === 'expense' || e.type === 'transfer_out') mainBalance -= e.amount
      }
    }

    return NextResponse.json({ entries, totalIncome, totalExpense, mainBalance, savingsBalance })
  } catch (error) {
    console.error('Failed to fetch financial entries', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await auth()
    const { userId } = authResult
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { itemId, entryDate, type, amount, currency, category, description, comments, priority, purse } = body

    if (!type || !amount || !category) {
      return NextResponse.json({ error: 'type, amount, and category are required' }, { status: 400 })
    }

    if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(type)) {
      return NextResponse.json({ error: 'type must be income, expense, transfer_in, or transfer_out' }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const entry = await prisma.financialEntry.create({
      data: {
        userId,
        itemId: itemId || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        type,
        amount: parsedAmount,
        currency: currency || 'USD',
        category: category.trim(),
        description: description || null,
        comments: comments || null,
        priority: priority || null,
        purse: purse || 'main',
      },
    })

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    console.error('Failed to create financial entry', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Transfer between purses
export async function PUT(req: Request) {
  try {
    const authResult = await auth()
    const { userId } = authResult
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { amount, from, to, description } = body

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!from || !to || from === to) {
      return NextResponse.json({ error: 'Must specify different from and to purses' }, { status: 400 })
    }

    if (!['main', 'savings'].includes(from) || !['main', 'savings'].includes(to)) {
      return NextResponse.json({ error: 'Purse must be "main" or "savings"' }, { status: 400 })
    }

    // Create withdrawal from source purse
    const outEntry = await prisma.financialEntry.create({
      data: {
        userId,
        entryDate: new Date(),
        type: 'transfer_out',
        amount: parsedAmount,
        currency: 'USD',
        category: 'Transfer',
        description: description || `Transfer from ${from} to ${to}`,
        purse: from,
      },
    })

    // Create deposit to destination purse
    const inEntry = await prisma.financialEntry.create({
      data: {
        userId,
        entryDate: new Date(),
        type: 'transfer_in',
        amount: parsedAmount,
        currency: 'USD',
        category: 'Transfer',
        description: description || `Transfer from ${from} to ${to}`,
        purse: to,
      },
    })

    return NextResponse.json({ success: true, outEntry, inEntry })
  } catch (error) {
    console.error('Failed to transfer between purses', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
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