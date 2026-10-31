import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { DEFAULT_ITEM_STATUS, ITEM_KINDS, ITEM_STATUSES, cleanStr, parseDate, type ItemKind } from '@/lib/applications'

// POST /api/applications/[id]/items — add a requirement, document or progress step

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const app = await prisma.application.findFirst({ where: { id, userId }, select: { id: true } })
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const kind = (ITEM_KINDS as readonly string[]).includes(b.kind) ? (b.kind as ItemKind) : null
  const label = cleanStr(b.label, 300)
  if (!kind || !label) return NextResponse.json({ error: 'A section and a label are required' }, { status: 400 })

  const status = ITEM_STATUSES[kind].some((s) => s.value === b.status) ? b.status : DEFAULT_ITEM_STATUS[kind]
  const last = await prisma.applicationItem.findFirst({
    where: { applicationId: id, kind },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const item = await prisma.applicationItem.create({
    data: {
      applicationId: id,
      userId,
      kind,
      label,
      status,
      detail: cleanStr(b.detail, 3000),
      dueDate: parseDate(b.dueDate) ?? null,
      order: (last?.order ?? -1) + 1,
    },
  })
  return NextResponse.json({ item }, { status: 201 })
}
