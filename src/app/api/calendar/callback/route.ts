import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getTokensFromCode } from '@/lib/googleCalendar'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const code = searchParams.get('code')
        const userId = searchParams.get('state')

        if (!code || !userId) {
            return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
        }

        const tokens = await getTokensFromCode(code)
        if (!tokens.access_token) {
            return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 })
        }

        // Upsert the token record
        await prisma.userToken.upsert({
            where: { userId_provider: { userId, provider: 'google' } },
            update: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token ?? undefined,
                expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            },
            create: {
                userId,
                provider: 'google',
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            },
        })

        // Redirect user back to the app
        return NextResponse.redirect(new URL('/dashboard', req.url))
    } catch (error) {
        console.error('OAuth callback failed', error)
        return NextResponse.json({ error: 'OAuth failed' }, { status: 500 })
    }
}