import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { FinanceError, setAllocation } from '@/lib/finance/service'
import { isSection } from '@/lib/finance/ledger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const sp = new URL(req.url).searchParams
    const month = sp.get('month'), section = sp.get('section')
    if (month && !/^d{4}-d{2}$/.test(month)) return NextResponse.json({ error: 'month must look like YYYY-MM' }, { status: 400 })
    if (section && !isSection(section)) return NextResponse.json({ error: 'Unknown envelope' }, { status: 400 })
    const allocations = await prisma.sectionAllocation.findMany({ where: { userId, ...(month ? { month } : {}), ...(section ? { section } : {}) } })
    return NextResponse.json({ allocations })
  } catch (error) {
    console.error('Failed to fetch allocations', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/** Give an envelope its money for a month: a real move between two purses, replaced atomically when changed. */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const allocation = await setAllocation(userId, await req.json().catch(() => ({})))
    return NextResponse.json({ success: true, allocation })
  } catch (error) {
    if (error instanceof FinanceError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Failed to set allocation', error)
    return NextResponse.json({ error: 'Something went wrong. Nothing was changed.' }, { status: 500 })
  }
}
