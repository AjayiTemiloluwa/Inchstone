import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// PATCH  /api/bottles/[id] — rename / re-unit / re-target a bottle
// DELETE /api/bottles/[id] — delete a bottle (cascades to its entries)

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const body = await req.json()

        const bottle = await prisma.challengeBottle.findFirst({ where: { id, userId } })
        if (!bottle) return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })

        if (body.name !== undefined) {
            const name = String(body.name).trim()
            if (!name) return NextResponse.json({ error: 'Bottle name is required' }, { status: 400 })
            const clash = await prisma.challengeBottle.findFirst({
                where: { userId, id: { not: id }, name: { equals: name } },
            })
            if (clash && clash.name.toLowerCase() === name.toLowerCase()) {
                return NextResponse.json({ error: `A bottle named "${clash.name}" already exists` }, { status: 409 })
            }
        }

        const updated = await prisma.challengeBottle.update({
            where: { id },
            data: {
                ...(body.name !== undefined && { name: String(body.name).trim() }),
                ...(body.emoji !== undefined && { emoji: body.emoji ? String(body.emoji).slice(0, 8) : null }),
                ...(body.unit !== undefined && { unit: body.unit ? String(body.unit).trim() : null }),
                ...(body.target !== undefined && { target: body.target === null || body.target === '' ? null : Number(body.target) }),
            },
        })

        return NextResponse.json({ success: true, bottle: updated })
    } catch (error) {
        console.error('Failed to update bottle', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const bottle = await prisma.challengeBottle.findFirst({ where: { id, userId } })
        if (!bottle) return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })

        await prisma.challengeBottle.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete bottle', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
