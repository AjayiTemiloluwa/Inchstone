// Which opportunities go into the email digest, and when it is due. Pure
// functions shared by the server (sending) and the settings preview, so the
// preview is always exactly what the email will contain.

export interface DigestSettings {
  emailDigest: boolean
  digestFrequency: string // daily | weekdays | weekly
  digestHour: number
  digestDay: number
  digestMinMatch: number
  digestScope: string // all | local | global
  digestTypes: string // comma list; empty = every type
  digestMax: number
  digestOnlyNew: boolean
  tz: string
}

export interface DigestCandidate {
  status: string
  emailSkip: boolean
  emailedAt: Date | string | null
  match: number
  scope: string
  type: string
  deadline: Date | string | null
}

export const DIGEST_FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Once a week' },
] as const
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The opportunities the next digest will list, best fit first. */
export function digestSelection<T extends DigestCandidate>(s: DigestSettings, opps: T[]): T[] {
  const types = s.digestTypes.split(',').map((t) => t.trim()).filter(Boolean)
  const dl = (o: T) => (o.deadline ? new Date(o.deadline).getTime() : Infinity)
  return opps
    .filter((o) =>
      o.status !== 'approved' && !o.emailSkip &&
      (!s.digestOnlyNew || !o.emailedAt) &&
      o.match >= s.digestMinMatch &&
      (s.digestScope === 'all' || o.scope === s.digestScope) &&
      (!types.length || types.includes(o.type)))
    .sort((a, b) => b.match - a.match || dl(a) - dl(b))
    .slice(0, Math.max(1, s.digestMax))
}

/** The user's wall clock: hour and weekday in their timezone. */
export function localClock(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'Africa/Lagos', hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value ?? 'Mon')
  return { hour, weekday }
}

/** Is this the hour the digest should go out (and has it not gone out already)? */
export function digestDue(s: DigestSettings & { digestSentAt: Date | null }, now = new Date()) {
  if (!s.emailDigest) return false
  if (s.digestSentAt && now.getTime() - s.digestSentAt.getTime() < 20 * 3_600_000) return false
  const { hour, weekday } = localClock(s.tz, now)
  if (hour !== s.digestHour) return false
  if (s.digestFrequency === 'weekdays') return weekday >= 1 && weekday <= 5
  if (s.digestFrequency === 'weekly') return weekday === s.digestDay
  return true
}

/** "Every day at 6:00", "Weekdays at 18:00", "Mondays at 7:00". */
export function describeSchedule(s: Pick<DigestSettings, 'emailDigest' | 'digestFrequency' | 'digestHour' | 'digestDay'>) {
  if (!s.emailDigest) return 'Email digest is off'
  const at = `${String(s.digestHour).padStart(2, '0')}:00`
  if (s.digestFrequency === 'weekdays') return `Weekdays at ${at}`
  if (s.digestFrequency === 'weekly') return `${WEEKDAYS[s.digestDay] ?? 'Monday'}s at ${at}`
  return `Every day at ${at}`
}
