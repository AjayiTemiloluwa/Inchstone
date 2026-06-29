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

        // Map Google Calendar response to our format
        const mapped = events.map((event: any) => ({
            id: event.id,
            summary: event.summary || '(No title)',
            description: event.description || '',
            start: event.start || {},
            end: event.end || {},
            source: 'google',
        }))

        return NextResponse.json({ events: mapped })
    } catch (error: any) {
        console.error('Failed to fetch calendar events:', error?.message || error)

        if (error?.message === 'Google Calendar not connected') {
            return NextResponse.json({ error: 'Calendar not connected', needsAuth: true }, { status: 400 })
        }

        if (error?.message?.includes('invalid_grant') || error?.message?.includes('Token has been expired')) {
            return NextResponse.json({
                error: 'Google Calendar token expired. Please disconnect and reconnect.',
                needsAuth: true,
                tokenExpired: true,
            }, { status: 401 })
        }

        if (error?.message?.includes('Error during token refresh')) {
            return NextResponse.json({
                error: 'Google Calendar token refresh failed. Please reconnect.',
                needsAuth: true,
                tokenExpired: true,
            }, { status: 401 })
        }

        return NextResponse.json({
            error: error?.message || 'Failed to fetch Google Calendar events',
            details: error?.toString(),
        }, { status: 500 })
    }
}