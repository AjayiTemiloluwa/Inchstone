'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, Circle, Star } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'
import { CountdownChip } from './CountdownChip'
import type { GoogleEventView } from './types'

type AgendaEntry =
  | { kind: 'deed'; at: number; task: Task }
  | { kind: 'google'; at: number; event: GoogleEventView }

/**
 * Phone replacement for the hour grid (shown below the sm breakpoint):
 * a chronological list of big, tappable cards. It shares every handler with
 * the grid, so tapping a card opens the same deed sheet.
 */
export function DeedAgenda({
  tasks,
  googleEvents,
  showGoogle,
  countdownNow,
  onOpen,
  onToggle,
}: {
  tasks: Task[]
  googleEvents: GoogleEventView[]
  showGoogle: boolean
  countdownNow: Date
  onOpen: (task: Task) => void
  onToggle: (task: Task) => void
}) {
  const entries = useMemo<AgendaEntry[]>(() => {
    const deeds: AgendaEntry[] = tasks
      .filter(t => t.startTime && t.endTime)
      .map(t => ({ kind: 'deed', at: new Date(t.startTime!).getTime(), task: t }))
    const events: AgendaEntry[] = showGoogle
      ? googleEvents.map(g => ({ kind: 'google', at: new Date(g.startTime).getTime(), event: g }))
      : []
    return [...deeds, ...events].sort((a, b) => a.at - b.at)
  }, [tasks, googleEvents, showGoogle])

  if (entries.length === 0) {
    return (
      <div className="sm:hidden glass rounded-2xl border border-white/10 p-6 text-center text-sm text-ink/40 animate-fadeIn">
        Nothing scheduled yet. Tap Add Deed and give it a time.
      </div>
    )
  }

  return (
    <ul className="sm:hidden space-y-2 animate-fadeIn" aria-label="Day agenda">
      {entries.map(entry => {
        if (entry.kind === 'google') {
          const g = entry.event
          return (
            <li
              key={`g-${g.id}`}
              className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3"
              style={{ borderLeft: '3px solid rgb(var(--gold-rgb) / 0.55)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-semibold text-gold/90">{g.title}</span>
                <span className="shrink-0 font-mono text-[8px] uppercase tracking-wider text-gold/50">Google</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-gold/60">
                {format(new Date(g.startTime), 'h:mm a')} - {format(new Date(g.endTime), 'h:mm a')}
              </p>
            </li>
          )
        }

        const t = entry.task
        const accent = t.color || (t.completed ? '#8fbc8f' : 'var(--gold)')
        return (
          <li key={t.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(t)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(t)
                }
              }}
              className={`flex min-h-[68px] cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 text-left shadow-sm transition-all duration-200 active:scale-[0.99] ${
                t.completed ? 'glass opacity-80' : 'border-white/10 bg-black/20'
              }`}
              style={{ borderLeft: `4px solid ${accent}` }}
            >
              <button
                onClick={e => { e.stopPropagation(); onToggle(t) }}
                aria-label={t.completed ? `Mark ${t.title} pending` : `Mark ${t.title} done`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              >
                {t.completed ? <CheckCircle2 className="h-6 w-6 text-sage" /> : <Circle className="h-6 w-6 text-ink/30" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`min-w-0 break-words text-sm font-semibold leading-snug ${t.completed ? 'line-through text-ink/50' : 'text-ink'}`}>{t.title}</span>
                  {t.isImportant && <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] text-ink/50">
                    {format(new Date(t.startTime!), 'h:mm a')} - {format(new Date(t.endTime!), 'h:mm a')}
                  </span>
                  <CountdownChip task={t} now={countdownNow} />
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-ink/60">
                {Math.round(t.weight * 10) / 10} pts
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
