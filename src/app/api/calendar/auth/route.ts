import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAuthUrl } from '@/lib/googleCalendar'

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const url = getAuthUrl(userId)
        return NextResponse.json({ url })
    } catch (error) {
        console.error('Failed to generate auth URL', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}