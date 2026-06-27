import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const partnerLinks = await prisma.partnerLink.findMany({
      where: {
        item: { userId }
      },
      include: {
        partner: { select: { id: true, name: true, role: true } },
        item: { select: { id: true, title: true, layer: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ partnerLinks })
  } catch (error) {
    console.error('Failed to fetch partner links', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { itemId, partnerId } = body

    if (!itemId || !partnerId) {
      return NextResponse.json({ error: 'itemId and partnerId are required' }, { status: 400 })
    }

    // Verify the item belongs to the user
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId }
    })
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify the partner belongs to the user
    const partner = await prisma.partner.findFirst({
      where: { id: partnerId, userId }
    })
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const link = await prisma.partnerLink.create({
      data: { itemId, partnerId }
    })

    return NextResponse.json({ success: true, link })
  } catch (error) {
    console.error('Failed to create partner link', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Verify ownership through the item
    const link = await prisma.partnerLink.findUnique({
      where: { id },
      include: { item: { select: { userId: true } } }
    })

    if (!link || link.item.userId !== userId) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    await prisma.partnerLink.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete partner link', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
