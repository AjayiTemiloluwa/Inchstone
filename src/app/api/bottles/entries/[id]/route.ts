import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// DELETE /api/bottles/entries/[id] — remove a single pour (corrections)
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const entry = await prisma.bottleEntry.findFirst({ where: { id, userId } })
        if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

        await prisma.bottleEntry.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete bottle entry', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
