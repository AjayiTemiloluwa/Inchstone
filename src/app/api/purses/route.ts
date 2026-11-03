import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { auditLedger, fromKobo } from '@/lib/finance/ledger'
import { FinanceError, archivePurse, createPurse, ensureDefaultPurses, updatePurse } from '@/lib/finance/service'

export const dynamic = 'force-dynamic'

function fail(error: unknown) {
  if (error instanceof FinanceError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Purse request failed', error)
  return NextResponse.json({ error: 'Something went wrong. Nothing was changed.' }, { status: 500 })
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await ensureDefaultPurses(userId)
    const [purses, entries] = await Promise.all([
      prisma.purse.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'asc' } }),
      prisma.financialEntry.findMany({ where: { userId } }),
    ])
    const balances = auditLedger(entries).balancesKobo // voided entries are excluded
    const purseBalances: Record<string, number> = {}
    for (const p of purses) purseBalances[p.name] = fromKobo(balances[p.name] ?? 0)
    return NextResponse.json({ purses, purseBalances })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const purse = await createPurse(userId, await req.json().catch(() => ({})))
    return NextResponse.json({ success: true, purse })
  } catch (error) {
    return fail(error)
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    if (!body.id || typeof body.id !== 'string') return NextResponse.json({ error: 'Purse id is required' }, { status: 400 })
    const purse = await updatePurse(userId, body.id, body)
    return NextResponse.json({ success: true, purse })
  } catch (error) {
    return fail(error)
  }
}

/** Removing a purse archives it, and only when it is empty: money is never moved or lost by deleting a container. */
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    if (!body.id || typeof body.id !== 'string') return NextResponse.json({ error: 'Purse id is required' }, { status: 400 })
    await archivePurse(userId, body.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return fail(error)
  }
}
