// Application Tracker: shared vocabulary, progress math and the deadline
// reminder schedule. Used by the API routes, the alarm cron and the UI.

export const APPLICATION_TYPES = [
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'job', label: 'Job' },
  { value: 'school', label: 'School / Admission' },
  { value: 'grant', label: 'Grant / Funding' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'internship', label: 'Internship' },
  { value: 'visa', label: 'Visa / Immigration' },
  { value: 'competition', label: 'Competition / Award' },
  { value: 'other', label: 'Other' },
] as const

/** The pipeline, in order. The last three are outcomes. */
export const APPLICATION_STATUSES = [
  { value: 'researching', label: 'Researching' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'interviewing', label: 'Interview / Review' },
  { value: 'offer', label: 'Offer' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Not successful' },
  { value: 'withdrawn', label: 'Withdrawn' },
] as const

export const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const

export const ITEM_KINDS = ['eligibility', 'document', 'step'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const ITEM_STATUSES: Record<ItemKind, { value: string; label: string }[]> = {
  eligibility: [
    { value: 'met', label: 'I meet this' },
    { value: 'partial', label: 'Partly' },
    { value: 'unmet', label: 'I do not meet this' },
    { value: 'unknown', label: 'Not sure' },
  ],
  document: [
    { value: 'todo', label: 'Not started' },
    { value: 'drafting', label: 'In progress' },
    { value: 'ready', label: 'Ready' },
  ],
  step: [
    { value: 'todo', label: 'To do' },
    { value: 'done', label: 'Done' },
  ],
}

export const DEFAULT_ITEM_STATUS: Record<ItemKind, string> = { eligibility: 'unknown', document: 'todo', step: 'todo' }

/** Statuses after which deadline reminders stop: the application is in. */
export const DEADLINE_CLOSED = new Set(['submitted', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn'])
export const OUTCOME_STATUSES = new Set(['accepted', 'rejected', 'withdrawn'])

/** Reminder choices, in minutes before the deadline. */
export const REMINDER_CHOICES = [
  { minutes: 20160, label: '2 weeks before' },
  { minutes: 10080, label: '1 week before' },
  { minutes: 4320, label: '3 days before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 180, label: '3 hours before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 0, label: 'At the deadline' },
] as const

type Starter = { kind: ItemKind; label: string }

/** Starter checklist per type, so a new application is never a blank page. */
const STARTER_ITEMS: Record<string, Starter[]> = {
  scholarship: [
    { kind: 'eligibility', label: 'Nationality / residency requirement' },
    { kind: 'eligibility', label: 'Minimum degree classification or GPA' },
    { kind: 'eligibility', label: 'Work experience requirement' },
    { kind: 'eligibility', label: 'English language test (IELTS / TOEFL)' },
    { kind: 'document', label: 'CV' },
    { kind: 'document', label: 'Personal statement / essays' },
    { kind: 'document', label: 'Transcripts and certificates' },
    { kind: 'document', label: 'Reference letters' },
    { kind: 'step', label: 'Read the full eligibility criteria' },
    { kind: 'step', label: 'Create the portal account' },
    { kind: 'step', label: 'Request references' },
    { kind: 'step', label: 'Submit the application' },
  ],
  job: [
    { kind: 'eligibility', label: 'Years of experience' },
    { kind: 'eligibility', label: 'Required skills' },
    { kind: 'eligibility', label: 'Location / right to work' },
    { kind: 'document', label: 'Tailored CV' },
    { kind: 'document', label: 'Cover letter' },
    { kind: 'document', label: 'Portfolio / work samples' },
    { kind: 'step', label: 'Research the company' },
    { kind: 'step', label: 'Submit the application' },
    { kind: 'step', label: 'Follow up' },
  ],
  school: [
    { kind: 'eligibility', label: 'Entry qualifications' },
    { kind: 'eligibility', label: 'Test scores (GRE / GMAT / IELTS)' },
    { kind: 'document', label: 'Statement of purpose' },
    { kind: 'document', label: 'Transcripts' },
    { kind: 'document', label: 'Reference letters' },
    { kind: 'document', label: 'Proof of funding' },
    { kind: 'step', label: 'Pay the application fee' },
    { kind: 'step', label: 'Submit the application' },
  ],
  grant: [
    { kind: 'eligibility', label: 'Eligible applicant type' },
    { kind: 'eligibility', label: 'Focus area fit' },
    { kind: 'document', label: 'Proposal' },
    { kind: 'document', label: 'Budget' },
    { kind: 'document', label: 'Supporting documents' },
    { kind: 'step', label: 'Submit the proposal' },
  ],
  visa: [
    { kind: 'eligibility', label: 'Visa category requirements' },
    { kind: 'eligibility', label: 'Financial requirement' },
    { kind: 'document', label: 'Passport' },
    { kind: 'document', label: 'Bank statements' },
    { kind: 'document', label: 'Supporting letter' },
    { kind: 'step', label: 'Fill the online form' },
    { kind: 'step', label: 'Book the biometrics appointment' },
    { kind: 'step', label: 'Attend the appointment' },
  ],
}

const STARTER_ALIAS: Record<string, string> = { fellowship: 'scholarship', competition: 'scholarship', internship: 'job' }

export function starterItemsFor(type: string): Starter[] {
  return (
    STARTER_ITEMS[type] ??
    STARTER_ITEMS[STARTER_ALIAS[type] ?? ''] ?? [
      { kind: 'eligibility', label: 'Main requirement' },
      { kind: 'document', label: 'Main document' },
      { kind: 'step', label: 'Submit the application' },
    ]
  )
}

export interface ItemLike {
  kind: string
  status: string
}

/**
 * Readiness: how far through the work you are. Ready documents and done
 * steps count, drafts count half; a submitted (or later) application is 100%.
 */
export function progressOf(status: string, items: ItemLike[]): number {
  if (DEADLINE_CLOSED.has(status) && status !== 'withdrawn') return 100
  const work = items.filter((i) => i.kind === 'document' || i.kind === 'step')
  if (!work.length) return 0
  const done = work.reduce((s, i) => s + (i.status === 'ready' || i.status === 'done' ? 1 : i.status === 'drafting' ? 0.5 : 0), 0)
  return Math.round((done / work.length) * 100)
}

/** Fit: how well you meet the stated requirements (pct null when none listed). */
export function fitOf(items: ItemLike[]) {
  const el = items.filter((i) => i.kind === 'eligibility')
  const met = el.filter((i) => i.status === 'met').length
  const partial = el.filter((i) => i.status === 'partial').length
  const unmet = el.filter((i) => i.status === 'unmet').length
  const unknown = el.length - met - partial - unmet
  return { pct: el.length ? Math.round(((met + partial * 0.5) / el.length) * 100) : null, met, partial, unmet, unknown, total: el.length }
}

export function parseOffsets(s: string | null | undefined): number[] {
  return (s || '')
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0)
}

/** A reminder whose moment passed longer ago than this is skipped, not pushed late. */
export const REMINDER_GRACE_MINUTES = 6 * 60

export interface ReminderApp {
  id: string
  title: string
  organization?: string | null
  status: string
  deadline: Date | null
  reminderOffsets: string
  remindersSent: string
  archived?: boolean
}

/**
 * Reminder offsets that are due now and not yet sent. Only the most urgent
 * due one is announced; the others (and any older than the grace window)
 * come back as `silent`, to be stamped without a notification.
 */
export function dueReminders(app: ReminderApp, now = new Date()): { due: number | null; silent: number[] } {
  if (!app.deadline || app.archived || DEADLINE_CLOSED.has(app.status)) return { due: null, silent: [] }
  const sent = new Set(parseOffsets(app.remindersSent))
  const fresh: number[] = []
  const silent: number[] = []
  for (const off of parseOffsets(app.reminderOffsets)) {
    if (sent.has(off)) continue
    const at = app.deadline.getTime() - off * 60_000
    if (at > now.getTime()) continue
    if (now.getTime() - at > REMINDER_GRACE_MINUTES * 60_000) silent.push(off)
    else fresh.push(off)
  }
  fresh.sort((a, b) => a - b)
  return { due: fresh.length ? fresh[0] : null, silent: [...silent, ...fresh.slice(1)] }
}

export function humanLead(minutes: number): string {
  if (minutes === 0) return 'is due now'
  if (minutes < 60) return `is due in ${minutes} minutes`
  if (minutes < 1440) {
    const h = Math.round(minutes / 60)
    return `is due in ${h} hour${h === 1 ? '' : 's'}`
  }
  const d = Math.round(minutes / 1440)
  if (d === 7) return 'is due in 1 week'
  if (d === 14) return 'is due in 2 weeks'
  return `is due in ${d} day${d === 1 ? '' : 's'}`
}

export function reminderPayload(app: Pick<ReminderApp, 'id' | 'title' | 'organization'>, offset: number) {
  const who = app.organization ? `${app.title} (${app.organization})` : app.title
  return {
    title: offset <= 180 ? 'Application deadline' : 'Application reminder',
    body: `${who} ${humanLead(offset)}.`,
    icon: '/api/icon?sizes=192x192',
    url: `/challenge/applications/${app.id}`,
    tag: `application-${app.id}`,
    requireInteraction: offset <= 1440,
  }
}

export function stampOffsets(sent: string, add: number[]): string {
  const s = new Set(parseOffsets(sent))
  add.forEach((o) => s.add(o))
  return [...s].sort((a, b) => b - a).join(',')
}

/** Max upload size: under Vercel's 4.5 MB request body cap. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024

// ── Input cleaning shared by the API routes ──

export const pickValue = <T extends readonly { value: string }[]>(list: T, v: unknown, fallback: string) =>
  typeof v === 'string' && list.some((x) => x.value === v) ? v : fallback

/** undefined = not sent (leave as is), null = cleared, Date = set. Invalid input reads as not sent. */
export function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? undefined : d
}

export function cleanOffsets(v: unknown): string | undefined {
  if (!Array.isArray(v)) return undefined
  const allowed = new Set<number>(REMINDER_CHOICES.map((c) => c.minutes))
  return [...new Set(v.map(Number).filter((n) => allowed.has(n)))].sort((a, b) => b - a).join(',')
}

export const cleanStr = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
