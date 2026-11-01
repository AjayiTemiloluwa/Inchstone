import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { cleanStr, parseDate } from '@/lib/applications'
import { aiOrganize, conceptsFromLines, mastery, newConceptId, sectionStates, trackProgress } from '@/lib/learning'

// GET    /api/learning/[id] — the track with every section, its state (done/open/locked),
//                             materials (no file bytes), card counts and mastery
// PATCH  /api/learning/[id] — rename, change goal/subject/emoji/target, archive
// POST   /api/learning/[id] — add a section { title, summary?, concepts? ("Term — meaning" lines) } at the end,
//                             or { kind: 'organize', text } to turn the user's own notes into sections
// DELETE /api/learning/[id] — delete the track and everything in it

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const track = await prisma.learningTrack.findFirst({
    where: { id, userId },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: {
          materials: { select: { id: true, kind: true, title: true, url: true, content: true, fileName: true, mime: true, size: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
          cards: { select: { id: true, front: true, back: true, reps: true, interval: true, due: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  const states = sectionStates(track.sections)
  const now = Date.now()
  return NextResponse.json({
    track: {
      ...track,
      progress: trackProgress(track.sections),
      sections: track.sections.map((s, i) => ({
        ...s,
        state: states[i],
        mastery: mastery(s.cards),
        due: s.cards.filter((c) => new Date(c.due).getTime() <= now).length,
      })),
    },
  })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const track = await prisma.learningTrack.findFirst({ where: { id, userId } })
  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if ('title' in b) {
    const t = cleanStr(b.title, 160)
    if (!t) return NextResponse.json({ error: 'The name cannot be empty' }, { status: 400 })
    data.title = t
  }
  for (const [k, max] of [['subject', 120], ['goal', 1000], ['emoji', 8]] as const) if (k in b) data[k] = cleanStr(b[k], max)
  const target = parseDate(b.targetDate)
  if (target !== undefined) data.targetDate = target
  if ('archived' in b) data.archived = !!b.archived
  const updated = await prisma.learningTrack.update({ where: { id }, data })
  return NextResponse.json({ track: updated })
}

export async function POST(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const track = await prisma.learningTrack.findFirst({ where: { id, userId }, select: { id: true } })
  if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const last = await prisma.learningSection.findFirst({ where: { trackId: id }, orderBy: { order: 'desc' }, select: { order: true } })
  let order = (last?.order ?? -1) + 1

  if (b.kind === 'organize') {
    const text = typeof b.text === 'string' ? b.text.trim() : ''
    if (text.length < 40) return NextResponse.json({ error: 'Paste or pick more of your notes first' }, { status: 400 })
    const full = await prisma.learningTrack.findUnique({ where: { id }, select: { title: true } })
    let sections
    try { sections = await aiOrganize(full!.title, text) } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'The AI is unavailable right now' }, { status: 503 })
    }
    if (!sections.length) return NextResponse.json({ error: 'The AI could not organise these notes. Try a smaller piece.' }, { status: 502 })
    for (const s of sections) {
      const created = await prisma.learningSection.create({
        data: {
          trackId: id, userId, title: String(s.title).slice(0, 160), summary: s.summary ? String(s.summary).slice(0, 600) : null, order: order++,
          concepts: (s.concepts ?? []).slice(0, 12).map((c) => ({ id: newConceptId(), term: String(c.term).slice(0, 120), explanation: String(c.explanation ?? '').slice(0, 800) })),
        },
      })
      if (s.excerpt) await prisma.learningMaterial.create({ data: { sectionId: created.id, userId, kind: 'note', title: 'From your notes', content: String(s.excerpt).slice(0, 8000) } })
    }
    await prisma.learningTrack.update({ where: { id }, data: { completedAt: null } })
    return NextResponse.json({ added: sections.length }, { status: 201 })
  }

  const title = cleanStr(b.title, 160)
  if (!title) return NextResponse.json({ error: 'Give the section a title' }, { status: 400 })
  const section = await prisma.learningSection.create({
    data: {
      trackId: id, userId, title, summary: cleanStr(b.summary, 600), order,
      concepts: typeof b.concepts === 'string' ? conceptsFromLines(b.concepts) : [],
      notes: cleanStr(b.notes, 30000),
    },
  })
  // A new unfinished section means the track is not finished any more.
  await prisma.learningTrack.update({ where: { id }, data: { completedAt: null } })
  return NextResponse.json({ section }, { status: 201 })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const res = await prisma.learningTrack.deleteMany({ where: { id, userId } })
  if (!res.count) return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
