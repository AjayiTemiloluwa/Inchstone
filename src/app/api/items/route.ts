import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch all items for the user
    const items = await prisma.item.findMany({
      where: { userId },
      orderBy: [
        { layer: 'asc' },
        { startDate: 'asc' }
      ]
    })

    const categories = await prisma.userCategory.findMany({
      where: { userId }
    })

    return NextResponse.json({ items, categories })
  } catch (error) {
    console.error('Failed to fetch items', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
