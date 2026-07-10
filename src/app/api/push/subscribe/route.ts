import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { endpoint, p256dh, auth: authKey } = body

        if (!endpoint || !p256dh || !authKey) {
            return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
        }

        // Check if subscription already exists for this endpoint
        const existing = await prisma.pushSubscription.findFirst({
            where: { endpoint, userId },
        })

        if (existing) {
            await prisma.pushSubscription.update({
                where: { id: existing.id },
                data: { p256dh, auth: authKey },
            })
        } else {
            await prisma.pushSubscription.create({
                data: { userId, endpoint, p256dh, auth: authKey },
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to subscribe', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { endpoint } = body

        if (!endpoint) {
            return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
        }

        await prisma.pushSubscription.deleteMany({
            where: { endpoint, userId },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to unsubscribe', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
