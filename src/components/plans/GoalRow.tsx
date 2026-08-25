'use client'

import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { usePlansStore } from '@/stores/plansStore'
import type { PlanGoalRecord } from '@/lib/plans/types'
import { isOverdue } from '@/lib/plans/status'
import { StatusBadge, DraftBadge, LinkedItemBadge } from './StatusBadge'

type Props = {
  goal: PlanGoalRecord
  onOpenDetail: () => void
  onEdit: () => void
  onDelete: () => void
  onArchiveToggle: () => void
  onMove: (dir: -1 | 1) => void
  moveDisabledUp?: boolean
  moveDisabledDown?: boolean
}

/** One Goal inside an expanded Section — title excerpt, dates, status badge (§3) */
export function GoalRow({ goal, onOpenDetail, onEdit, onDelete, onArchiveToggle, onMove, moveDisabledUp, moveDisabledDown }: Props) {
  const linked = usePlansStore(s => (goal.linkedItemId ? s.trackerItems[goal.linkedItemId] : undefined))
  const overdue = isOverdue(goal.targetDate, goal.status)
  const excerpt = (goal.overallGoal ?? '').trim() || 'Untitled draft'

  return (
    <div
      className={`group rounded-md border px-3 py-2.5 transition-colors ${
        overdue ? 'border-ember/40 hover:border-ember/60' : 'border-parchment/12 hover:border-gold/35'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Clickable main area */}
        <button onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
          <p className={`truncate text-sm ${goal.isDraft ? 'text-parchment/70 italic' : 'text-parchment'}`}>{excerpt}</p>
          <p className="mt-0.5 font-mono text-[11px] text-parchment/40">
            {format(new Date(goal.startDate), 'MMM yyyy')} → {format(new Date(goal.targetDate), 'MMM yyyy')}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {overdue && (
            <span title="Target date passed" className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[#CD8B70]">
              <AlertTriangle className="h-3 w-3" /> Overdue
            </span>
          )}
          {goal.isDraft && <DraftBadge />}
          {linked && <LinkedItemBadge title={linked.title} progress={linked.progress} />}
          <StatusBadge status={goal.status} />
        </div>

        {/* Row actions */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
          <button
            onClick={() => onMove(-1)}
            disabled={moveDisabledUp}
            aria-label="Move goal up"
            className="rounded p-1.5 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment disabled:opacity-25"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={moveDisabledDown}
            aria-label="Move goal down"
            className="rounded p-1.5 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment disabled:opacity-25"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={onEdit} aria-label="Edit goal" className="rounded p-1.5 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onArchiveToggle} aria-label={goal.archived ? 'Unarchive goal' : 'Archive goal'} className="rounded p-1.5 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment">
            {goal.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onDelete} aria-label="Delete goal" className="rounded p-1.5 text-ember/70 transition-colors hover:bg-ember/20 hover:text-[#CD8B70]">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {(goal.milestones?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-parchment/10 pt-2">
          {goal.milestones!.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-parchment/50" title={m.notes || m.title}>
              <span aria-hidden className={`inline-block h-2 w-2 rotate-45 ${m.status === 'achieved' ? 'bg-moss' : 'bg-gold-dim'}`} />
              {m.title}
              <span className="text-parchment/35">{format(new Date(m.targetDate), 'MMM yyyy')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}