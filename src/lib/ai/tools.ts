// Tools the assistant can call (server only). Every executor is scoped to the
// signed-in user and validates its arguments the same way the API routes do.
import prisma from '@/lib/prisma'
import {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  DEFAULT_ITEM_STATUS,
  ITEM_KINDS,
  ITEM_STATUSES,
  PRIORITIES,
  REMINDER_CHOICES,
  fitOf,
  pickValue,
  progressOf,
  starterItemsFor,
  type ItemKind,
} from '@/lib/applications'
import type { ToolSpec } from './llm'

export interface ToolCtx {
  userId: string
  /** The viewer's getTimezoneOffset(), to read "2027-01-15T14:00" as their wall clock. */
  tzOffset: number
}

export interface Tool {
  spec: ToolSpec
  /** Changes data: the page reloads after the reply. */
  mutates: boolean
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<{ result: unknown; summary?: string }>
}

const s = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x, 300)).filter((x): x is string => !!x).slice(0, 40) : [])

/** "2027-01-15", "2027-01-15T14:00" (viewer's clock) or a full ISO instant. */
function when(v: unknown, tzOffset: number, endOfDay = true): Date | null | undefined {
  if (v === null || v === '') return null
  const t = s(v, 40)
  if (!t) return undefined
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(t)) {
    const d = new Date(t)
    return isNaN(d.getTime()) ? undefined : d
  }
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/)
  if (!m) return undefined
  const h = m[4] ? +m[4] : endOfDay ? 23 : 0
  const mi = m[5] ? +m[5] : endOfDay && !m[4] ? 59 : 0
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], h, mi) + tzOffset * 60_000)
}

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolSpec => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
})

const str = (description: string) => ({ type: 'string', description })
const strList = (description: string) => ({ type: 'array', items: { type: 'string' }, description })
const enumOf = (values: readonly { value: string }[], description: string) => ({ type: 'string', enum: values.map((v) => v.value), description })

const APP_FIELDS = {
  title: str('Name of the opportunity, e.g. "Chevening Scholarship 2027"'),
  organization: str('Who runs it'),
  type: enumOf(APPLICATION_TYPES, 'Kind of application'),
  status: enumOf(APPLICATION_STATUSES, 'Stage in the pipeline'),
  priority: enumOf(PRIORITIES, 'How important it is'),
  deadline: str('Closing date in the user\'s local time: "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"'),
  opens_at: str('Opening date "YYYY-MM-DD"'),
  decision_date: str('When results are expected "YYYY-MM-DD"'),
  url: str('Application portal link'),
  location: str('City/country or Remote'),
  value: str('What it is worth: funding, salary, benefits'),
  summary: str('What the opportunity is about, 1-4 sentences'),
  why_apply: str('The user\'s motivation and fit'),
  notes: str('Free notes'),
}

async function findApp(userId: string, ref: unknown) {
  const r = s(ref, 200)
  if (!r) return null
  return (
    (await prisma.application.findFirst({ where: { id: r, userId } })) ??
    (await prisma.application.findFirst({ where: { userId, title: { equals: r, mode: 'insensitive' } } })) ??
    (await prisma.application.findFirst({ where: { userId, title: { contains: r, mode: 'insensitive' } }, orderBy: { updatedAt: 'desc' } }))
  )
}

function appData(a: Record<string, unknown>, tzOffset: number) {
  const data: Record<string, unknown> = {}
  for (const [k, max] of [['title', 160], ['organization', 160], ['url', 500], ['location', 160], ['value', 160], ['summary', 5000], ['notes', 20000]] as const) {
    const v = s(a[k], max)
    if (v) data[k] = v
  }
  const why = s(a.why_apply, 5000)
  if (why) data.whyApply = why
  if (a.type) data.type = pickValue(APPLICATION_TYPES, a.type, 'other')
  if (a.status) data.status = pickValue(APPLICATION_STATUSES, a.status, 'researching')
  if (a.priority) data.priority = pickValue(PRIORITIES, a.priority, 'medium')
  const deadline = when(a.deadline, tzOffset, true)
  if (deadline !== undefined) data.deadline = deadline
  const opens = when(a.opens_at, tzOffset, false)
  if (opens !== undefined) data.opensAt = opens
  const decision = when(a.decision_date, tzOffset, false)
  if (decision !== undefined) data.decisionDate = decision
  return data
}

async function addItems(userId: string, applicationId: string, kind: ItemKind, labels: string[]) {
  if (!labels.length) return 0
  const existing = await prisma.applicationItem.findMany({ where: { applicationId }, select: { kind: true, label: true, order: true } })
  const have = new Set(existing.map((i) => `${i.kind}:${i.label.toLowerCase()}`))
  const fresh = labels.filter((l) => !have.has(`${kind}:${l.toLowerCase()}`))
  const base = existing.reduce((m, i) => Math.max(m, i.order), -1) + 1
  if (fresh.length) {
    await prisma.applicationItem.createMany({
      data: fresh.map((label, n) => ({ applicationId, userId, kind, label, status: DEFAULT_ITEM_STATUS[kind], order: base + n })),
    })
  }
  return fresh.length
}

// ── Application Tracker tools ────────────────────────────────────────────────

export const APPLICATION_TOOLS: Tool[] = [
  {
    mutates: false,
    spec: fn('list_applications', 'List the user\'s tracked applications with stage, deadline, progress and fit.', {
      include_closed: { type: 'boolean', description: 'Include submitted and decided ones (default true)' },
    }),
    async run(a, { userId }) {
      const apps = await prisma.application.findMany({
        where: { userId, archived: false },
        orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }],
        include: { items: { select: { kind: true, status: true } } },
        take: 60,
      })
      const rows = apps
        .filter((x) => a.include_closed !== false || !['submitted', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn'].includes(x.status))
        .map((x) => ({
          id: x.id, title: x.title, organization: x.organization, type: x.type, status: x.status, priority: x.priority,
          deadline: x.deadline?.toISOString() ?? null, progress: progressOf(x.status, x.items), fit: fitOf(x.items).pct,
        }))
      return { result: rows }
    },
  },
  {
    mutates: false,
    spec: fn('get_application', 'Full details of one application: fields, requirements, documents, steps (with ids and statuses), contacts and custom sections.', {
      application: str('Application id or name'),
    }, ['application']),
    async run(a, { userId }) {
      const app = await findApp(userId, a.application)
      if (!app) return { result: { error: 'No application with that name or id' } }
      const items = await prisma.applicationItem.findMany({ where: { applicationId: app.id }, orderBy: [{ kind: 'asc' }, { order: 'asc' }] })
      const files = await prisma.applicationFile.findMany({ where: { applicationId: app.id }, select: { name: true, label: true } })
      return {
        result: {
          ...app,
          remindersSent: undefined,
          progress: progressOf(app.status, items),
          fit: fitOf(items),
          items: items.map((i) => ({ id: i.id, kind: i.kind, label: i.label, status: i.status, detail: i.detail })),
          files,
        },
      }
    },
  },
  {
    mutates: true,
    spec: fn('create_application', 'Add a new application to the tracker. Include requirements, documents and steps when known; otherwise a starter checklist for its type is added.', {
      ...APP_FIELDS,
      requirements: strList('Eligibility criteria, one per entry'),
      documents: strList('Documents/materials needed'),
      steps: strList('Steps to complete'),
    }, ['title']),
    async run(a, { userId, tzOffset }) {
      const data = appData(a, tzOffset)
      if (!data.title) return { result: { error: 'title is required' } }
      const app = await prisma.application.create({ data: { userId, ...(data as { title: string }) } })
      const given = { eligibility: list(a.requirements), document: list(a.documents), step: list(a.steps) }
      let added = 0
      if (given.eligibility.length + given.document.length + given.step.length) {
        for (const k of ITEM_KINDS) added += await addItems(userId, app.id, k, given[k])
      } else {
        const starters = starterItemsFor(app.type)
        for (const k of ITEM_KINDS) added += await addItems(userId, app.id, k, starters.filter((x) => x.kind === k).map((x) => x.label))
      }
      return { result: { id: app.id, title: app.title, items_added: added }, summary: `Added "${app.title}"` }
    },
  },
  {
    mutates: true,
    spec: fn('update_application', 'Change fields of an existing application (stage, deadline, link, summary...). Only send fields to change.', {
      application: str('Application id or name'),
      ...APP_FIELDS,
    }, ['application']),
    async run(a, { userId, tzOffset }) {
      const app = await findApp(userId, a.application)
      if (!app) return { result: { error: 'No application with that name or id' } }
      const data = appData(a, tzOffset)
      if (data.status === 'submitted' && !app.submittedAt) data.submittedAt = new Date()
      if ('deadline' in data && (data.deadline as Date | null)?.getTime() !== app.deadline?.getTime()) data.remindersSent = ''
      if (!Object.keys(data).length) return { result: { error: 'Nothing to change' } }
      await prisma.application.update({ where: { id: app.id }, data })
      return { result: { id: app.id, changed: Object.keys(data) }, summary: `Updated "${app.title}"` }
    },
  },
  {
    mutates: true,
    spec: fn('add_checklist_items', 'Add requirements (eligibility), documents or steps to an application. Duplicates are skipped.', {
      application: str('Application id or name'),
      kind: { type: 'string', enum: [...ITEM_KINDS], description: 'eligibility = requirement, document = something to prepare, step = progress step' },
      labels: strList('The items to add'),
    }, ['application', 'kind', 'labels']),
    async run(a, { userId }) {
      const app = await findApp(userId, a.application)
      if (!app) return { result: { error: 'No application with that name or id' } }
      const kind = (ITEM_KINDS as readonly string[]).includes(String(a.kind)) ? (a.kind as ItemKind) : null
      if (!kind) return { result: { error: 'kind must be eligibility, document or step' } }
      const n = await addItems(userId, app.id, kind, list(a.labels))
      return { result: { added: n }, summary: `Added ${n} item${n === 1 ? '' : 's'} to "${app.title}"` }
    },
  },
  {
    mutates: true,
    spec: fn('set_item_status', 'Mark a checklist item. eligibility: met|partial|unmet|unknown. document: todo|drafting|ready. step: todo|done. Get item ids from get_application.', {
      item_id: str('The item id'),
      status: str('New status'),
    }, ['item_id', 'status']),
    async run(a, { userId }) {
      const item = await prisma.applicationItem.findFirst({ where: { id: s(a.item_id, 60) ?? '', userId } })
      if (!item) return { result: { error: 'Item not found' } }
      const allowed = ITEM_STATUSES[item.kind as ItemKind]?.map((x) => x.value) ?? []
      if (!allowed.includes(String(a.status))) return { result: { error: `status must be one of ${allowed.join(', ')}` } }
      await prisma.applicationItem.update({ where: { id: item.id }, data: { status: String(a.status) } })
      return { result: { ok: true }, summary: `Marked "${item.label}" ${a.status}` }
    },
  },
  {
    mutates: true,
    spec: fn('set_deadline_reminders', 'Choose when the deadline alarm fires, as minutes before the deadline.', {
      application: str('Application id or name'),
      minutes_before: { type: 'array', items: { type: 'integer', enum: REMINDER_CHOICES.map((c) => c.minutes) }, description: '20160=2 weeks, 10080=1 week, 4320=3 days, 1440=1 day, 180=3 hours, 60=1 hour, 0=at the deadline' },
    }, ['application', 'minutes_before']),
    async run(a, { userId }) {
      const app = await findApp(userId, a.application)
      if (!app) return { result: { error: 'No application with that name or id' } }
      const allowed = new Set<number>(REMINDER_CHOICES.map((c) => c.minutes))
      const mins = Array.isArray(a.minutes_before) ? [...new Set(a.minutes_before.map(Number).filter((m) => allowed.has(m)))].sort((x, y) => y - x) : []
      await prisma.application.update({ where: { id: app.id }, data: { reminderOffsets: mins.join(',') } })
      return { result: { reminders: mins }, summary: `Reminders set for "${app.title}"` }
    },
  },
]

// ── Notes tools ──────────────────────────────────────────────────────────────

const toHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('')
const toText = (html: string) => html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

export const NOTE_TOOLS: Tool[] = [
  {
    mutates: false,
    spec: fn('search_notes', 'Find the user\'s notes by words in the title or body. Returns the most recent matches.', {
      query: str('Words to look for; empty for the latest notes'),
    }),
    async run(a, { userId }) {
      const q = s(a.query, 100)
      const notes = await prisma.note.findMany({
        where: { userId, ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }] } : {}) },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { id: true, title: true, content: true, updatedAt: true },
      })
      return { result: notes.map((n) => ({ id: n.id, title: n.title, text: toText(n.content).slice(0, 1200), updated: n.updatedAt })) }
    },
  },
  {
    mutates: true,
    spec: fn('create_note', 'Save a new note for the user (drafts, essay outlines, summaries).', {
      title: str('Note title'),
      content: str('Note body as plain text; blank lines separate paragraphs'),
    }, ['title', 'content']),
    async run(a, { userId }) {
      const title = s(a.title, 200)
      const content = s(a.content, 20000)
      if (!title || !content) return { result: { error: 'title and content are required' } }
      const note = await prisma.note.create({ data: { userId, title, content: toHtml(content) } })
      return { result: { id: note.id }, summary: `Saved note "${title}"` }
    },
  },
]

export type AssistantContext = 'applications' | 'general'

export function toolsFor(context: AssistantContext): Tool[] {
  return context === 'applications' ? [...APPLICATION_TOOLS, ...NOTE_TOOLS] : [...NOTE_TOOLS, ...APPLICATION_TOOLS]
}
