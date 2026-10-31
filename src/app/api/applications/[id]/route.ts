import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  PRIORITIES,
  cleanOffsets,
  cleanStr,
  fitOf,
  parseDate,
  pickValue,
  progressOf,
} from '@/lib/applications'

// GET    /api/applications/[id] — the application, its items and file list (no file bytes)
// PATCH  /api/applications/[id] — update any field; changing the deadline re-arms reminders
// DELETE /api/applications/[id] — delete it with its items and files

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const app = await prisma.application.findFirst({
    where: { id, userId },
    include: {
      items: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      files: {
        select: { id: true, name: true, mime: true, size: true, label: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  return NextResponse.json({
    application: { ...app, progress: progressOf(app.status, app.items), fit: fitOf(app.items) },
  })
}

type Section = { id: string; title: string; body: string }
type Contact = { id: string; name: string; role?: string; email?: string; phone?: string }

function cleanSections(v: unknown): Section[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .filter((s) => s && typeof s === 'object')
    .slice(0, 30)
    .map((s, i) => ({
      id: String(s.id || `s${Date.now()}${i}`).slice(0, 40),
      title: String(s.title || '').slice(0, 120),
      body: String(s.body || '').slice(0, 10000),
    }))
}

function cleanContacts(v: unknown): Contact[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .filter((c) => c && typeof c === 'object' && String(c.name || '').trim())
    .slice(0, 30)
    .map((c, i) => ({
      id: String(c.id || `c${Date.now()}${i}`).slice(0, 40),
      name: String(c.name).trim().slice(0, 120),
      role: String(c.role || '').slice(0, 120),
      email: String(c.email || '').slice(0, 200),
      phone: String(c.phone || '').slice(0, 60),
    }))
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.application.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if ('title' in b) {
    const t = cleanStr(b.title, 160)
    if (!t) return NextResponse.json({ error: 'The name cannot be empty' }, { status: 400 })
    data.title = t
  }
  const texts: [string, number][] = [
    ['organization', 160], ['url', 500], ['location', 160], ['value', 160],
    ['summary', 5000], ['whyApply', 5000], ['notes', 20000], ['tz', 64],
  ]
  for (const [k, max] of texts) if (k in b) data[k] = cleanStr(b[k], max)

  if ('type' in b) data.type = pickValue(APPLICATION_TYPES, b.type, existing.type)
  if ('priority' in b) data.priority = pickValue(PRIORITIES, b.priority, existing.priority)
  if ('status' in b) {
    data.status = pickValue(APPLICATION_STATUSES, b.status, existing.status)
    // Stamp the day it went in, the first time it is marked submitted.
    if (data.status === 'submitted' && !existing.submittedAt) data.submittedAt = new Date()
  }
  if ('archived' in b) data.archived = !!b.archived

  for (const k of ['opensAt', 'decisionDate', 'submittedAt'] as const) {
    const d = parseDate(b[k])
    if (d !== undefined) data[k] = d
  }
  const deadline = parseDate(b.deadline)
  if (deadline !== undefined) {
    data.deadline = deadline
    // A new deadline means every reminder is owed again.
    if ((deadline?.getTime() ?? null) !== (existing.deadline?.getTime() ?? null)) data.remindersSent = ''
  }
  const offsets = cleanOffsets(b.reminderOffsets)
  if (offsets !== undefined) data.reminderOffsets = offsets

  const sections = cleanSections(b.details)
  if (sections) data.details = sections
  const contacts = cleanContacts(b.contacts)
  if (contacts) data.contacts = contacts

  const app = await prisma.application.update({ where: { id }, data })
  return NextResponse.json({ application: app })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const res = await prisma.application.deleteMany({ where: { id, userId } })
  if (!res.count) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
