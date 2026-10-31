import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { ITEM_STATUSES, cleanStr, parseDate, type ItemKind } from '@/lib/applications'

// PATCH  /api/applications/[id]/items/[itemId] — edit label, detail, status, due date or linked file
// DELETE /api/applications/[id]/items/[itemId]

type Ctx = { params: Promise<{ id: string; itemId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, itemId } = await params

  const item = await prisma.applicationItem.findFirst({ where: { id: itemId, applicationId: id, userId } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if ('label' in b) {
    const l = cleanStr(b.label, 300)
    if (!l) return NextResponse.json({ error: 'The label cannot be empty' }, { status: 400 })
    data.label = l
  }
  if ('detail' in b) data.detail = cleanStr(b.detail, 3000)
  if ('status' in b) {
    const allowed = ITEM_STATUSES[item.kind as ItemKind] ?? []
    if (!allowed.some((s) => s.value === b.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    data.status = b.status
  }
  const due = parseDate(b.dueDate)
  if (due !== undefined) data.dueDate = due
  if ('fileId' in b) {
    if (b.fileId === null) data.fileId = null
    else {
      const file = await prisma.applicationFile.findFirst({ where: { id: String(b.fileId), applicationId: id, userId }, select: { id: true } })
      if (!file) return NextResponse.json({ error: 'File not found' }, { status: 400 })
      data.fileId = file.id
    }
  }

  const updated = await prisma.applicationItem.update({ where: { id: itemId }, data })
  return NextResponse.json({ item: updated })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, itemId } = await params

  const res = await prisma.applicationItem.deleteMany({ where: { id: itemId, applicationId: id, userId } })
  if (!res.count) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
