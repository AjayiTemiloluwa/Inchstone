import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/partners/[id]
 * Consent control — the owner decides, per partner, what gets shared and
 * whether sharing is on at all:
 *   · shareProgress (boolean) — master on/off
 *   · shareWhat (string[])     — the scopes that partner can see.
 *     Supported scopes:
 *       "deeds"   → today's deeds: count done / total
 *       "habits"  → today's habit completions
 *       "frog"    → whether the day's hardest task is done
 *       "week"    → this week's completion summary
 * Nothing is shared until the owner explicitly turns it on.
 */
const SHARE_SCOPES = new Set(['deeds', 'habits', 'frog', 'week'])

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { shareProgress, shareWhat } = await req.json()

    if (shareProgress !== undefined && typeof shareProgress !== 'boolean') {
      return NextResponse.json({ error: 'shareProgress (boolean) is required' }, { status: 400 })
    }
    if (shareWhat !== undefined) {
      if (!Array.isArray(shareWhat)) {
        return NextResponse.json({ error: 'shareWhat must be an array of scopes' }, { status: 400 })
      }
      for (const s of shareWhat) {
        if (!SHARE_SCOPES.has(s)) {
          return NextResponse.json({ error: `Unknown share scope: ${s}` }, { status: 400 })
        }
      }
    }

    const partner = await prisma.partner.findFirst({ where: { id, userId } })
    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

    const data: { shareProgress?: boolean; shareWhat?: string } = {}
    if (shareProgress !== undefined) data.shareProgress = shareProgress
    if (shareWhat !== undefined) {
      data.shareWhat = shareWhat.length > 0 ? shareWhat.join(',') : ''
      // Enabling scopes turns sharing on; clearing them all turns it off.
      if (!data.shareProgress && shareWhat.length > 0) data.shareProgress = true
      if (shareWhat.length === 0) data.shareProgress = false
    }

    const updated = await prisma.partner.update({ where: { id }, data })
    return NextResponse.json({ success: true, partner: updated })
  } catch (error) {
    console.error('Failed to update partner:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}