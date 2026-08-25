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
    return <p className="text-xs text-parchment/40">No history yet — it builds as statuses change.</p>
  }

  return (
    <ol className="relative ml-1.5 space-y-4 border-l border-parchment/15 pl-4">
      {entries.map(e => {
        const changed = e.oldStatus !== e.newStatus
        return (
          <li key={e.id} className="relative">
            <span aria-hidden className="absolute -left-[21px] top-1 block h-2 w-2 rounded-full bg-gold-dim" />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-parchment/45">
                {format(new Date(e.loggedAt), 'd MMM yyyy · HH:mm')}
              </span>
              {changed ? (
                <span className="text-xs">
                  <span className="text-parchment/50">{statusLabel(e.oldStatus)}</span>
                  <span className="mx-1.5 text-gold-dim">→</span>
                  <span className={isGoalStatus(e.newStatus) ? 'text-parchment' : ''}>{statusLabel(e.newStatus)}</span>
                </span>
              ) : (
                <span className="text-xs italic text-parchment/50">note added</span>
              )}
            </div>
            {e.note && <p className="mt-1 text-xs italic leading-relaxed text-parchment/60">“{e.note}”</p>}
          </li>
        )
      })}
    </ol>
  )
}