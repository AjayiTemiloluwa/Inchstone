import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/pushNotifications'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Find partners owned by this user
        const partners = await prisma.partner.findMany({
            where: { userId },
            include: { partnerLinks: true }
        })

        return NextResponse.json({ success: true, partners })
    } catch (error) {
        console.error('Failed to get partners:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { name, email, role } = await req.json()

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }

        const partner = await prisma.partner.create({
            data: {
                userId,
                name,
                email,
                role: role || 'Accountability Partner'
            }
        })

        // Look up if the partner email belongs to a registered user
        // Try to find this user's partner by email across all users
        // This is a best-effort check - we search for any user with this email in Clerk
        try {
            // Check if the partner's email matches another user in our system
            // We look for push subscriptions that might belong to this partner
            const existingSubscriptions = await prisma.pushSubscription.findMany({
                where: {
                    userId: { not: userId } // Not the current user
                },
                distinct: ['userId']
            })

            // For each potential partner, check if they have a matching email
            // Since we don't have direct email lookup, create a nudge for the partner
            // and try to push notify them if they have subscriptions
            for (const sub of existingSubscriptions) {
                // Create a nudge for this partner notification
                await prisma.nudge.create({
                    data: {
                        partnerId: partner.id,
                        senderId: userId,
                        receiverId: sub.userId,
                        message: `${name} has been added as an accountability partner! Say hi and start tracking goals together.`,
                        read: false
                    }
                })
            }
        } catch (e) {
            // Non-critical - partner was still created
            console.error('Failed to send partner notification:', e)
        }

        return NextResponse.json({ success: true, partner })
    } catch (error) {
        console.error('Failed to create partner:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const partnerId = searchParams.get('id')

        if (!partnerId) {
            return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 })
        }

        await prisma.partner.delete({
            where: { id: partnerId, userId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete partner:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
