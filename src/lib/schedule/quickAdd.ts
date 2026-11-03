// "Magic add" for the day schedule: turn a short phrase into a deed or event.
//
//   Gym 6-7pm                 → 18:00–19:00
//   Call mum at 14:30 for 20m → 14:30–14:50
//   Standup 9:15 30min        → 09:15–09:45
//   Write SOP 9am !frog       → 09:00–10:00, frog
//   Read 20 pages every day   → daily habit
//   Team sync 3pm weekly      → repeats weekly
//   Lunch noon-1pm #event     → a calendar event instead of a deed
//   Pay rent !important       → very important (rings before it starts)
//   Plan week tomorrow 8am    → on tomorrow's date
//   Gym every monday 6am      → weekly, starting the next Monday
//   Study daily until dec 20  → repeats until 20 December
//   Swim weekly for 6 weeks   → repeats for 6 weeks
//
// Edit instructions (see parseEditCommand) act on a deed already on the page:
//   move gym to 7pm · rename gym to workout · delete gym · done gym
//   make gym weekly · stop repeating gym
//
// Pure and timezone-free: times are wall-clock "HH:mm" on the page's day.

export type Repeat = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface QuickAdd {
  title: string
  start: string | null
  end: string | null
  /** Day offset from the page's date: 0 today, 1 tomorrow. */
  dayOffset: number
  kind: 'deed' | 'event'
  habit: boolean
  repeat: Repeat | null
  frog: boolean
  important: boolean
  priority: 'high' | 'medium' | 'low' | null
  /** 0 = Sunday … 6 = Saturday, when the phrase named a weekday ("every monday", "on friday"). */
  weekday: number | null
  /** Last day a repeating deed runs, "yyyy-MM-dd" ("until dec 20", "for 6 weeks"). */
  until: string | null
  /** The text exactly as typed (an edit instruction is recognised from it). */
  raw: string
  /** Human read-back of what was understood, for the preview chip. */
  chips: string[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`

/** "6", "6pm", "6:30", "18:30", "noon", "midnight" → minutes after midnight. */
function toMinutes(h: string, m: string | undefined, ap: string | undefined, fallbackAp?: string): number | null {
  let hour = +h
  const min = m ? +m : 0
  if (min > 59) return null
  const mer = (ap || fallbackAp || '').toLowerCase()
  if (mer.startsWith('p') && hour < 12) hour += 12
  if (mer.startsWith('a') && hour === 12) hour = 0
  if (hour > 23) return null
  return hour * 60 + min
}

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?`

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
}
const WEEKDAY_RE = 'monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun'
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** "dec 20", "20 dec", "december 20 2026", "2026-12-20" → "yyyy-MM-dd" (next occurrence if already past). */
export function parseLooseDate(raw: string, today: Date = new Date()): string | null {
  const t = raw.trim().toLowerCase()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) return t
  const md = /^(?:(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*|([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?)(?:,?\s+(\d{4}))?$/.exec(t)
  if (!md) return null
  const mon = MONTHS.indexOf((md[2] ?? md[3]) as string)
  const day = +(md[1] ?? md[4])
  if (mon < 0 || day < 1 || day > 31) return null
  let year = md[5] ? +md[5] : today.getFullYear()
  let d = new Date(year, mon, day)
  if (!md[5] && d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) d = new Date(++year, mon, day)
  return ymd(d)
}

export function parseQuickAdd(input: string, today: Date = new Date()): QuickAdd {
  let text = ` ${input.trim()} `
  const chips: string[] = []
  const take = (re: RegExp) => {
    const m = text.match(re)
    if (m) text = text.replace(m[0], ' ')
    return m
  }

  const frog = !!take(/\s!frog\b/i) || !!take(/\s🐸/)
  const important = !!take(/\s!(important|imp|!)\b/i) || !!take(/\s!!\s/)
  const asEvent = !!take(/\s#event\b/i)
  let priority: QuickAdd['priority'] = null
  const pr = take(/\s!(high|medium|low)\b/i)
  if (pr) priority = pr[1].toLowerCase() as QuickAdd['priority']

  let dayOffset = 0
  if (take(/\s(tomorrow|tmrw|tmr)\b/i)) dayOffset = 1
  else take(/\stoday\b/i)

  // "until dec 20" / "till 2026-12-31" / "until end of year"; "for 6 weeks" is handled once we know it repeats
  let until: string | null = null
  const untilM = take(/\s(?:until|till|through)\s+(end of (?:the )?year|year end|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9}(?:,?\s+\d{4})?|[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)(?=\s)/i)
  if (untilM) until = /end of|year end/i.test(untilM[1]) ? `${today.getFullYear()}-12-31` : parseLooseDate(untilM[1], today)
  const forM = take(/\s(?:for|over)\s+(\d{1,3})\s*(day|week|month)s?(?=\s)/i)

  // "every monday", "on friday", "next tuesday" → a weekday; "every …" also makes it repeat weekly.
  let weekday: number | null = null
  let weekdayRepeats = false
  const wd = take(new RegExp(String.raw`\s(every|on|next)\s+(${WEEKDAY_RE})(?=\s)`, 'i'))
  if (wd) { weekday = WEEKDAYS[wd[2].toLowerCase()]; weekdayRepeats = wd[1].toLowerCase() === 'every' }

  let repeat: Repeat | null = null
  let habit = false
  if (take(/\s(every ?day|daily)\b/i)) { habit = true; repeat = 'daily' }
  else if (take(/\s(every )?weekdays?\b/i)) repeat = 'weekdays'
  else if (take(/\s(every other week|biweekly|fortnightly)\b/i)) repeat = 'biweekly'
  else if (take(/\s(every week|weekly)\b/i)) repeat = 'weekly'
  else if (take(/\s(every month|monthly)\b/i)) repeat = 'monthly'
  else if (take(/\s(every year|yearly|annually)\b/i)) repeat = 'yearly'
  else if (weekdayRepeats) repeat = 'weekly'
  if (repeat && !until && forM) {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const n = +forM[1]
    if (/day/i.test(forM[2])) end.setDate(end.getDate() + n)
    else if (/week/i.test(forM[2])) end.setDate(end.getDate() + n * 7)
    else end.setMonth(end.getMonth() + n)
    until = ymd(end)
  }
  if (!repeat) until = null

  // Duration: "for 20m", "45 min", "1h", "1.5 hours", "2h30"
  let duration: number | null = null
  const dur = take(/\s(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)(?:\s*(\d{1,2})\s*(?:m|min|mins)?)?\b|\s(?:for\s+)?(\d{1,3})\s*(m|min|mins|minutes)\b/i)
  if (dur) duration = dur[1] ? Math.round(+dur[1] * 60 + (dur[3] ? +dur[3] : 0)) : +dur[4]

  text = text.replace(/\bnoon\b/gi, '12pm').replace(/\bmidnight\b/gi, '12am')

  let start: number | null = null
  let end: number | null = null
  // Range: "6-7pm", "9:30–11", "from 2pm to 3:30pm"
  const range = take(new RegExp(String.raw`\s(?:from\s+)?${TIME}\s*(?:-|–|—|to|until|till)\s*${TIME}(?=\s)`, 'i'))
  if (range) {
    const endAp = range[6]
    end = toMinutes(range[4], range[5], endAp)
    start = toMinutes(range[1], range[2], range[3], range[3] ? undefined : endAp)
    if (start !== null && end !== null && end <= start && !range[3] && start + 720 > end + 720) {
      // "11-1pm": the start is the morning before an afternoon end
      if (start >= 720) start -= 720
    }
  } else {
    // Single time: "at 2pm", "@ 14:30", "9am", or a bare 24h "14:30"
    const one = take(new RegExp(String.raw`\s(?:at|@)\s*${TIME}(?=\s)`, 'i')) ??
      take(new RegExp(String.raw`\s(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)`, 'i')) ??
      take(/\s([01]?\d|2[0-3]):([0-5]\d)(?=\s)/)
    if (one) start = toMinutes(one[1], one[2], one[3])
  }
  if (start !== null && end === null) end = start + (duration ?? 60)
  if (start !== null && end !== null && end <= start) end = start + (duration ?? 60)

  const title = text.replace(/\s+/g, ' ').trim()

  if (start !== null) chips.push(`${fmt(start)}–${fmt(Math.min(end!, 24 * 60 - 1))}`)
  if (dayOffset === 1) chips.push('Tomorrow')
  if (weekday !== null) chips.push(weekdayRepeats ? `Every ${WEEKDAY_NAMES[weekday]}` : WEEKDAY_NAMES[weekday])
  if (habit) chips.push('Daily habit')
  else if (repeat && !(weekdayRepeats && repeat === 'weekly')) chips.push(`Repeats ${repeat}`)
  if (until) chips.push(`Until ${until}`)
  if (frog) chips.push('Frog')
  if (important) chips.push('Very important')
  if (priority) chips.push(`${priority[0].toUpperCase()}${priority.slice(1)} priority`)
  if (asEvent) chips.push('Calendar event')

  return {
    title,
    start: start === null ? null : fmt(start),
    end: end === null ? null : fmt(Math.min(end, 24 * 60 - 1)),
    dayOffset,
    kind: asEvent ? 'event' : 'deed',
    habit,
    repeat,
    frog,
    important,
    priority,
    weekday,
    until,
    raw: input.trim(),
    chips,
  }
}

// ── Edit instructions ──────────────────────────────────────────────────────

export type EditCommand =
  | { action: 'move'; target: string; start: string | null; end: string | null; dayOffset: number; weekday: number | null }
  | { action: 'rename'; target: string; title: string }
  | { action: 'delete'; target: string; whole: boolean }
  | { action: 'done'; target: string; undo: boolean }
  | { action: 'repeat'; target: string; repeat: Repeat; weekday: number | null; until: string | null }
  | { action: 'stop-repeat'; target: string }

/**
 * Recognise an instruction that changes a deed that already exists, as opposed to adding a new one.
 * Returns null when the text is just a new deed. Matching the deed by name is the caller's job.
 */
export function parseEditCommand(input: string, today: Date = new Date()): EditCommand | null {
  const text = input.trim().replace(/\s+/g, ' ')
  const clean = (v: string) => v.replace(/^(the|my)\s+/i, '').replace(/["“”]/g, '').trim()
  let m: RegExpExecArray | null

  if ((m = /^(?:move|reschedule|shift|push|change)\s+(.+?)\s+(?:to|for|at)\s+(.+)$/i.exec(text))) {
    const when = parseQuickAdd(`x ${m[2]}`, today)
    if (when.start || when.dayOffset || when.weekday !== null) {
      return { action: 'move', target: clean(m[1]), start: when.start, end: m[2].match(/(-|–|—|\bto\b|\buntil\b)/i) || /\d\s*(m|min|h|hr)/i.test(m[2]) ? when.end : null, dayOffset: when.dayOffset, weekday: when.weekday }
    }
  }
  if ((m = /^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i.exec(text))) return { action: 'rename', target: clean(m[1]), title: clean(m[2]) }
  if ((m = /^(?:stop|cancel|end|pause)\s+(?:repeating|repeat|the repeat of)\s+(.+)$/i.exec(text)) ||
      (m = /^(?:make|set)\s+(.+?)\s+(?:not repeat|one[- ]off|just once)$/i.exec(text))) {
    return { action: 'stop-repeat', target: clean(m[1]) }
  }
  if ((m = /^(?:delete|remove|cancel|drop)\s+(.+)$/i.exec(text))) {
    const whole = /\s(?:series|every day|all|everywhere)$/i.test(m[1])
    return { action: 'delete', target: clean(m[1].replace(/\s(?:series|every day|all|everywhere)$/i, '')), whole }
  }
  if ((m = /^(?:mark\s+)?(?:done|complete|completed|finish|finished|tick|check)\s+(.+)$/i.exec(text)) ||
      (m = /^mark\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed)$/i.exec(text))) {
    return { action: 'done', target: clean(m[1]), undo: false }
  }
  if ((m = /^(?:undo|reopen|uncheck|untick)\s+(.+)$/i.exec(text))) return { action: 'done', target: clean(m[1]), undo: true }
  if ((m = /^(?:make|set|repeat)\s+(.+?)\s+((?:repeat\w*\s+)?(?:every|daily|weekly|weekdays?|monthly|yearly|annually|biweekly|fortnightly).*)$/i.exec(text)) ||
      (m = /^(?:make|set|repeat)\s+(.+?)\s+(repeat.*)$/i.exec(text))) {
    const r = parseQuickAdd(`x ${m[2].replace(/^repeat\w*\s+/i, '')}`, today)
    if (r.repeat) return { action: 'repeat', target: clean(m[1]), repeat: r.repeat, weekday: r.weekday, until: r.until }
  }
  return null
}

/** Best match for a spoken name among deed titles: exact, then starts-with, then contains. */
export function matchByTitle<T extends { title: string }>(name: string, items: T[]): { match: T | null; candidates: T[] } {
  const q = name.trim().toLowerCase()
  if (!q) return { match: null, candidates: [] }
  const norm = (t: string) => t.trim().toLowerCase()
  for (const test of [(t: string) => t === q, (t: string) => t.startsWith(q), (t: string) => t.includes(q)]) {
    const found = items.filter((i) => test(norm(i.title)))
    if (found.length === 1) return { match: found[0], candidates: found }
    if (found.length > 1) return { match: null, candidates: found }
  }
  return { match: null, candidates: [] }
}
