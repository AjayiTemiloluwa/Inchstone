import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { sendNudgeNotification } from '@/lib/pushNotifications'

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const nudges = await prisma.nudge.findMany({
            where: { receiverId: userId },
            include: {
                partner: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ nudges })
    } catch (error) {
        console.error('Failed to fetch nudges', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { partnerId, message } = body

        if (!partnerId || !message) {
            return NextResponse.json({ error: 'partnerId and message are required' }, { status: 400 })
        }

        // Verify the partner belongs to this user
        const partner = await prisma.partner.findFirst({
            where: { id: partnerId, userId },
        })

        if (!partner) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
        }

        // Get the current user's name (from the partner system we store name, but we need the sender's name)
        // For now, we'll use a default
        const senderName = 'Your Partner'

        // Create the nudge
        const nudge = await prisma.nudge.create({
            data: {
                partnerId,
                senderId: userId,
                receiverId: partner.userId, // The partner's user ID is stored in partner.userId
                message,
            },
        })

        // Send push notification to the partner if they have subscriptions
        // Note: The receiver is the actual user of the partner, so we look up their subscriptions
        // In a real impl, we'd need a user-to-user relationship. For now, nudges are stored.
        // The receiver ID should be looked up from the partner's user field.
        // Since partners are created by a user, the "other person" isn't actually in our system.
        // This is a simplified version that stores nudges for the partner system.

        return NextResponse.json({ success: true, nudge })
    } catch (error) {
        console.error('Failed to create nudge', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { nudgeId, read } = body

        if (!nudgeId) {
            return NextResponse.json({ error: 'nudgeId is required' }, { status: 400 })
        }

        const updated = await prisma.nudge.updateMany({
            where: { id: nudgeId, receiverId: userId },
            data: { read },
        })

        return NextResponse.json({ success: true, updated: updated.count > 0 })
    } catch (error) {
        console.error('Failed to update nudge', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}