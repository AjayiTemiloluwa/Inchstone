import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const requested = body?.mode === 'two' ? 'two' : (body?.mode === 'pull' ? 'pull' : null)
    if (!requested) {
      return NextResponse.json({ error: 'mode is required ("pull" | "two")' }, { status: 400 })
    }

    const row = await prisma.userToken.findUnique({
      where: { userId_provider: { userId, provider: 'google' } },
    })
    if (!row) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
    }

    if (requested === 'pull') {
      // Downgrade applies instantly — the write token just stops being used.

      await prisma.userToken.update({
        where: { id: row.id },
        data: { syncMode: 'pull' },
      })
      return NextResponse.json({ ok: true, mode: 'pull' })
    }

    // Upgrade to two-way — needs write scope. If the stored grant already includes
    // calendar.events (e.g. a previous two-way grant), apply instantly; else
    // the client must re-auth to obtain write permission.

    const hasWriteScope = (row.scopes || '').includes('calendar.events')
    if (hasWriteScope) {
      await prisma.userToken.update({
        where: { id: row.id },
        data: { syncMode: 'two' },
      })
      return NextResponse.json({ ok: true, mode: 'two' })
    }

    return NextResponse.json({ ok: false, needsReauth: true })
  } catch (error) {
    console.error('Failed to switch calendar mode', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}