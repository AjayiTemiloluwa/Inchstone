import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { MAX_FILE_BYTES, cleanStr } from '@/lib/applications'

// POST /api/applications/[id]/files — upload one file (multipart: file, label?, itemId?)
// When itemId is given, the file is attached to that document item and the
// document is marked ready if it was not already.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const app = await prisma.application.findFirst({ where: { id, userId }, select: { id: true } })
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'The upload could not be read. Files must be under 4 MB.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Files must be 4 MB or smaller' }, { status: 413 })

  const created = await prisma.applicationFile.create({
    data: {
      applicationId: id,
      userId,
      name: file.name.slice(0, 200) || 'file',
      mime: file.type || 'application/octet-stream',
      size: file.size,
      label: cleanStr(form.get('label'), 120),
      data: new Uint8Array(await file.arrayBuffer()),
    },
    select: { id: true, name: true, mime: true, size: true, label: true, createdAt: true },
  })

  const itemId = form.get('itemId')
  if (typeof itemId === 'string' && itemId) {
    const item = await prisma.applicationItem.findFirst({ where: { id: itemId, applicationId: id, userId } })
    if (item) {
      await prisma.applicationItem.update({
        where: { id: item.id },
        data: { fileId: created.id, ...(item.kind === 'document' && item.status !== 'ready' ? { status: 'ready' } : {}) },
      })
    }
  }

  return NextResponse.json({ file: created }, { status: 201 })
}
