import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { FinanceError, getOverview } from '@/lib/finance/service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/finance/overview?month=YYYY-MM — everything the Finance page shows, computed once on the
 * server from the ledger: balances, net worth, envelopes (assigned / spent / remaining), the 50/30/20
 * benchmark, savings rate, emergency-fund runway and a live integrity check.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const now = new Date()
    const month = new URL(req.url).searchParams.get('month') ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return NextResponse.json(await getOverview(userId, month))
  } catch (error) {
    if (error instanceof FinanceError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Finance overview failed', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
