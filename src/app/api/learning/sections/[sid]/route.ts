import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { cleanStr, MAX_FILE_BYTES } from '@/lib/applications'
import { aiConcepts, aiExtract, aiFlashcards, aiNotes, newConceptId, readableText, sectionStates, type Concept } from '@/lib/learning'

// PATCH  /api/learning/sections/[sid] — title, summary, concepts, notes; { complete: true|false }
//                                       finishes it (only when unlocked) or reopens it
// POST   /api/learning/sections/[sid] — add to the section:
//          JSON { kind: 'note', title, content } | { kind: 'link', title, url }
//          JSON { kind: 'card', front, back }
//          JSON { kind: 'ai', task: 'notes' | 'flashcards' | 'concepts' }
//          JSON { kind: 'ai', task: 'extract', materialId? } — concepts + cards from one note, or every note not yet extracted
//          multipart { file, title? } — a file (text formats are read for the AI)
// DELETE /api/learning/sections/[sid]

export const runtime = 'nodejs'
export const maxDuration = 60

type Ctx = { params: Promise<{ sid: string }> }

async function ownSection(sid: string, userId: string) {
  return prisma.learningSection.findFirst({ where: { id: sid, userId }, include: { track: true } })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { sid } = await params
  const section = await ownSection(sid, userId)
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if ('title' in b) {
    const t = cleanStr(b.title, 160)
    if (!t) return NextResponse.json({ error: 'The title cannot be empty' }, { status: 400 })
    data.title = t
  }
  if ('summary' in b) data.summary = cleanStr(b.summary, 600)
  if ('notes' in b) data.notes = cleanStr(b.notes, 30000)
  if (Array.isArray(b.concepts)) {
    data.concepts = (b.concepts as Partial<Concept>[])
      .filter((c) => c && String(c.term || '').trim())
      .slice(0, 30)
      .map((c) => ({ id: String(c.id || newConceptId()).slice(0, 20), term: String(c.term).trim().slice(0, 120), explanation: String(c.explanation || '').slice(0, 800) }))
  }

  if (b.move === 'up' || b.move === 'down') {
    const siblings = await prisma.learningSection.findMany({ where: { trackId: section.trackId }, orderBy: { order: 'asc' }, select: { id: true } })
    const idx = siblings.findIndex((s) => s.id === sid)
    const to = b.move === 'up' ? idx - 1 : idx + 1
    if (to >= 0 && to < siblings.length) {
      const ids = siblings.map((s) => s.id)
      ;[ids[idx], ids[to]] = [ids[to], ids[idx]]
      await prisma.$transaction(ids.map((x, i) => prisma.learningSection.update({ where: { id: x }, data: { order: i } })))
    }
    return NextResponse.json({ moved: true })
  }

  let unlocked: string | null = null
  let trackDone = false
  if ('complete' in b) {
    const siblings = await prisma.learningSection.findMany({ where: { trackId: section.trackId }, orderBy: { order: 'asc' }, select: { id: true, title: true, completedAt: true } })
    const states = sectionStates(siblings, section.track.inOrder)
    const idx = siblings.findIndex((s) => s.id === sid)
    if (b.complete) {
      if (states[idx] === 'locked') return NextResponse.json({ error: 'Finish the sections before this one first' }, { status: 409 })
      data.completedAt = new Date()
      unlocked = siblings.slice(idx + 1).find((s) => !s.completedAt)?.title ?? null
      trackDone = siblings.every((s, i) => i === idx || s.completedAt)
    } else {
      data.completedAt = null
    }
  }

  const updated = await prisma.learningSection.update({ where: { id: sid }, data })
  await prisma.learningTrack.update({
    where: { id: section.trackId },
    data: 'complete' in b ? { completedAt: trackDone ? new Date() : null } : {},
  })
  return NextResponse.json({ section: updated, unlocked, trackDone })
}

export async function POST(req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { sid } = await params
  const section = await ownSection(sid, userId)
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  // File upload
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'Choose a file' }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Files must be 4 MB or smaller' }, { status: 413 })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const material = await prisma.learningMaterial.create({
      data: {
        sectionId: sid, userId, kind: 'file',
        title: cleanStr(form?.get('title'), 160) || file.name.slice(0, 160),
        fileName: file.name.slice(0, 200), mime: file.type || 'application/octet-stream', size: file.size,
        content: readableText(file.type, file.name, bytes), data: bytes,
      },
      select: { id: true, kind: true, title: true, fileName: true, mime: true, size: true, content: true, createdAt: true },
    })
    return NextResponse.json({ material: { ...material, readable: !!material.content, content: undefined } }, { status: 201 })
  }

  const b = await req.json().catch(() => ({}))

  if (b.kind === 'note' || b.kind === 'link') {
    const title = cleanStr(b.title, 160) || (b.kind === 'link' ? cleanStr(b.url, 160) : null)
    if (!title) return NextResponse.json({ error: 'Give it a title' }, { status: 400 })
    if (b.kind === 'link' && !cleanStr(b.url, 1000)) return NextResponse.json({ error: 'Add the link' }, { status: 400 })
    const material = await prisma.learningMaterial.create({
      data: { sectionId: sid, userId, kind: b.kind, title, url: cleanStr(b.url, 1000), content: cleanStr(b.content, 60000) },
      select: { id: true, kind: true, title: true, url: true, content: true, createdAt: true },
    })
    return NextResponse.json({ material }, { status: 201 })
  }

  if (b.kind === 'card') {
    const front = cleanStr(b.front, 500), back = cleanStr(b.back, 1500)
    if (!front || !back) return NextResponse.json({ error: 'A card needs a front and a back' }, { status: 400 })
    const card = await prisma.flashcard.create({ data: { sectionId: sid, userId, front, back } })
    return NextResponse.json({ card }, { status: 201 })
  }

  if (b.kind === 'ai' && b.task === 'extract') {
    const notes = await prisma.learningMaterial.findMany({
      where: { sectionId: sid, kind: { in: ['note', 'file'] }, content: { not: null }, ...(b.materialId ? { id: String(b.materialId) } : { extractedAt: null }) },
      select: { id: true, title: true, content: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!notes.length) return NextResponse.json({ error: b.materialId ? 'That note has no text to read' : 'Every note is already extracted. Write a new one, or extract a single note again.' }, { status: 400 })
    const concepts = (section.concepts as unknown as Concept[]) ?? []
    const existing = await prisma.flashcard.findMany({ where: { sectionId: sid }, select: { front: true } })
    let found
    try {
      found = await aiExtract(section.title, notes.map((n) => `# ${n.title}\n${n.content}`).join('\n\n'), { terms: concepts.map((c) => c.term), fronts: existing.map((c) => c.front) })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'The AI is unavailable right now' }, { status: 503 })
    }
    if (!found.concepts.length && !found.cards.length) return NextResponse.json({ error: 'Nothing new came out of these notes. Add more detail and try again.' }, { status: 502 })
    await prisma.$transaction([
      prisma.learningSection.update({
        where: { id: sid },
        data: { concepts: [...concepts, ...found.concepts.map((c) => ({ id: newConceptId(), term: String(c.term).slice(0, 120), explanation: String(c.explanation ?? '').slice(0, 800) }))].slice(0, 60) },
      }),
      prisma.flashcard.createMany({ data: found.cards.map((c) => ({ sectionId: sid, userId, front: String(c.front).slice(0, 500), back: String(c.back).slice(0, 1500) })) }),
      prisma.learningMaterial.updateMany({ where: { id: { in: notes.map((n) => n.id) } }, data: { extractedAt: new Date() } }),
    ])
    return NextResponse.json({ concepts: found.concepts.length, cards: found.cards.length, notes: notes.length })
  }

  if (b.kind === 'ai') {
    const materials = await prisma.learningMaterial.findMany({ where: { sectionId: sid }, select: { title: true, kind: true, url: true, content: true } })
    const concepts = (section.concepts as unknown as Concept[]) ?? []
    const bundle = { track: section.track.title, goal: section.track.goal, section: section.title, summary: section.summary, concepts, notes: section.notes, materials }
    try {
      if (b.task === 'notes') {
        const notes = (await aiNotes(bundle)).trim()
        if (!notes) return NextResponse.json({ error: 'The AI returned nothing. Try again.' }, { status: 502 })
        await prisma.learningSection.update({ where: { id: sid }, data: { notes: notes.slice(0, 30000) } })
        return NextResponse.json({ notes })
      }
      if (b.task === 'flashcards') {
        const existing = await prisma.flashcard.findMany({ where: { sectionId: sid }, select: { front: true } })
        const have = new Set(existing.map((c) => c.front.trim().toLowerCase()))
        const cards = (await aiFlashcards({ ...bundle, notes: `${bundle.notes ?? ''}\nExisting cards: ${existing.map((c) => c.front).join(' | ')}` }))
          .filter((c) => !have.has(String(c.front).trim().toLowerCase()))
        if (!cards.length) return NextResponse.json({ error: 'No new cards came back. Add more material and try again.' }, { status: 502 })
        await prisma.flashcard.createMany({ data: cards.map((c) => ({ sectionId: sid, userId, front: String(c.front).slice(0, 500), back: String(c.back).slice(0, 1500) })) })
        return NextResponse.json({ added: cards.length })
      }
      if (b.task === 'concepts') {
        const known = new Set(concepts.map((c) => c.term.toLowerCase()))
        const fresh = (await aiConcepts(bundle)).filter((c) => !known.has(String(c.term).toLowerCase()))
        const next = [...concepts, ...fresh.map((c) => ({ id: newConceptId(), term: String(c.term).slice(0, 120), explanation: String(c.explanation).slice(0, 800) }))]
        await prisma.learningSection.update({ where: { id: sid }, data: { concepts: next } })
        return NextResponse.json({ added: fresh.length })
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'The AI is unavailable right now' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unknown AI task' }, { status: 400 })
  }

  return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { sid } = await params
  const res = await prisma.learningSection.deleteMany({ where: { id: sid, userId } })
  if (!res.count) return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
