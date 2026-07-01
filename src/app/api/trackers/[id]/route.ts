import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { id } = await params
        const tracker = await prisma.tracker.findFirst({
            where: { id, userId },
        })

        if (!tracker) {
            return NextResponse.json({ error: 'Tracker not found' }, { status: 404 })
        }

        const updated = await prisma.tracker.update({
            where: { id },
            data: {
                ...(body.completed !== undefined && { completed: body.completed }),
                ...(body.title !== undefined && { title: body.title }),
            },
        })

        return NextResponse.json({ success: true, tracker: updated })
    } catch (error) {
        console.error('Failed to update tracker', error)
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
        const tracker = await prisma.tracker.findFirst({
            where: { id, userId },
        })

        if (!tracker) {
            return NextResponse.json({ error: 'Tracker not found' }, { status: 404 })
        }

        await prisma.tracker.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete tracker', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}