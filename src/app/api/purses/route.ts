import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

const DEFAULT_PURSES = [
    { name: 'Main', icon: '👜', color: '#3B82F6' },
    { name: 'Savings', icon: '🏦', color: '#8B5CF6' },
]

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let purses = await prisma.purse.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        })

        // Auto-seed default purses if none exist
        if (purses.length === 0) {
            await prisma.purse.createMany({
                data: DEFAULT_PURSES.map(p => ({ ...p, userId })),
            })
            purses = await prisma.purse.findMany({
                where: { userId },
                orderBy: { createdAt: 'asc' },
            })
        }

        // Calculate balance for each purse
        const allEntries = await prisma.financialEntry.findMany({ where: { userId } })
        const purseBalances: Record<string, number> = {}
        for (const purse of purses) {
            let balance = 0
            for (const e of allEntries) {
                if (e.purse === purse.name) {
                    if (e.type === 'income' || e.type === 'transfer_in') balance += e.amount
                    else if (e.type === 'expense' || e.type === 'transfer_out') balance -= e.amount
                }
            }
            purseBalances[purse.name] = balance
        }

        return NextResponse.json({ purses, purseBalances })
    } catch (error) {
        console.error('Failed to fetch purses', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { name, icon, color } = body

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Purse name is required' }, { status: 400 })
        }

        const trimmedName = name.trim()

        // Check for duplicate
        const existing = await prisma.purse.findUnique({
            where: { userId_name: { userId, name: trimmedName } },
        })
        if (existing) {
            return NextResponse.json({ error: 'A purse with this name already exists' }, { status: 409 })
        }

        const purse = await prisma.purse.create({
            data: {
                userId,
                name: trimmedName,
                icon: icon || '👜',
                color: color || '#3B82F6',
            },
        })

        return NextResponse.json({ success: true, purse })
    } catch (error) {
        console.error('Failed to create purse', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { id, name, icon, color } = body

        if (!id) {
            return NextResponse.json({ error: 'Purse id is required' }, { status: 400 })
        }

        const existing = await prisma.purse.findFirst({ where: { id, userId } })
        if (!existing) {
            return NextResponse.json({ error: 'Purse not found' }, { status: 404 })
        }

        const updateData: any = {}
        if (name !== undefined) updateData.name = name.trim()
        if (icon !== undefined) updateData.icon = icon
        if (color !== undefined) updateData.color = color

        const purse = await prisma.purse.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json({ success: true, purse })
    } catch (error) {
        console.error('Failed to update purse', error)
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
            return NextResponse.json({ error: 'Purse id is required' }, { status: 400 })
        }

        const purse = await prisma.purse.findFirst({ where: { id, userId } })
        if (!purse) {
            return NextResponse.json({ error: 'Purse not found' }, { status: 404 })
        }

        // Don't allow deleting the last purse
        const count = await prisma.purse.count({ where: { userId } })
        if (count <= 1) {
            return NextResponse.json({ error: 'Cannot delete the last purse' }, { status: 400 })
        }

        // Reassign entries to another purse (the first remaining one)
        const otherPurse = await prisma.purse.findFirst({
            where: { userId, id: { not: id } },
            orderBy: { createdAt: 'asc' },
        })

        if (otherPurse) {
            await prisma.financialEntry.updateMany({
                where: { userId, purse: purse.name },
                data: { purse: otherPurse.name },
            })
        }

        await prisma.purse.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete purse', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}