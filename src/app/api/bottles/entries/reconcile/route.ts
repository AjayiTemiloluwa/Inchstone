import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// POST /api/bottles/entries/reconcile — sync a reflection's pours to exactly
// what its text says.
//
// The reflection text is the source of truth. Every `@Bottle 400` mention that
// isn't already recorded as an entry (dedupeKey) gets poured; any pour whose
// mention was deleted (or the amount changed) is removed. This powers
// "if I delete the text, the amount leaves the bottle" — editing a saved
// reflection just works, no manual bookkeeping.

const MENTION_RE = /(?:^|[\s(])@([\p{L}\p{N}_\- ]+?)[ \t]+(-?\d+(?:\.\d+)?)/gu

const keyOf = (sourceRef: string, name: string, amount: number) =>
    `${sourceRef}|${name.toLowerCase().trim()}|${amount}`

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const sourceRef = body.sourceRef ? String(body.sourceRef).slice(0, 120) : null
        const text = typeof body.text === 'string' ? body.text : ''
        if (!sourceRef) return NextResponse.json({ error: 'sourceRef is required' }, { status: 400 })

        // 1. Parse the text into the set of mentions that SHOULD exist.
        const expected = new Map<string, { name: string; amount: number }>()
        const re = new RegExp(MENTION_RE)
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
            const rawName = m[1].trim().replace(/\s+/g, ' ')
            const amount = Number(m[2])
            if (!rawName || rawName.length > 24 || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e9) continue
            expected.set(keyOf(sourceRef, rawName, amount), { name: rawName, amount })
        }

        const bottles = await prisma.challengeBottle.findMany({
            where: { userId },
            select: { id: true, name: true },
        })
        const byName = new Map(bottles.map(b => [b.name.toLowerCase(), b]))

        // 2. Remove pours whose mention is no longer in the text.
        const existing = await prisma.bottleEntry.findMany({
            where: { userId, sourceRef },
            select: { id: true, dedupeKey: true, amount: true, bottleId: true },
        })

        const removeIds = existing
            .filter(e => e.dedupeKey && !expected.has(e.dedupeKey))
            .map(e => e.id)

        const removed: Array<{ name: string; amount: number }> = []
        if (removeIds.length > 0) {
            const targets = await prisma.bottleEntry.findMany({
                where: { id: { in: removeIds } },
                select: { id: true, amount: true, bottleId: true },
            })
            for (const t of targets) {
                const b = bottles.find(x => x.id === t.bottleId)
                removed.push({ name: b ? b.name : 'Unknown', amount: t.amount })
            }
            await prisma.bottleEntry.deleteMany({
                where: { id: { in: removeIds } },
            })
        }

        // 3. Pour mentions from the text that aren't recorded yet.
        const presentKeys = new Set(existing.map(e => e.dedupeKey).filter(Boolean))
        const added: Array<{ name: string; amount: number }> = []
        const note = text.trim().slice(0, 500)

        for (const [key, mention] of expected) {
            if (presentKeys.has(key)) continue
            // Multi-word names only pour when the bottle already exists
            // (avoids sentence false-positives); single words may mint.
            const known = byName.get(mention.name.toLowerCase())
            if (mention.name.includes(' ') && !known) continue

            let bottle = known
            if (!bottle) {
                bottle = await prisma.challengeBottle.create({
                    data: { userId, name: mention.name },
                    select: { id: true, name: true },
                })
                byName.set(bottle.name.toLowerCase(), bottle)
            }

            await prisma.bottleEntry.create({
                data: {
                    userId,
                    bottleId: bottle.id,
                    amount: mention.amount,
                    note,
                    sourceType: 'reflection',
                    sourceRef,
                    dedupeKey: key,
                },
            })
            added.push({ name: mention.name, amount: mention.amount })
        }

        return NextResponse.json({ success: true, added, removed })
    } catch (error) {
        console.error('Failed to reconcile bottle entries', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}