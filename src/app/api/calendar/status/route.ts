import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized', status: 'no_user' }, { status: 401 })

        const tokenRecord = await prisma.userToken.findUnique({
            where: { userId_provider: { userId, provider: 'google' } },
        })

        if (!tokenRecord) {
            return NextResponse.json({ connected: false, status: 'not_connected' })
        }

        const isExpired = tokenRecord.expiryDate && tokenRecord.expiryDate < new Date()
        const hasRefreshToken = !!tokenRecord.refreshToken

        return NextResponse.json({
            connected: true,
            status: isExpired ? 'token_expired' : 'connected',
            hasRefreshToken,
            expiresAt: tokenRecord.expiryDate?.toISOString() || null,
            tokenExists: true,
        })
    } catch (error) {
        console.error('Failed to check calendar status', error)
        return NextResponse.json({ error: 'Internal Server Error', status: 'error' }, { status: 500 })
    }
}