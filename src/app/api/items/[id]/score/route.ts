import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { setManualScore, enableAutoScore } from '@/lib/score'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const resolvedParams = await params
        const item = await prisma.item.findUnique({
            where: { id: resolvedParams.id },
            select: { userId: true }
        })

        if (!item || item.userId !== userId) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 })
        }

        const { score, mode } = await request.json()

        if (mode === 'manual') {
            const validatedScore = Math.max(0, Math.min(100, Number(score) || 0))
            await setManualScore(resolvedParams.id, validatedScore)
            return NextResponse.json({ success: true, mode: 'manual', score: validatedScore })
        } else if (mode === 'auto') {
            await enableAutoScore(resolvedParams.id)
            return NextResponse.json({ success: true, mode: 'auto' })
        } else {
            return NextResponse.json({ error: 'Invalid mode. Use "manual" or "auto"' }, { status: 400 })
        }
    } catch (error) {
        console.error('Failed to update score mode:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}