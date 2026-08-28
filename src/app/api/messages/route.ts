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

        // Deliver to the REAL partner — messages only flow once linked.
        if (partner.status !== 'accepted' || !partner.connectionUserId) {
            return NextResponse.json({ error: 'Your partner has not accepted their invite yet.' }, { status: 400 })
        }

        const nudge = await prisma.nudge.create({
            data: {
                partnerId,
                senderId: userId,
                receiverId: partner.connectionUserId,
                message,
                read: false
            }
        })

        // Real-time-ish delivery: web push to the partner's devices only.
        try {
            const subscriptions = await prisma.pushSubscription.findMany({
                where: { userId: partner.connectionUserId }
            })

            for (const sub of subscriptions) {
                const ok = await sendNotification(
                    { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                    {
                        title: `Message from ${partner.name}`,
                        body: message.slice(0, 140),
                        url: '/partners'
                    }
                )
                if (!ok) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
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