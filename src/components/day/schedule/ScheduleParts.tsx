'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { addDays, format, getDayOfYear, getISOWeek, isSameDay, startOfWeek } from 'date-fns'
import { CalendarClock, Check, ChevronLeft, ChevronRight, CornerDownLeft, ExternalLink, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'
import { Button, cx, inputClass } from '@/components/ds'
import { WorkClock } from '@/components/ui/WorkClock'
import { parseEditCommand, parseQuickAdd, type EditCommand, type QuickAdd } from '@/lib/schedule/quickAdd'
import { label12 } from '@/lib/schedule/layout'
import { openAssistant } from '@/lib/uiEvents'
import type { ScheduleEvent } from './DaySchedule'

// ── Header: the day as a title, its score, and the week around it ────────────

export function DayHero({
  date,
  score,
  done,
  total,
  points,
  totalPoints,
  week,
  onGo,
  onToday,
}: {
  date: Date
  score: number
  done: number
  total: number
  points: number
  totalPoints: number
  /** Progress per yyyy-MM-dd for the strip. */
  week: Record<string, { done: number; total: number }>
  onGo: (date: Date) => void
  onToday: () => void
}) {
  const today = new Date()
  const isToday = isSameDay(date, today)
  const monday = startOfWeek(date, { weekStartsOn: 1 })
  return (
    <header data-noreveal className="relative overflow-hidden rounded-2xl border border-gold/15 bg-surface-solid p-5 sm:p-7">
      <span aria-hidden className="hero-orb pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold/[0.09] blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-gold/10 pb-3.5 font-mono text-[11px] uppercase tracking-[0.22em] text-parchment/45">
        <span>Week {getISOWeek(date)} · Day {getDayOfYear(date)}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onGo(addDays(date, -1))} aria-label="Previous day" title="Previous day (←)"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/60 hover:bg-gold/[0.08] hover:text-parchment"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={onToday} disabled={isToday} title="Today (T)"
            className="h-9 rounded-lg border border-gold/25 px-3 font-semibold tracking-[0.14em] text-gold transition-colors hover:bg-gold/10 disabled:opacity-40">Today</button>
          <button type="button" onClick={() => onGo(addDays(date, 1))} aria-label="Next day" title="Next day (→)"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/60 hover:bg-gold/[0.08] hover:text-parchment"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="relative mt-5 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display font-bold leading-[0.95] tracking-[-0.025em] text-parchment text-[clamp(2.4rem,7vw,4.25rem)]">{format(date, 'EEEE')}</h1>
          <p className="mt-1 font-display text-[clamp(1.1rem,2.6vw,1.6rem)] italic text-gold">{format(date, 'd MMMM yyyy')}</p>
          <p className="mt-3 text-body text-parchment/60">
            <span className="font-mono tabular-nums text-parchment">{done}/{total}</span> deeds done ·{' '}
            <span className="font-mono tabular-nums text-parchment">{Math.round(points)}/{Math.round(totalPoints)}</span> points
          </p>
        </div>
        <div className="shrink-0 self-start sm:self-auto">
          <WorkClock size={112} progress={Math.round(score)} primary={String(Math.round(score))} ringLabel="TODAY" dayLabel={String(getDayOfYear(date)).padStart(3, '0')} />
        </div>
      </div>

      {/* Week strip */}
      <div className="relative mt-6 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(monday, i)
          const key = format(d, 'yyyy-MM-dd')
          const p = week[key]
          const pct = p && p.total ? p.done / p.total : 0
          const sel = isSameDay(d, date)
          const now = isSameDay(d, today)
          return (
            <button key={key} type="button" onClick={() => onGo(d)} aria-current={sel ? 'date' : undefined} aria-label={format(d, 'EEEE d MMMM')}
              className={cx('group flex flex-col items-center gap-1 rounded-xl border py-2 transition-colors',
                sel ? 'border-gold/50 bg-gold/[0.14]' : 'border-gold/10 hover:border-gold/30 hover:bg-gold/[0.05]')}>
              <span className={cx('font-mono text-[9px] uppercase tracking-[0.18em]', sel ? 'text-gold' : 'text-parchment/40')}>{format(d, 'EEEEE')}</span>
              <span className={cx('font-display text-lg leading-none tabular-nums', sel ? 'text-parchment' : now ? 'text-gold' : 'text-parchment/75')}>{format(d, 'd')}</span>
              <span className="h-1 w-6 overflow-hidden rounded-full bg-gold/10">
                <span className={cx('block h-full rounded-full', pct >= 1 ? 'bg-moss' : 'bg-gold')} style={{ width: `${Math.round(pct * 100)}%` }} />
              </span>
            </button>
          )
        })}
      </div>
    </header>
  )
}

// ── Magic add: type a phrase, see what it understood, press Enter ────────────

const EXAMPLES = ['Gym 6-7pm', 'Call mum at 14:30 for 20m', 'Write SOP 9am !frog', 'Read 20 pages every day', 'Swim every monday 6am until dec 20', 'move gym to 7pm', 'rename gym to workout', 'make gym weekly', 'done gym', 'Lunch noon-1pm #event']

function describeEdit(c: EditCommand): string {
  switch (c.action) {
    case 'move': return `move "${c.target}" to ${c.start ?? 'a new time'}${c.end ? `–${c.end}` : ''}`
    case 'rename': return `rename "${c.target}" to "${c.title}"`
    case 'delete': return `delete "${c.target}"${c.whole ? ' (whole series)' : ''}`
    case 'done': return `${c.undo ? 'reopen' : 'mark done'} "${c.target}"`
    case 'repeat': return `make "${c.target}" repeat ${c.repeat}`
    case 'stop-repeat': return `stop "${c.target}" repeating`
  }
}

export function MagicAdd({ onSubmit, busy }: { onSubmit: (q: QuickAdd) => Promise<boolean>; busy: boolean }) {
  const [text, setText] = useState('')
  const [hint, setHint] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text])
  const instruction = useMemo(() => (text.trim() ? parseEditCommand(text) : null), [text])

  useEffect(() => {
    const id = window.setInterval(() => setHint((h) => (h + 1) % EXAMPLES.length), 3500)
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'n' || e.key === '/') { e.preventDefault(); ref.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!parsed?.title || busy) return
    if (await onSubmit(parsed)) setText('')
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gold/20 bg-surface-solid p-2 shadow-[0_8px_30px_rgba(0,0,0,0.18)] focus-within:border-gold/45">
      <div className="flex items-center gap-2">
        <Wand2 className="ml-2 h-5 w-5 shrink-0 text-gold" strokeWidth={1.7} aria-hidden />
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Add anything… try “${EXAMPLES[hint]}”`}
          aria-label="Quick add a deed or event"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-[15px] text-parchment placeholder:text-parchment/35 focus:outline-none"
        />
        <kbd className="hidden rounded-md border border-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-parchment/35 sm:block">N</kbd>
        <button type="submit" disabled={!parsed?.title || busy} aria-label="Add"
          className="flex h-10 items-center gap-1.5 rounded-xl bg-gold px-3.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-30">
          <CornerDownLeft className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Add</span>
        </button>
      </div>
      {parsed && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1 pt-2 animate-fadeIn">
          {instruction ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Edit:</span>
              <span className="text-sm text-parchment">{describeEdit(instruction)}</span>
            </>
          ) : (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/40">{parsed.kind === 'event' ? 'Event' : 'Deed'}:</span>
              <span className="text-sm text-parchment">{parsed.title || '…'}</span>
              {parsed.chips.map((c) => (
                <span key={c} className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[10px] text-gold">{c}</span>
              ))}
              {!parsed.start && parsed.kind === 'deed' && <span className="font-mono text-[10px] text-parchment/40">no time: goes to Tasks</span>}
            </>
          )}
          <button type="button" onClick={openAssistant} className="ml-auto inline-flex items-center gap-1 text-xs text-parchment/45 hover:text-gold">
            <Sparkles className="h-3 w-3" aria-hidden /> Ask the assistant instead
          </button>
        </div>
      )}
    </form>
  )
}

// ── Quick create: opened by clicking or dragging on the grid ─────────────────

export interface QuickCreateValues {
  title: string
  start: number
  end: number
  kind: 'deed' | 'event'
  frog: boolean
  important: boolean
}

const toInput = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fromInput = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }

export function QuickCreate({
  start,
  end,
  busy,
  onChange,
  onSubmit,
  onMore,
  onClose,
}: {
  start: number
  end: number
  busy: boolean
  onChange: (start: number, end: number) => void
  onSubmit: (v: QuickCreateValues) => void
  onMore: (title: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'deed' | 'event'>('deed')
  const [frog, setFrog] = useState(false)
  const [important, setImportant] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (title.trim()) onSubmit({ title: title.trim(), start, end, kind, frog, important }) }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      className="space-y-3 rounded-2xl border border-gold/35 bg-surface-solid p-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)] animate-fadeIn"
    >
      <div className="flex items-center gap-2">
        <input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'event' ? 'Event title' : 'What will you do?'}
          aria-label="Title" className="min-h-11 flex-1 border-b border-gold/25 bg-transparent font-display text-xl text-parchment placeholder:text-parchment/30 focus:border-gold focus:outline-none" />
        <button type="button" onClick={onClose} aria-label="Cancel" className="flex h-10 w-10 items-center justify-center rounded-lg text-parchment/45 hover:text-parchment"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-gold/20 p-0.5">
          {(['deed', 'event'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={cx('rounded-md px-3 py-1.5 text-xs font-semibold capitalize', kind === k ? 'bg-gold text-ink' : 'text-parchment/60')}>{k}</button>
          ))}
        </div>
        <CalendarClock className="h-4 w-4 text-gold-dim" aria-hidden />
        <input type="time" step={900} value={toInput(start)} onChange={(e) => onChange(fromInput(e.target.value), Math.max(fromInput(e.target.value) + 15, end))}
          aria-label="Start" className={cx(inputClass, 'w-auto min-h-9 py-1')} />
        <span className="text-parchment/40">–</span>
        <input type="time" step={900} value={toInput(end)} onChange={(e) => onChange(start, Math.max(start + 15, fromInput(e.target.value)))}
          aria-label="End" className={cx(inputClass, 'w-auto min-h-9 py-1')} />
        <span className="font-mono text-[11px] text-parchment/45">{end - start} min</span>
      </div>
      {kind === 'deed' && (
        <div className="flex flex-wrap gap-2">
          {[['Frog', frog, setFrog], ['Very important', important, setImportant]].map(([label, on, set]) => (
            <button key={label as string} type="button" onClick={() => (set as (v: boolean) => void)(!on)} aria-pressed={on as boolean}
              className={cx('rounded-full border px-3 py-1 text-xs', on ? 'border-gold/60 bg-gold/10 text-gold' : 'border-gold/15 text-parchment/55')}>{label as string}</button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {kind === 'deed'
          ? <button type="button" onClick={() => onMore(title)} className="text-xs text-parchment/50 underline-offset-2 hover:text-gold hover:underline">More options</button>
          : <span />}
        <Button type="submit" variant="primary" size="sm" disabled={!title.trim() || busy}>{busy ? 'Saving…' : `Save ${label12(start)}`}</Button>
      </div>
    </form>
  )
}

// ── Tasks lane: deeds with no time, with one-tap scheduling ──────────────────

export function TasksLane({
  tasks,
  onToggle,
  onOpen,
  onSchedule,
  onAutoPlan,
  busy,
}: {
  tasks: Task[]
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
  onSchedule: (t: Task) => void
  onAutoPlan: () => void
  busy: boolean
}) {
  const open = tasks.filter((t) => !t.completed)
  return (
    <section aria-label="Tasks without a time" className="rounded-2xl border border-gold/15 bg-surface-solid p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-parchment/50">Tasks · no time yet</h2>
        <span className="h-px flex-1 bg-gold/15" aria-hidden />
        {open.length > 0 && (
          <Button size="sm" variant="secondary" icon={Wand2} onClick={onAutoPlan} disabled={busy}>
            {busy ? 'Planning…' : 'Auto-plan'}
          </Button>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="py-2 text-caption text-parchment/40">Everything has a time. Type a deed without a time above to park it here.</p>
      ) : (
        <ul className="divide-y divide-gold/10">
          {tasks.map((t) => (
            <li key={t.id} className="group flex items-center gap-3 py-2">
              <button type="button" onClick={() => onToggle(t)} aria-label={t.completed ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', t.completed ? 'border-moss bg-moss text-ink' : 'border-gold/40 hover:border-gold')}>
                {t.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <button type="button" onClick={() => onOpen(t)} className={cx('min-w-0 flex-1 truncate text-left text-sm', t.completed ? 'text-parchment/40 line-through' : 'text-parchment')}>
                {t.isFrog && '🐸 '}{t.title}
              </button>
              <span className="font-mono text-[10px] text-parchment/40">{t.weight} pts</span>
              {!t.completed && (
                <button type="button" onClick={() => onSchedule(t)} title="Put it in the next free slot"
                  className="rounded-lg border border-gold/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gold transition-colors hover:bg-gold/10">
                  Find a slot
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Event card: read-only events from Google or Inchstone ────────────────────

export function EventCard({ ev, onClose, onDelete }: { ev: ScheduleEvent; onClose: () => void; onDelete?: () => void }) {
  const s = new Date(ev.startTime), e = new Date(ev.endTime)
  return (
    <div role="dialog" aria-label={ev.title} className="flex items-start gap-3 rounded-2xl border border-parchment/20 bg-surface-solid p-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)] animate-fadeIn">
      <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-parchment/40" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg text-parchment">{ev.title}</p>
        <p className="font-mono text-xs text-parchment/55">
          {format(s, 'EEE d MMM')} · {format(s, 'h:mm a')} – {format(e, 'h:mm a')}
        </p>
        <p className="mt-1 text-caption text-parchment/45">{ev.source === 'google' ? 'From Google Calendar (edit it there)' : 'Inchstone calendar event'}</p>
      </div>
      {ev.source === 'google' && (
        <a href="https://calendar.google.com" target="_blank" rel="noreferrer" aria-label="Open Google Calendar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/50 hover:text-parchment"><ExternalLink className="h-4 w-4" /></a>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} aria-label="Delete event" className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/50 hover:bg-ember/10 hover:text-ember"><Trash2 className="h-4 w-4" /></button>
      )}
      <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/50 hover:text-parchment"><X className="h-4 w-4" /></button>
    </div>
  )
}
