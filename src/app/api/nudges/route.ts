import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Find incoming nudges for the logged in user
        const nudges = await prisma.nudge.findMany({
            where: { receiverId: userId, read: false },
            include: { partner: true },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({ success: true, nudges })
    } catch (error) {
        console.error('Failed to get nudges:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { partnerId, receiverId, message } = await req.json()

        if (!partnerId || !receiverId || !message) {
            return NextResponse.json({ error: 'partnerId, receiverId, and message are required' }, { status: 400 })
        }

        const nudge = await prisma.nudge.create({
            data: {
                partnerId,
                senderId: userId,
                receiverId,
                message,
                read: false
            }
        })

        return NextResponse.json({ success: true, nudge })
    } catch (error) {
        console.error('Failed to create nudge:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { nudgeId, read } = await req.json()

        if (!nudgeId) {
            return NextResponse.json({ error: 'nudgeId is required' }, { status: 400 })
        }

        const nudge = await prisma.nudge.update({
            where: { id: nudgeId, receiverId: userId },
            data: { read }
        })

        return NextResponse.json({ success: true, nudge })
    } catch (error) {
        console.error('Failed to update nudge:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}