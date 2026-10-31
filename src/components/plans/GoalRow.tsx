'use client'

import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { RowActions, cx, type RowAction } from '@/components/ds'
import { usePlansStore } from '@/stores/plansStore'
import type { PlanGoalRecord } from '@/lib/plans/types'
import { isGoalStatus, isOverdue } from '@/lib/plans/status'
import { StatusBadge, DraftBadge, LinkedItemBadge, STATUS_FILL } from './StatusBadge'

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

  // Archived rows cannot be reordered, so the menu only offers moves that do something.
  const actions: RowAction[] = [
    ...(!goal.archived && !moveDisabledUp ? [{ label: 'Move goal up', icon: ArrowUp, onSelect: () => onMove(-1) }] : []),
    ...(!goal.archived && !moveDisabledDown ? [{ label: 'Move goal down', icon: ArrowDown, onSelect: () => onMove(1) }] : []),
    { label: 'Edit goal', icon: Pencil, onSelect: onEdit },
    goal.archived
      ? { label: 'Unarchive goal', icon: ArchiveRestore, onSelect: onArchiveToggle }
      : { label: 'Archive goal', icon: Archive, onSelect: onArchiveToggle },
    { label: 'Delete goal', icon: Trash2, onSelect: onDelete, destructive: true },
  ]

  return (
    <div className="group relative py-3">
      {/* Status rail: the goal's status as a thin colour mark on the left edge */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute bottom-3 left-0 top-3 w-0.5 rounded-full',
          overdue ? 'bg-ember' : isGoalStatus(goal.status) ? STATUS_FILL[goal.status] : STATUS_FILL.not_started,
        )}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-4">
        {/* Clickable main area */}
        <button
          onClick={onOpenDetail}
          className="min-h-11 min-w-0 basis-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:flex-1 sm:basis-0"
        >
          <p className={cx('truncate text-body transition-colors group-hover:text-gold', goal.isDraft ? 'italic text-parchment/70' : 'text-parchment')}>
            {excerpt}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-parchment/45">
            {format(new Date(goal.startDate), 'MMM yyyy')} → {format(new Date(goal.targetDate), 'MMM yyyy')}
          </p>
        </button>

        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5">
          {overdue && (
            <span title="Target date passed" className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ember">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Overdue
            </span>
          )}
          {goal.isDraft && <DraftBadge />}
          {linked && <LinkedItemBadge title={linked.title} progress={linked.progress} />}
          <StatusBadge status={goal.status} />
        </div>

        <RowActions actions={actions} label={`Actions for ${excerpt}`} className="ml-auto sm:ml-0" />
      </div>

      {(goal.milestones?.length ?? 0) > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-4">
          {goal.milestones!.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-parchment/50" title={m.notes || m.title}>
              <span aria-hidden className={`inline-block h-1.5 w-1.5 rotate-45 ${m.status === 'achieved' ? 'bg-moss' : 'bg-gold-dim'}`} />
              {m.title}
              <span className="tabular-nums text-parchment/35">{format(new Date(m.targetDate), 'MMM yyyy')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
