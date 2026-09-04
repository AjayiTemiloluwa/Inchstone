import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { seedYearFramework } from '@/lib/framework'

/**
 * POST /api/seed — power-tool fallback (Settings → Danger zone): creates the
 * full framework for the CURRENT year, whatever the day is. Regular users
 * never need this — the framework is provisioned automatically on first data
 * load (GET /api/items) — but the explicit endpoint stays for reset flows
 * and manual recovery.
 */
export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has items
    const existing = await prisma.item.findFirst({ where: { userId } })
    if (existing) {
      return NextResponse.json({ error: 'Framework already seeded' }, { status: 400 })
    }

    // The framework always matches the year the day is in — never a
    // hardcoded year (the old route pinned everything to 2026).
    await seedYearFramework(userId, new Date().getFullYear())

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to seed', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
