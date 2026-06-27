import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { completed } = body

    const updated = await prisma.item.update({
      where: { id, userId },
      data: { completed }
    })

    return NextResponse.json({ success: true, item: updated })
  } catch (error) {
    console.error('Failed to update item', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
