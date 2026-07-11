import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/pushNotifications'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const partnerId = searchParams.get('partnerId')

        if (!partnerId) {
            return NextResponse.json({ error: 'partnerId is required' }, { status: 400 })
        }

        // Get messages (nudges) between the current user and this partner
        const partner = await prisma.partner.findUnique({
            where: { id: partnerId, userId }
        })

        if (!partner) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
        }

        // Get all nudges where this partner is involved (sent or received)
        const messages = await prisma.nudge.findMany({
            where: {
                OR: [
                    { partnerId, senderId: userId },
                    { partnerId, receiverId: userId },
                ]
            },
            orderBy: { createdAt: 'asc' },
            include: {
                partner: {
                    select: { name: true }
                }
            }
        })

        return NextResponse.json({ success: true, messages })
    } catch (error) {
        console.error('Failed to get messages:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { partnerId, message } = await req.json()

        if (!partnerId || !message) {
            return NextResponse.json({ error: 'partnerId and message are required' }, { status: 400 })
        }

        // Verify the partner belongs to this user
        const partner = await prisma.partner.findUnique({
            where: { id: partnerId, userId }
        })

        if (!partner) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
        }

        // Create the nudge/message
        const nudge = await prisma.nudge.create({
            data: {
                partnerId,
                senderId: userId,
                receiverId: userId, // For now, messages are self-contained
                message,
                read: false
            }
        })

        // Try to send push notification to the partner if they have subscriptions
        try {
            const subscriptions = await prisma.pushSubscription.findMany({
                where: { userId: { not: userId } }
            })

            for (const sub of subscriptions) {
                await sendNotification(
                    { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                    {
                        title: `Message from ${partner.name}`,
                        body: message,
                        url: '/partners'
                    }
                )
            }
        } catch (e) {
            console.error('Failed to send push notification for message:', e)
        }

        return NextResponse.json({ success: true, nudge })
    } catch (error) {
        console.error('Failed to send message:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}