import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const month = searchParams.get('month')
        const section = searchParams.get('section')

        const where: any = { userId, month }
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

        if (!section || amount === undefined || !month) {
            return NextResponse.json({ error: 'section, amount, and month are required' }, { status: 400 })
        }

        if (!['Need', 'Want', 'Offerings'].includes(section)) {
            return NextResponse.json({ error: 'section must be Need, Want, or Offerings' }, { status: 400 })
        }

        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount < 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }

        const allocation = await prisma.sectionAllocation.upsert({
            where: {
                userId_section_month: {
                    userId,
                    section,
                    month,
                },
            },
            update: { amount: parsedAmount },
            create: {
                userId,
                section,
                amount: parsedAmount,
                month,
            },
        })

        return NextResponse.json({ success: true, allocation })
    } catch (error) {
        console.error('Failed to upsert allocation', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}