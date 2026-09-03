import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { syncGoogleEvents, getSyncState, googleConfigured } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!googleConfigured()) {
      return NextResponse.json({ needsAuth: true, needsSetup: true, events: [] })
    }

    const state = await getSyncState(userId)
    if (!state.connected) {
      return NextResponse.json({ needsAuth: true, events: [] })
    }

    const url = new URL(req.url)
    const timeMin = url.searchParams.get('timeMin')
    const timeMax = url.searchParams.get('timeMax')
    if (!timeMin || !timeMax) {
      return NextResponse.json({ error: 'timeMin and timeMax are required' }, { status: 400 })
    }

    const start = new Date(timeMin)
    const end = new Date(timeMax)
    await syncGoogleEvents(userId, start, end)

    const events = await prisma.event.findMany({
      where: {
        userId,
        type: 'google',
        startTime: { gte: start },
        endTime: { lte: end },
      },
      orderBy: { startTime: 'asc' },
    })

    return NextResponse.json({ events, mode: state.mode, lastSyncedAt: state.lastSyncedAt })
  } catch (error) {
    console.error('Failed to sync calendar events', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}