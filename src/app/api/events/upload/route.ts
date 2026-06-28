import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const eventId = formData.get('eventId') as string | null

    if (!file || !eventId) {
      return NextResponse.json({ error: 'file and eventId are required' }, { status: 400 })
    }

    // Verify event belongs to user
    const event = await prisma.event.findFirst({
      where: { id: eventId, userId }
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Save file to uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    const fileName = `${Date.now()}-${file.name}`
    const filePath = path.join(uploadsDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const eventFile = await prisma.eventFile.create({
      data: {
        eventId,
        userId,
        fileName: file.name,
        filePath: `/uploads/${fileName}`,
        fileSize: file.size,
      }
    })

    return NextResponse.json({ success: true, file: eventFile })
  } catch (error) {
    console.error('Failed to upload file', error)
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

    await prisma.eventFile.deleteMany({
      where: { id, userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete file', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
