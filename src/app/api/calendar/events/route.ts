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

    // Hide Google mirrors of deeds Inchstone pushed out (two-way sync): the
    // deed is already on the schedule as a Task, so its pushed Google event
    // must not reappear when the user toggles Google events on. Only events
    // that genuinely came from Google (created there) are shown.
    //  · one-shot deed  → Task.googleEventId == Event.googleEventId
    //  · recurring deed → Event.recurringEventId == Task.googleRecurringEventId
    //    (the expanded occurrence's series id; the pushed master's own id is
    //     also excluded in case Google returns it as an instance)
    const pushed = await prisma.task.findMany({
      where: {
        userId,
        OR: [{ googleEventId: { not: null } }, { googleRecurringEventId: { not: null } }],
      },
      select: { googleEventId: true, googleRecurringEventId: true },
    })
    const pushedOneShot = new Set<string>()
    const pushedRecurring = new Set<string>()
    for (const t of pushed) {
      if (t.googleEventId) pushedOneShot.add(t.googleEventId)
      if (t.googleRecurringEventId) pushedRecurring.add(t.googleRecurringEventId)
    }

    const visibleEvents =
      pushedOneShot.size === 0 && pushedRecurring.size === 0
        ? events
        : events.filter(
            e =>
              !(e.googleEventId && (pushedOneShot.has(e.googleEventId) || pushedRecurring.has(e.googleEventId))) &&
              !(e.recurringEventId && pushedRecurring.has(e.recurringEventId)),
          )

    return NextResponse.json({ events: visibleEvents, mode: state.mode, lastSyncedAt: state.lastSyncedAt })
  } catch (error) {
    console.error('Failed to sync calendar events', error)

    // Google auth failures (expired/revoked refresh token → invalid_grant,
    // 401/403 from the API) are expected states, not server bugs. Report them
    // as needsAuth so the UI can prompt a reconnect instead of a raw 500.
    const anyErr = error as { code?: number | string; response?: { status?: number }; message?: string }
    const status =
      anyErr?.response?.status ??
      (typeof anyErr?.code === 'number' ? anyErr.code : Number(anyErr?.code) || undefined)
    const msg = String(anyErr?.message || '')
    if (status === 401 || status === 403 || /invalid_grant|invalid credentials|unauthorized|expired/i.test(msg)) {
      return NextResponse.json({ needsAuth: true, events: [] })
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}