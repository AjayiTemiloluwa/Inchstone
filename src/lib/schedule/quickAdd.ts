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

export function parseQuickAdd(input: string): QuickAdd {
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

  let repeat: Repeat | null = null
  let habit = false
  if (take(/\s(every ?day|daily)\b/i)) { habit = true; repeat = 'daily' }
  else if (take(/\s(every )?weekdays?\b/i)) repeat = 'weekdays'
  else if (take(/\s(every other week|biweekly|fortnightly)\b/i)) repeat = 'biweekly'
  else if (take(/\s(every week|weekly)\b/i)) repeat = 'weekly'
  else if (take(/\s(every month|monthly)\b/i)) repeat = 'monthly'
  else if (take(/\s(every year|yearly|annually)\b/i)) repeat = 'yearly'

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
  if (habit) chips.push('Daily habit')
  else if (repeat) chips.push(`Repeats ${repeat}`)
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
    chips,
  }
}
