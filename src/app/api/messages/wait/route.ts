import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { conversationAnchorId, conversationFilter } from '@/lib/partnerChat'

/**
 * GET /api/messages/wait?partnerId=…&known=<count>
 *
 * Long-poll for the chat: instead of the client re-fetching the thread every
 * few seconds, this request HANGS UP TO ~25s, checking the DB every 2s, and
 * answers the moment the message count differs from what the client already
 * has (or after the wait window, with changed:false). The client immediately
 * re-issues — so a quiet chat costs ~2 lightweight requests a minute, and a
 * new message lands in ~2s with zero client polling churn.
 */
export const maxDuration = 60 // headroom above the 25s wait window (Vercel)

const WAIT_MS = 25_000
const CHECK_EVERY_MS = 2_000

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const partnerId = searchParams.get('partnerId')
        const known = Number(searchParams.get('known') ?? '0')

        if (!partnerId || !Number.isFinite(known)) {
            return NextResponse.json({ error: 'partnerId and known are required' }, { status: 400 })
        }

        const partner = await prisma.partner.findUnique({
            where: { id: partnerId, userId }
        })
        if (!partner) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
        }

        const anchorId = await conversationAnchorId(partner)
        const filter = conversationFilter(anchorId, userId)
        const deadline = Date.now() + WAIT_MS

        while (Date.now() < deadline) {
            const count = await prisma.nudge.count({ where: filter })
            if (count !== known) {
                const messages = await prisma.nudge.findMany({
                    where: filter,
                    orderBy: { createdAt: 'asc' },
                    include: { partner: { select: { name: true } } },
                })
                return NextResponse.json({ success: true, changed: true, messages })
            }
            await new Promise(r => setTimeout(r, CHECK_EVERY_MS))
        }

        // Nothing changed inside the window — client re-issues immediately.
        return NextResponse.json({ success: true, changed: false })
    } catch (error) {
        console.error('Failed to wait for messages:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}