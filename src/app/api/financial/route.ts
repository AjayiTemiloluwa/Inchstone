import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { FinanceError, editEntry, recordEntry, transfer, voidEntry } from '@/lib/finance/service'

export const dynamic = 'force-dynamic'

/** Every route here is a thin wrapper: authenticate, hand the body to the ledger service, report its verdict. */
function fail(error: unknown) {
  if (error instanceof FinanceError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Finance request failed', error)
  return NextResponse.json({ error: 'Something went wrong. Nothing was changed.' }, { status: 500 })
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const where: Record<string, unknown> = { userId }
    // Voided entries are history, not money: hidden unless asked for.
    if (sp.get('includeVoided') !== '1') where.voidedAt = null
    for (const k of ['itemId', 'purse', 'category', 'type'] as const) if (sp.get(k)) where[k] = sp.get(k)

    const start = sp.get('startDate'), end = sp.get('endDate')
    if (start && end) {
      const s = new Date(start), e = new Date(end)
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
      where.entryDate = { gte: s, lte: e }
    }
    const take = Math.min(Math.max(parseInt(sp.get('limit') || '0', 10) || 0, 0), 1000) || undefined
    const skip = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0) || undefined

    const [entries, totalCount] = await Promise.all([
      prisma.financialEntry.findMany({ where, orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }], take, skip }),
      prisma.financialEntry.count({ where }),
    ])

    // Totals and the category breakdown only count real income and spending; transfers and voided rows are not either.
    let totalIncome = 0, totalExpense = 0
    const categoryBreakdown: Record<string, { total: number; count: number; type: string }> = {}
    for (const e of entries) {
      if (e.voidedAt) continue
      if (e.type === 'income') totalIncome += e.amount
      else if (e.type === 'expense') totalExpense += e.amount
      else continue
      const c = (categoryBreakdown[e.category] ??= { total: 0, count: 0, type: e.type })
      c.total += e.amount
      c.count += 1
    }
    return NextResponse.json({ entries, totalIncome, totalExpense, totalCount, categoryBreakdown })
  } catch (error) {
    return fail(error)
  }
}

/** Record income or spending. */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const { entry, duplicate } = await recordEntry(userId, body)
    return NextResponse.json({ success: true, entry, duplicate })
  } catch (error) {
    return fail(error)
  }
}

/** Transfer between two purses (both legs, or neither). */
export async function PUT(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const result = await transfer(userId, body)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return fail(error)
  }
}

/** Edit an entry: text in place; amount, date or purse by voiding the old row and writing a replacement. */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    if (!body.id || typeof body.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const entry = await editEntry(userId, body.id, body)
    return NextResponse.json({ success: true, entry })
  } catch (error) {
    return fail(error)
  }
}

/** "Delete" voids: the entry stays in history, out of every balance. A transfer is voided as a pair. */
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    if (!body.id || typeof body.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const result = await voidEntry(userId, body.id, body.reason)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return fail(error)
  }
}
