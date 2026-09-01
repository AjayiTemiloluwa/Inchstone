import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// POST /api/bottles/entries — pour an amount into a bottle.
// Accepts either `bottleId` or `bottleName` (case-insensitive). When a
// bottleName is given and no bottle exists yet, the bottle is created on the
// fly — this powers the @-mention flow in reflections (e.g. "I did
// @Workout 400 press-ups").
export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const amount = Number(body.amount)
        if (!Number.isFinite(amount) || amount === 0) {
            return NextResponse.json({ error: 'A non-zero amount is required' }, { status: 400 })
        }

        let bottle: { id: string; name: string } | null = null

        const dedupeKey = body.dedupeKey ? String(body.dedupeKey).slice(0, 300) : null

        // Idempotence: reflections auto-save, so the same @Mention 123 in the
        // same reflection must never pour twice. Skip silently if seen before.
        if (dedupeKey) {
            const seen = await prisma.bottleEntry.findFirst({
                where: { userId, dedupeKey },
                select: { id: true, amount: true },
            })
            if (seen) {
                return NextResponse.json({ success: true, deduped: true, entry: seen })
            }
        }

        if (body.bottleId) {
            bottle = await prisma.challengeBottle.findFirst({
                where: { id: String(body.bottleId), userId },
                select: { id: true, name: true },
            })
            if (!bottle) return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })
        } else {
            const bottleName = String(body.bottleName || '').trim()
            if (!bottleName) return NextResponse.json({ error: 'bottleId or bottleName is required' }, { status: 400 })

            const all = await prisma.challengeBottle.findMany({
                where: { userId },
                select: { id: true, name: true },
            })
            bottle = all.find(b => b.name.toLowerCase() === bottleName.toLowerCase()) || null

            if (!bottle) {
                bottle = await prisma.challengeBottle.create({
                    data: {
                        userId,
                        name: bottleName,
                        unit: body.unit ? String(body.unit).trim() : null,
                    },
                    select: { id: true, name: true },
                })
            }
        }

        const entry = await prisma.bottleEntry.create({
            data: {
                userId,
                bottleId: bottle.id,
                amount,
                note: body.note ? String(body.note).slice(0, 500) : null,
                sourceType: body.sourceType ? String(body.sourceType).slice(0, 40) : null,
                sourceRef: body.sourceRef ? String(body.sourceRef).slice(0, 120) : null,
                dedupeKey: body.dedupeKey ? String(body.dedupeKey).slice(0, 300) : null,
            },
        })

        // Fresh total for the bottle
        const agg = await prisma.bottleEntry.aggregate({
            where: { bottleId: bottle.id },
            _sum: { amount: true },
        })

        return NextResponse.json({ success: true, entry, bottle, total: agg._sum.amount ?? 0 })
    } catch (error) {
        console.error('Failed to add bottle entry', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
