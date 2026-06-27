import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCalendarEvents } from '@/lib/googleCalendar'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const timeMin = searchParams.get('timeMin')
        const timeMax = searchParams.get('timeMax')

        if (!timeMin || !timeMax) {
            return NextResponse.json({ error: 'timeMin and timeMax are required' }, { status: 400 })
        }

        const events = await getCalendarEvents(userId, new Date(timeMin), new Date(timeMax))
        return NextResponse.json({ events })
    } catch (error: any) {
        if (error.message === 'Google Calendar not connected') {
            return NextResponse.json({ error: 'Calendar not connected', needsAuth: true }, { status: 400 })
        }
        console.error('Failed to fetch calendar events', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}