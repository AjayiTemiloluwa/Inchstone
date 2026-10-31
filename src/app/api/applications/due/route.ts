import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { DEADLINE_CLOSED, dueReminders, humanLead, parseOffsets, stampOffsets } from '@/lib/applications'

// GET  /api/applications/due — deadline reminders due right now, for the in-app alarm
// POST /api/applications/due — { id, offset } marks one delivered so the push cron skips it

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const apps = await prisma.application.findMany({
    where: {
      userId,
      archived: false,
      status: { notIn: [...DEADLINE_CLOSED] },
      deadline: { not: null, lte: new Date(now.getTime() + 15 * 86400000) },
    },
    select: { id: true, title: true, organization: true, status: true, deadline: true, reminderOffsets: true, remindersSent: true },
  })

  const due = []
  for (const a of apps) {
    const { due: off, silent } = dueReminders(a, now)
    if (silent.length) {
      await prisma.application
        .update({ where: { id: a.id }, data: { remindersSent: stampOffsets(a.remindersSent, silent) } })
        .catch(() => {})
    }
    if (off !== null) {
      due.push({ id: a.id, title: a.title, organization: a.organization, deadline: a.deadline, offset: off, message: humanLead(off) })
    }
  }
  return NextResponse.json({ due })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, offset } = await req.json().catch(() => ({}))
  const app = await prisma.application.findFirst({ where: { id: String(id || ''), userId } })
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  const off = Number(offset)
  if (!parseOffsets(app.reminderOffsets).includes(off)) return NextResponse.json({ ok: true })

  await prisma.application.update({ where: { id: app.id }, data: { remindersSent: stampOffsets(app.remindersSent, [off]) } })
  return NextResponse.json({ ok: true })
}
