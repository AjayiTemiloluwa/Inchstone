import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// GET    /api/applications/[id]/files/[fileId] — stream the file (?download=1 to save instead of open)
// DELETE /api/applications/[id]/files/[fileId] — remove it and unlink any item pointing at it

type Ctx = { params: Promise<{ id: string; fileId: string }> }

/** Types a browser can show safely inline; everything else downloads. */
const INLINE = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/plain)$/

export async function GET(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, fileId } = await params

  const file = await prisma.applicationFile.findFirst({ where: { id: fileId, applicationId: id, userId } })
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const download = new URL(req.url).searchParams.get('download') === '1' || !INLINE.test(file.mime)
  const safeName = file.name.replace(/[^\w.\- ()]/g, '_')
  return new Response(Buffer.from(file.data), {
    headers: {
      'Content-Type': INLINE.test(file.mime) ? file.mime : 'application/octet-stream',
      'Content-Length': String(file.size),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=300',
    },
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, fileId } = await params

  const res = await prisma.applicationFile.deleteMany({ where: { id: fileId, applicationId: id, userId } })
  if (!res.count) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  await prisma.applicationItem.updateMany({ where: { applicationId: id, userId, fileId }, data: { fileId: null } })
  return NextResponse.json({ deleted: true })
}
