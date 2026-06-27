import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.userToken.deleteMany({
      where: { userId, provider: 'google' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to disconnect calendar', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
