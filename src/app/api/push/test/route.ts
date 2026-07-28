import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { sendNotification } from '@/lib/pushNotifications'

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Get all push subscriptions for this user
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId },
        })

        if (subscriptions.length === 0) {
            return NextResponse.json({ error: 'No push subscriptions found. Please enable notifications first in Settings.' }, { status: 400 })
        }

        const results = []
        for (const sub of subscriptions) {
            const success = await sendNotification(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                {
                    title: '✅ Push Notification Test',
                    body: 'This is a test notification from Inchstone! Your device notifications are working.',
                    icon: '/api/icon?sizes=192x192',
                    url: '/dashboard',
                }
            )
            results.push({ endpoint: sub.endpoint.slice(0, 30) + '...', success })

            // If subscription expired, remove it
            if (!success) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } })
            }
        }

        const successCount = results.filter(r => r.success).length
        return NextResponse.json({
            success: successCount > 0,
            message: `Sent ${successCount}/${subscriptions.length} test notifications`,
            results,
        })
    } catch (error) {
        console.error('Failed to send test notification', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}