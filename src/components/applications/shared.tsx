'use client'

import { Badge, cx, type Tone } from '@/components/ds'
import { APPLICATION_STATUSES, APPLICATION_TYPES, REMINDER_CHOICES } from '@/lib/applications'

export interface Fit {
  pct: number | null
  met: number
  partial: number
  unmet: number
  unknown: number
  total: number
}

export const STATUS_TONE: Record<string, Tone> = {
  researching: 'neutral',
  preparing: 'gold',
  submitted: 'gold',
  interviewing: 'gold',
  offer: 'moss',
  accepted: 'moss',
  rejected: 'ember',
  withdrawn: 'neutral',
}

export const statusLabel = (v: string) => APPLICATION_STATUSES.find((s) => s.value === v)?.label ?? v
export const typeLabel = (v: string) => APPLICATION_TYPES.find((t) => t.value === v)?.label ?? v

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{statusLabel(status)}</Badge>
}

/** Days and hours to a deadline, in words. */
export function countdown(deadline: string | Date | null | undefined, now = Date.now()) {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - now
  const abs = Math.abs(ms)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor((abs % 86400000) / 3600000)
  const mins = Math.floor((abs % 3600000) / 60000)
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  const tone: Tone = ms < 0 ? 'ember' : ms < 3 * 86400000 ? 'ember' : ms < 14 * 86400000 ? 'gold' : 'neutral'
  return { past: ms < 0, days, label: ms < 0 ? `${span} ago` : `${span} left`, tone }
}

export function DeadlineBadge({ deadline, closed }: { deadline: string | null; closed?: boolean }) {
  const c = countdown(deadline)
  if (!c || closed) return null
  return <Badge tone={c.tone}>{c.past ? 'Deadline passed' : c.label}</Badge>
}

export function formatDeadline(d: string | Date | null | undefined, withTime = true) {
  if (!d) return 'No deadline'
  const date = new Date(d)
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

/** ISO → value for <input type="datetime-local"> in the viewer's own clock. */
export function toLocalInput(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toDateInput(d: string | Date | null | undefined): string {
  return toLocalInput(d).slice(0, 10)
}

/** Local datetime-local / date input → ISO (or null when empty). */
export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v.length === 10 ? `${v}T23:59` : v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export const selectClass =
  'min-h-11 w-full rounded-lg border border-gold/20 bg-ink/40 px-3 text-sm text-parchment focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20'

export const textareaClass =
  'w-full rounded-lg border border-gold/20 bg-ink/40 px-3 py-2.5 text-sm leading-relaxed text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20'

export function ReminderPicker({ value, onChange, disabled }: { value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  const toggle = (m: number) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">Remind me</legend>
      <div className="flex flex-wrap gap-2">
        {REMINDER_CHOICES.map((c) => {
          const on = value.includes(c.minutes)
          return (
            <button key={c.minutes} type="button" onClick={() => toggle(c.minutes)} aria-pressed={on}
              className={cx(
                'min-h-11 pointer-fine:min-h-9 rounded-full border px-3 text-xs transition-colors disabled:opacity-40',
                on ? 'border-gold/60 bg-gold/10 text-gold' : 'border-gold/15 text-parchment/55 hover:border-gold/35',
              )}>
              {c.label}
            </button>
          )
        })}
      </div>
      <p className="text-caption text-parchment/40">
        {disabled ? 'Set a deadline to turn on reminders.' : 'An alarm sounds in the app, and a push notification reaches your phone when notifications are on.'}
      </p>
    </fieldset>
  )
}
