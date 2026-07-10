import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function POST() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Delete in reverse dependency order to respect foreign key constraints
        // Models that depend on Item first
        await prisma.pendingSuggestion.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } })
        await prisma.nudge.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } })
        await prisma.partnerLink.deleteMany({ where: { item: { userId } } })
        await prisma.partner.deleteMany({ where: { userId } })
        await prisma.financialEntry.deleteMany({ where: { userId } })
        await prisma.review.deleteMany({ where: { userId } })
        await prisma.note.deleteMany({ where: { userId } })
        await prisma.event.deleteMany({ where: { userId } })
        await prisma.task.deleteMany({ where: { userId } })
        await prisma.dailyScore.deleteMany({ where: { userId } })
        await prisma.tracker.deleteMany({ where: { userId } })
        await prisma.pushSubscription.deleteMany({ where: { userId } })
        await prisma.userToken.deleteMany({ where: { userId } })

        // Finally delete all items
        const deleted = await prisma.item.deleteMany({ where: { userId } })

        return NextResponse.json({ success: true, deletedItems: deleted.count })
    } catch (error) {
        console.error('Failed to reset data', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
