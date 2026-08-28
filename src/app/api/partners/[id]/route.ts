import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/partners/[id]  { shareProgress }
 * Consent switch — the owner decides, per partner, whether to share their
 * live progress. Nothing is shared until they explicitly turn this on.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { shareProgress } = await req.json()
    if (typeof shareProgress !== 'boolean') {
      return NextResponse.json({ error: 'shareProgress (boolean) is required' }, { status: 400 })
    }

    const partner = await prisma.partner.findFirst({ where: { id, userId } })
    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

    const updated = await prisma.partner.update({
      where: { id },
      data: { shareProgress },
    })
    return NextResponse.json({ success: true, partner: updated })
  } catch (error) {
    console.error('Failed to update partner:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}