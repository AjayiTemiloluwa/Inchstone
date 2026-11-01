import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { cleanStr } from '@/lib/applications'
import { review, type Grade } from '@/lib/learning'

// /api/learning/items/material/[id]  GET (download/open the file) · DELETE
// /api/learning/items/material/[id]  PATCH { title?, content? } (edit a written note)
// /api/learning/items/card/[id]      PATCH { grade } (review) or { front, back } (edit) · DELETE

type Ctx = { params: Promise<{ kind: string; itemId: string }> }
const INLINE = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/plain)$/

export async function GET(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { kind, itemId } = await params
  if (kind !== 'material') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const m = await prisma.learningMaterial.findFirst({ where: { id: itemId, userId } })
  if (!m?.data) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  const mime = m.mime || 'application/octet-stream'
  const download = new URL(req.url).searchParams.get('download') === '1' || !INLINE.test(mime)
  const name = m.fileName || m.title
  return new Response(Buffer.from(m.data), {
    headers: {
      'Content-Type': INLINE.test(mime) ? mime : 'application/octet-stream',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name.replace(/[^\w.\- ()]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=300',
    },
  })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { kind, itemId } = await params
  if (kind === 'material') {
    const m = await prisma.learningMaterial.findFirst({ where: { id: itemId, userId, kind: 'note' } })
    if (!m) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    const b = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if ('title' in b) data.title = cleanStr(b.title, 160) || m.title
    if ('content' in b) { data.content = cleanStr(b.content, 60000); data.extractedAt = null }
    const updated = await prisma.learningMaterial.update({ where: { id: m.id }, data, select: { id: true, title: true, content: true, extractedAt: true, updatedAt: true } })
    return NextResponse.json({ material: updated })
  }
  if (kind !== 'card') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const card = await prisma.flashcard.findFirst({ where: { id: itemId, userId } })
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  const b = await req.json().catch(() => ({}))

  if (['again', 'hard', 'good', 'easy'].includes(b.grade)) {
    const next = review(card, b.grade as Grade)
    const updated = await prisma.flashcard.update({ where: { id: card.id }, data: next })
    return NextResponse.json({ card: updated })
  }
  const front = cleanStr(b.front, 500), back = cleanStr(b.back, 1500)
  if (!front || !back) return NextResponse.json({ error: 'A card needs a front and a back' }, { status: 400 })
  const updated = await prisma.flashcard.update({ where: { id: card.id }, data: { front, back } })
  return NextResponse.json({ card: updated })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { kind, itemId } = await params
  const res = kind === 'card'
    ? await prisma.flashcard.deleteMany({ where: { id: itemId, userId } })
    : kind === 'material'
      ? await prisma.learningMaterial.deleteMany({ where: { id: itemId, userId } })
      : { count: 0 }
  if (!res.count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
