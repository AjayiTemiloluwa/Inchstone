import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { cleanStr, parseDate } from '@/lib/applications'
import { aiOutline, newConceptId, trackProgress } from '@/lib/learning'

// GET  /api/learning — every track with progress and cards due
// POST /api/learning — create a track; { outline: true } asks the AI for its sections

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tracks = await prisma.learningTrack.findMany({
    where: { userId, archived: false },
    orderBy: { updatedAt: 'desc' },
    include: { sections: { select: { id: true, title: true, completedAt: true, order: true }, orderBy: { order: 'asc' } } },
  })
  const due = await prisma.flashcard.groupBy({
    by: ['sectionId'],
    where: { userId, due: { lte: new Date() } },
    _count: { _all: true },
  })
  const dueBySection = new Map(due.map((d) => [d.sectionId, d._count._all]))
  const cards = await prisma.flashcard.groupBy({ by: ['sectionId'], where: { userId }, _count: { _all: true } })
  const cardsBySection = new Map(cards.map((d) => [d.sectionId, d._count._all]))

  return NextResponse.json({
    tracks: tracks.map(({ sections, ...t }) => ({
      ...t,
      progress: trackProgress(sections),
      current: sections.find((s) => !s.completedAt)?.title ?? null,
      cards: sections.reduce((n, s) => n + (cardsBySection.get(s.id) ?? 0), 0),
      due: sections.reduce((n, s) => n + (dueBySection.get(s.id) ?? 0), 0),
    })),
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const title = cleanStr(b.title, 160)
  if (!title) return NextResponse.json({ error: 'Name what you are learning' }, { status: 400 })

  const track = await prisma.learningTrack.create({
    data: {
      userId,
      title,
      subject: cleanStr(b.subject, 120),
      goal: cleanStr(b.goal, 1000),
      emoji: cleanStr(b.emoji, 8),
      targetDate: parseDate(b.targetDate) ?? null,
      inOrder: b.inOrder !== false,
    },
  })

  let outlined = 0
  let outlineError: string | null = null
  if (b.outline) {
    try {
      const sections = await aiOutline(title, track.goal, cleanStr(b.level, 60))
      if (sections.length) {
        await prisma.learningSection.createMany({
          data: sections.map((s, i) => ({
            trackId: track.id,
            userId,
            title: String(s.title).slice(0, 160),
            summary: s.summary ? String(s.summary).slice(0, 600) : null,
            concepts: (s.concepts ?? []).slice(0, 10).map((c) => ({ id: newConceptId(), term: String(c.term).slice(0, 120), explanation: String(c.explanation).slice(0, 600) })),
            order: i,
          })),
        })
        outlined = sections.length
      } else outlineError = 'The AI did not return an outline. Add sections yourself or try again.'
    } catch (e) {
      outlineError = e instanceof Error ? e.message : 'The AI is unavailable right now.'
    }
  }

  return NextResponse.json({ track, outlined, outlineError }, { status: 201 })
}
