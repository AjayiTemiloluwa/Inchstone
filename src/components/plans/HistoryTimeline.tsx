'use client'

import { format } from 'date-fns'
import type { StatusLogEntryRecord } from '@/lib/plans/types'
import { STATUS_META, isGoalStatus } from '@/lib/plans/status'

function statusLabel(s: string | null): string {
  if (!s) return '—'
  return isGoalStatus(s) ? STATUS_META[s].label : s
}

/**
 * Lightweight per-Goal/Milestone history (§5): timestamped status transitions
 * with optional notes. Newest first — exactly how the API returns them.
 */
export function HistoryTimeline({ entries }: { entries: StatusLogEntryRecord[] }) {
  if (entries.length === 0) {
    return <p className="text-caption text-parchment/45">No history yet — it builds as statuses change.</p>
  }

  return (
    <ol className="relative ml-1 space-y-4 border-l border-gold/15 pl-5">
      {entries.map(e => {
        const changed = e.oldStatus !== e.newStatus
        return (
          <li key={e.id} className="relative">
            <span aria-hidden className="absolute -left-[24.5px] top-1.5 block h-2 w-2 rounded-full bg-gold-dim" />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[11px] tabular-nums text-parchment/45">
                {format(new Date(e.loggedAt), 'd MMM yyyy · HH:mm')}
              </span>
              {changed ? (
                <span className="text-sm">
                  <span className="text-parchment/50">{statusLabel(e.oldStatus)}</span>
                  <span className="mx-1.5 text-gold-dim">→</span>
                  <span className={isGoalStatus(e.newStatus) ? 'text-parchment' : ''}>{statusLabel(e.newStatus)}</span>
                </span>
              ) : (
                <span className="text-sm italic text-parchment/50">note added</span>
              )}
            </div>
            {e.note && <p className="mt-1 text-sm italic leading-relaxed text-parchment/60">“{e.note}”</p>}
          </li>
        )
      })}
    </ol>
  )
}
