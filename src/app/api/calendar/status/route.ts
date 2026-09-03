import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSyncState, googleConfigured } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!googleConfigured()) {
      return NextResponse.json({ configured: false, connected: false, mode: null, lastSyncedAt: null })
    }

    const state = await getSyncState(userId)
    return NextResponse.json({ configured: true, ...state })
  } catch (error) {
    console.error('Failed to check calendar status', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}