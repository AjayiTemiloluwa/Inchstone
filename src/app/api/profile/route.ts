import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/profile — upserts the caller's lightweight identity row
 * (Clerk userId ↔ email). Powers partner discovery by email, which unlocks
 * real-time linking, messaging and consent-based progress sharing.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
    if (!email) return NextResponse.json({ profile: null })

    const name = user?.firstName || user?.username || null
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: { email, name },
      create: { userId, email, name },
    })
    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Failed to load profile:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}