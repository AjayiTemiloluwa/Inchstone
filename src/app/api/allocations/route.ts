import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

const SECTIONS = ['Need', 'Want', 'Offerings', 'Savings']

/** Sum one purse's movements. Income/transfer_in add, expense/transfer_out subtract. */
function purseBalance(
    entries: { type: string; amount: number; purse: string }[],
    purse: string,
): number {
    let balance = 0
    for (const e of entries) {
        if (e.purse !== purse) continue
        if (e.type === 'income' || e.type === 'transfer_in') balance += e.amount
        else if (e.type === 'expense' || e.type === 'transfer_out') balance -= e.amount
    }
    return balance
}

/**
 * UTC midnight on the 1st of a "YYYY-MM" key. A monthly plan belongs to its
 * month, so its movement is dated the 1st rather than whenever it was set —
 * that keeps the ledger's month filter honest when planning an older month.
 */
function monthStart(month: string): Date {
    const [y, m] = month.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, 1))
}

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const month = searchParams.get('month')
        const section = searchParams.get('section')

        // Built up conditionally: `month` arrives from searchParams as
        // `string | null`, and the column is non-nullable, so an absent month
        // must be omitted rather than passed through as null.
        const where: { userId: string; month?: string; section?: string } = { userId }
        if (month) where.month = month
        if (section) where.section = section

        const allocations = await prisma.sectionAllocation.findMany({ where })
        return NextResponse.json({ allocations })
    } catch (error) {
        console.error('Failed to fetch allocations', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { section, amount, month } = body
        const sourcePurse = typeof body.sourcePurse === 'string' && body.sourcePurse ? body.sourcePurse : 'Main'
        const purse = typeof body.purse === 'string' && body.purse ? body.purse : 'Main'

        if (!section || amount === undefined || !month) {
            return NextResponse.json({ error: 'section, amount, and month are required' }, { status: 400 })
        }

        if (!SECTIONS.includes(section)) {
            return NextResponse.json({ error: 'section must be Need, Want, Offerings, or Savings' }, { status: 400 })
        }

        if (!/^\d{4}-\d{2}$/.test(month)) {
            return NextResponse.json({ error: 'month must look like YYYY-MM' }, { status: 400 })
        }

        const parsedAmount = Number(amount)
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }

        // Allocating moves money between two purses, so both ends must exist.
        const purses = await prisma.purse.findMany({ where: { userId }, select: { name: true } })
        const names = new Set(purses.map(p => p.name))
        if (!names.has(sourcePurse)) {
            return NextResponse.json({ error: `Source purse "${sourcePurse}" not found` }, { status: 400 })
        }
        if (!names.has(purse)) {
            return NextResponse.json({ error: `Destination purse "${purse}" not found` }, { status: 400 })
        }
        if (parsedAmount > 0 && sourcePurse === purse) {
            return NextResponse.json({ error: 'The money must land in a different purse than it came from' }, { status: 400 })
        }

        const existing = await prisma.sectionAllocation.findUnique({
            where: { userId_section_month: { userId, section, month } },
        })

        // This section's previous movement is replaced wholesale, so give the
        // source purse back its old amount before measuring what it can fund —
        // that way re-setting, increasing and reducing all reconcile instead of
        // double-charging. (If the source *was* the destination last time, the
        // replacement takes that amount out of it instead.)
        const entries = await prisma.financialEntry.findMany({
            where: { userId },
            select: { type: true, amount: true, purse: true },
        })
        const available =
            purseBalance(entries, sourcePurse)
            + (existing && existing.sourcePurse === sourcePurse ? existing.amount : 0)
            - (existing && existing.purse === sourcePurse ? existing.amount : 0)

        if (parsedAmount > available) {
            return NextResponse.json({
                error: `Not enough in "${sourcePurse}". Available ₦${available.toFixed(2)} but trying to allocate ₦${parsedAmount.toFixed(2)}. Add income to ${sourcePurse} or pick a different source.`
            }, { status: 400 })
        }

        // One atomic batch: save the plan, drop its previous transfer pair, and
        // write the new pair. The id is minted up front so the movements can be
        // tagged without waiting on the upsert.
        const allocationId = existing?.id ?? crypto.randomUUID()
        const entryDate = monthStart(month)
        const description = `${section} plan: ${sourcePurse} → ${purse}`

        const movements = parsedAmount > 0
            ? [prisma.financialEntry.createMany({
                data: [
                    {
                        userId, entryDate, type: 'transfer_out', amount: parsedAmount, currency: 'NGN',
                        category: 'Allocation', description, priority: section,
                        purse: sourcePurse, allocationId,
                    },
                    {
                        userId, entryDate, type: 'transfer_in', amount: parsedAmount, currency: 'NGN',
                        category: 'Allocation', description, priority: section,
                        purse, allocationId,
                    },
                ],
            })]
            : []

        const [allocation] = await prisma.$transaction([
            prisma.sectionAllocation.upsert({
                where: { userId_section_month: { userId, section, month } },
                update: { amount: parsedAmount, sourcePurse, purse },
                create: { id: allocationId, userId, section, amount: parsedAmount, month, sourcePurse, purse },
            }),
            prisma.financialEntry.deleteMany({ where: { userId, allocationId } }),
            ...movements,
        ])

        return NextResponse.json({ success: true, allocation })
    } catch (error) {
        console.error('Failed to upsert allocation', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}