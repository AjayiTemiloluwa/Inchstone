import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const suggestions = await prisma.pendingSuggestion.findMany({
            where: { toUserId: userId },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ suggestions })
    } catch (error) {
        console.error('Failed to fetch suggestions', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { toUserId, itemId, suggestedTitle } = body

        if (!toUserId || !suggestedTitle) {
            return NextResponse.json({ error: 'toUserId and suggestedTitle are required' }, { status: 400 })
        }

        const suggestion = await prisma.pendingSuggestion.create({
            data: {
                fromUserId: userId,
                toUserId,
                itemId,
                suggestedTitle,
            },
        })

        return NextResponse.json({ success: true, suggestion })
    } catch (error) {
        console.error('Failed to create suggestion', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { suggestionId, status } = body

        if (!suggestionId || !status) {
            return NextResponse.json({ error: 'suggestionId and status are required' }, { status: 400 })
        }

        if (!['accepted', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'status must be accepted or rejected' }, { status: 400 })
        }

        const suggestion = await prisma.pendingSuggestion.findFirst({
            where: { id: suggestionId, toUserId: userId },
        })

        if (!suggestion) {
            return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
        }

        const updated = await prisma.pendingSuggestion.update({
            where: { id: suggestionId },
            data: { status },
        })

        return NextResponse.json({ success: true, suggestion: updated })
    } catch (error) {
        console.error('Failed to update suggestion', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}