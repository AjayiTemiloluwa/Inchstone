// Learning Lab: progress rules, spaced repetition and the AI study helpers.
import { chat } from '@/lib/ai/llm'

export type Concept = { id: string; term: string; explanation: string }

// ── Unlocking and progress ───────────────────────────────────────────────────

export type SectionState = 'done' | 'open' | 'locked'

/**
 * In-order tracks unlock one section at a time: every finished one, then the
 * first unfinished, then locked. Subject tracks (inOrder false) are all open.
 */
export function sectionStates<T extends { completedAt: Date | string | null }>(sections: T[], inOrder = true): SectionState[] {
  let openGiven = false
  return sections.map((s) => {
    if (s.completedAt) return 'done'
    if (!inOrder) return 'open'
    if (!openGiven) { openGiven = true; return 'open' }
    return 'locked'
  })
}

export function trackProgress(sections: { completedAt: Date | string | null }[]) {
  const done = sections.filter((s) => s.completedAt).length
  return { done, total: sections.length, pct: sections.length ? Math.round((done / sections.length) * 100) : 0 }
}

/** Share of a section's cards that are learned (reviewed and not due again soon). */
export function mastery(cards: { reps: number; interval: number }[]) {
  if (!cards.length) return null
  const learned = cards.filter((c) => c.reps > 0 && c.interval >= 3).length
  return Math.round((learned / cards.length) * 100)
}

// ── Spaced repetition (SM-2) ─────────────────────────────────────────────────

export type Grade = 'again' | 'hard' | 'good' | 'easy'
const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 }

export function review(card: { ease: number; interval: number; reps: number; lapses: number }, grade: Grade, now = new Date()) {
  const q = QUALITY[grade]
  let { ease, interval, reps, lapses } = card
  if (q < 3) {
    reps = 0
    lapses += 1
    interval = 0
  } else {
    reps += 1
    interval = reps === 1 ? (grade === 'easy' ? 3 : 1) : reps === 2 ? (grade === 'hard' ? 3 : 6) : Math.round(Math.max(1, interval) * ease * (grade === 'hard' ? 0.8 : grade === 'easy' ? 1.3 : 1))
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  // "Again" comes back in 10 minutes; everything else in whole days.
  const due = q < 3 ? new Date(now.getTime() + 10 * 60_000) : new Date(now.getTime() + interval * 86_400_000)
  return { ease: Math.round(ease * 100) / 100, interval, reps, lapses, due, lastReview: now }
}

// ── AI helpers ───────────────────────────────────────────────────────────────

/** Pull the first JSON value out of a model reply (tolerates ```json fences and chatter). */
export function parseJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.search(/[[{]/)
  if (start < 0) return null
  for (let end = body.length; end > start; end--) {
    const ch = body[end - 1]
    if (ch !== ']' && ch !== '}') continue
    try { return JSON.parse(body.slice(start, end)) as T } catch { /* keep shrinking */ }
  }
  return null
}

async function ask(system: string, user: string, maxTokens = 1800) {
  const res = await chat([{ role: 'system', content: system }, { role: 'user', content: user }], undefined, { maxTokens })
  return res.message.content || ''
}

const TUTOR = 'You are a patient, precise tutor inside the Inchstone Learning Lab. Be accurate; if the material does not cover something, do not invent facts. Write in clear, plain English.'

export interface SourceBundle {
  track: string
  goal?: string | null
  section: string
  summary?: string | null
  concepts: Concept[]
  notes?: string | null
  materials: { title: string; kind: string; url?: string | null; content?: string | null }[]
}

function sourceText(b: SourceBundle, max = 14000) {
  const parts = [
    `Track: ${b.track}${b.goal ? ` (goal: ${b.goal})` : ''}`,
    `Section: ${b.section}`,
    b.summary ? `Section summary: ${b.summary}` : '',
    b.concepts.length ? `Key concepts:\n${b.concepts.map((c) => `- ${c.term}: ${c.explanation}`).join('\n')}` : '',
    b.notes ? `Existing notes:\n${b.notes}` : '',
    ...b.materials.map((m) => `Material "${m.title}" (${m.kind}${m.url ? `, ${m.url}` : ''}):\n${(m.content || '').slice(0, 5000)}`),
  ].filter(Boolean)
  return parts.join('\n\n').slice(0, max)
}

type OutlineSection = { title: string; summary?: string; concepts?: { term: string; explanation: string }[] }

export async function aiOutline(title: string, goal: string | null, level: string | null) {
  const prompt = `Topic: ${title}\nGoal: ${goal || 'understand it well'}\nCurrent level: ${level || 'beginner'}`
  // Free models sometimes answer with a bare array, or get cut off: accept
  // either shape, and try once more with a shorter brief before giving up.
  for (const [count, concepts] of [['5 to 8', '3 to 5'], ['5 or 6', '3']] as const) {
    const reply = await ask(
      `${TUTOR} Design a learning path. Reply with JSON only, no prose: {"sections":[{"title":"...","summary":"one sentence","concepts":[{"term":"...","explanation":"one short sentence"}]}]}. ${count} sections, ordered from foundations to advanced, ${concepts} concepts each.`,
      prompt,
      4000,
    )
    const out = parseJson<{ sections?: OutlineSection[] } | OutlineSection[]>(reply)
    const sections = (Array.isArray(out) ? out : out?.sections ?? []).filter((s) => s && typeof s.title === 'string' && s.title.trim())
    if (sections.length) return sections.slice(0, 12)
  }
  return []
}

export async function aiNotes(b: SourceBundle) {
  return ask(
    `${TUTOR} Write study notes for this section from the material given. Use short headings on their own line ending with a colon, short paragraphs and "- " bullet points. Include a worked example where it helps and end with "Remember:" and 3 key takeaways. Under 600 words. Plain text, no markdown tables.`,
    sourceText(b),
  )
}

export async function aiFlashcards(b: SourceBundle, count = 12) {
  const reply = await ask(
    `${TUTOR} Make ${count} flashcards that test understanding, not trivia. Reply with JSON only: {"cards":[{"front":"question or prompt","back":"concise answer"}]}. Fronts under 140 characters, backs under 300. No duplicates of existing cards.`,
    sourceText(b),
  )
  const out = parseJson<{ cards?: { front: string; back: string }[] }>(reply)
  return (out?.cards ?? []).filter((c) => c?.front && c?.back).slice(0, 30)
}

export async function aiConcepts(b: SourceBundle) {
  const reply = await ask(
    `${TUTOR} Pick out the key concepts a learner must know from this material. Reply with JSON only: {"concepts":[{"term":"...","explanation":"one or two sentences"}]}. 4 to 10 concepts, skip ones already listed.`,
    sourceText(b),
  )
  const out = parseJson<{ concepts?: { term: string; explanation: string }[] }>(reply)
  return (out?.concepts ?? []).filter((c) => c?.term && c?.explanation).slice(0, 12)
}

/**
 * Pull the concepts and flashcards out of the learner's own notes, using ONLY
 * what the notes say. Known terms and card fronts are passed so they are skipped.
 */
export async function aiExtract(section: string, notes: string, known: { terms: string[]; fronts: string[] }) {
  const reply = await ask(
    `${TUTOR} The learner wrote these notes for the section "${section}". Extract what they should remember, using ONLY these notes; do not add outside facts. Reply with JSON only: {"concepts":[{"term":"...","explanation":"one or two sentences, from the notes"}],"cards":[{"front":"question","back":"answer from the notes"}]}. Up to 8 concepts and up to 10 cards, fewer for short notes. Skip anything already known.`,
    `Already known concepts: ${known.terms.join(' | ') || 'none'}\nExisting cards: ${known.fronts.join(' | ') || 'none'}\n\nNotes:\n${notes.slice(0, 14000)}`,
    3000,
  )
  const out = parseJson<{ concepts?: { term: string; explanation: string }[]; cards?: { front: string; back: string }[] }>(reply)
  const terms = new Set(known.terms.map((t) => t.trim().toLowerCase()))
  const fronts = new Set(known.fronts.map((t) => t.trim().toLowerCase()))
  return {
    concepts: (out?.concepts ?? []).filter((c) => c?.term && !terms.has(String(c.term).trim().toLowerCase())).slice(0, 10),
    cards: (out?.cards ?? []).filter((c) => c?.front && c?.back && !fronts.has(String(c.front).trim().toLowerCase())).slice(0, 15),
  }
}

export const newConceptId = () => Math.random().toString(36).slice(2, 10)

/** Text we can read from an uploaded file to feed the AI (plain-text formats only). */
export function readableText(mime: string, name: string, bytes: Uint8Array): string | null {
  const textual = /^text\//.test(mime) || /\b(json|xml|csv|markdown)\b/.test(mime) || /\.(txt|md|markdown|csv|json|srt|vtt|html?)$/i.test(name)
  if (!textual) return null
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return (/\.html?$/i.test(name) ? text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ') : text)
    .replace(/\s+\n/g, '\n').slice(0, 60000)
}

export interface OrganizedSection { title: string; summary?: string; concepts?: { term: string; explanation: string }[]; excerpt?: string }

/**
 * Turn the user's own notes into sections, using ONLY that material: each
 * section gets its key concepts and the excerpt of the notes it came from.
 */
export async function aiOrganize(trackTitle: string, text: string): Promise<OrganizedSection[]> {
  const body = text.slice(0, 24000)
  for (const size of ['3 to 10', '3 to 6']) {
    const reply = await ask(
      `${TUTOR} The learner pasted their own notes. Organise ONLY this material into ordered sections; do not add facts that are not in it. Reply with JSON only: {"sections":[{"title":"...","summary":"one sentence","concepts":[{"term":"...","explanation":"from the notes, one or two sentences"}],"excerpt":"the part of the notes this section covers, copied verbatim, max 1500 characters"}]}. ${size} sections in a sensible learning order.`,
      `Track: ${trackTitle}\n\nNotes:\n${body}`,
      4000,
    )
    const out = parseJson<{ sections?: OrganizedSection[] } | OrganizedSection[]>(reply)
    const sections = (Array.isArray(out) ? out : out?.sections ?? []).filter((s) => s && typeof s.title === 'string' && s.title.trim())
    if (sections.length) return sections.slice(0, 15)
  }
  return []
}

/** "Term — meaning" / "Term: meaning" lines → concepts. */
export function conceptsFromLines(text: string): Concept[] {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.+?)\s*(?:—|–|-|:)\s+(.+)$/)
      return { id: newConceptId(), term: (m ? m[1] : l).slice(0, 120), explanation: (m ? m[2] : '').slice(0, 800) }
    })
    .slice(0, 30)
}
