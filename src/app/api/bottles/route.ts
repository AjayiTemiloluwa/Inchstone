import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// ── Challenge Bottles ──
// GET  /api/bottles        — list the user's bottles with totals + recent entries
// POST /api/bottles        — create a bottle { name, emoji?, unit?, target? }

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const entryLimit = Math.min(Number(searchParams.get('entryLimit')) || 50, 200)

        const bottles = await prisma.challengeBottle.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            include: {
                entries: {
                    orderBy: { createdAt: 'desc' },
                    take: entryLimit,
                },
            },
        })

        // Totals are computed over ALL entries (not just the recent page)
        const totals = await prisma.bottleEntry.groupBy({
            by: ['bottleId'],
            where: { userId },
            _sum: { amount: true },
            _count: { _all: true },
        })
        const totalByBottle = new Map(totals.map(t => [t.bottleId, t]))

        const shaped = bottles.map(b => {
            const agg = totalByBottle.get(b.id)
            return {
                ...b,
                total: agg?._sum.amount ?? 0,
                entryCount: agg?._count._all ?? 0,
            }
        })

        return NextResponse.json({ bottles: shaped })
    } catch (error) {
        console.error('Failed to fetch bottles', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const name = String(body.name || '').trim()
        if (!name) return NextResponse.json({ error: 'Bottle name is required' }, { status: 400 })

        // Case-insensitive duplicate check (name is referenced as @Name in reflections)
        const all = await prisma.challengeBottle.findMany({ where: { userId } })
        const duplicate = all.find(b => b.name.toLowerCase() === name.toLowerCase())
        if (duplicate) {
            return NextResponse.json({ error: `A bottle named "${duplicate.name}" already exists`, bottle: duplicate }, { status: 409 })
        }

        const bottle = await prisma.challengeBottle.create({
            data: {
                userId,
                name,
                emoji: body.emoji ? String(body.emoji).slice(0, 8) : null,
                unit: body.unit ? String(body.unit).trim() : null,
                target: body.target !== undefined && body.target !== null && body.target !== '' ? Number(body.target) : null,
            },
        })

        return NextResponse.json({ success: true, bottle })
    } catch (error) {
        console.error('Failed to create bottle', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
