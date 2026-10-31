import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  DEFAULT_ITEM_STATUS,
  PRIORITIES,
  cleanOffsets,
  cleanStr as str,
  fitOf,
  parseDate,
  pickValue as pick,
  progressOf,
  starterItemsFor,
} from '@/lib/applications'

// GET  /api/applications — every application with its progress, fit and counts
// POST /api/applications — create one; seeds a starter checklist for its type unless `starter: false`

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const archived = new URL(req.url).searchParams.get('archived') === '1'
  const apps = await prisma.application.findMany({
    where: { userId, archived },
    orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: {
      items: { select: { kind: true, status: true } },
      _count: { select: { files: true } },
    },
  })

  return NextResponse.json({
    applications: apps.map(({ items, _count, ...a }) => ({
      ...a,
      progress: progressOf(a.status, items),
      fit: fitOf(items),
      fileCount: _count.files,
      docs: {
        total: items.filter((i) => i.kind === 'document').length,
        ready: items.filter((i) => i.kind === 'document' && i.status === 'ready').length,
      },
      steps: {
        total: items.filter((i) => i.kind === 'step').length,
        done: items.filter((i) => i.kind === 'step' && i.status === 'done').length,
      },
    })),
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const title = str(body.title, 160)
  if (!title) return NextResponse.json({ error: 'Give the application a name' }, { status: 400 })

  const type = pick(APPLICATION_TYPES, body.type, 'other')
  const offsets = cleanOffsets(body.reminderOffsets)

  const app = await prisma.application.create({
    data: {
      userId,
      title,
      type,
      status: pick(APPLICATION_STATUSES, body.status, 'researching'),
      priority: pick(PRIORITIES, body.priority, 'medium'),
      organization: str(body.organization, 160),
      url: str(body.url, 500),
      location: str(body.location, 160),
      value: str(body.value, 160),
      summary: str(body.summary, 5000),
      deadline: parseDate(body.deadline) ?? null,
      opensAt: parseDate(body.opensAt) ?? null,
      decisionDate: parseDate(body.decisionDate) ?? null,
      tz: str(body.tz, 64),
      ...(offsets !== undefined ? { reminderOffsets: offsets } : {}),
    },
  })

  if (body.starter !== false) {
    await prisma.applicationItem.createMany({
      data: starterItemsFor(type).map((s, i) => ({
        applicationId: app.id,
        userId,
        kind: s.kind,
        label: s.label,
        status: DEFAULT_ITEM_STATUS[s.kind],
        order: i,
      })),
    })
  }

  return NextResponse.json({ application: app }, { status: 201 })
}
