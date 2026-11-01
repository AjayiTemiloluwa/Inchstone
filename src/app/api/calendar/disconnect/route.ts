import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const row = await prisma.userToken.findUnique({ where: { userId_provider: { userId, provider: 'google' } } })
    // Revoke the grant at Google so it disappears from their connected apps.
    const token = row?.refreshToken || row?.accessToken
    if (token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {})
    }
    await prisma.userToken.deleteMany({ where: { userId, provider: 'google' } })
    // A fresh connection starts clean: no stale Google ids, no mirrored events.
    await prisma.task.updateMany({
      where: { userId, OR: [{ googleEventId: { not: null } }, { googleRecurringEventId: { not: null } }] },
      data: { googleEventId: null, googleRecurringEventId: null },
    })
    await prisma.event.deleteMany({ where: { userId, type: 'google' } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to disconnect calendar', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
