import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const categories = await prisma.userCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Failed to fetch categories', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, color, icon } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const category = await prisma.userCategory.create({
      data: {
        userId,
        name,
        color: color || '#D4AF37',
        icon: icon || 'folder',
      }
    })

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error('Failed to create category', error)
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

    await prisma.userCategory.deleteMany({
      where: { id, userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete category', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
