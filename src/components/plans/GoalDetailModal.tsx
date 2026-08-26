'use client'

/**
 * The full PDP record for one Goal (§3): all six answers, milestones (§4),
 * and its status history timeline (§5). Mounted only while a goal is open;
 * resolves the freshest goal data from the plans store by id.
 */
import { useCallback, useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { usePlansStore } from '@/stores/plansStore'
import type { PlanGoalRecord, PlanMilestoneRecord, StatusLogEntryRecord } from '@/lib/plans/types'
import { isOverdue } from '@/lib/plans/status'
import { StatusBadge, DraftBadge } from './StatusBadge'
import { HistoryTimeline } from './HistoryTimeline'
import { MilestoneFormModal } from './MilestoneFormModal'

type Props = {
  goalId: string
  onClose: () => void
  onEdit: (goal: PlanGoalRecord) => void
}

const BLOCK_LABELS: Array<{ key: keyof PlanGoalRecord; label: string }> = [
  { key: 'overallGoal', label: 'Overall goal' },
  { key: 'developmentOpportunity', label: 'Development opportunity' },
  { key: 'actionsPlanned', label: 'What I will do' },
  { key: 'resourcesAndSupport', label: 'Resources and support needed' },
  { key: 'successCriteria', label: 'What success looks like' },
]

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wider text-parchment/45'

export function GoalDetailModal({ goalId, onClose, onEdit }: Props) {
  const { currentPlan, fetchStatusLog, updateMilestone, deleteMilestone, updateGoal, deleteGoal } = usePlansStore()
  const trackerItems = usePlansStore(s => s.trackerItems)

  // Resolve the freshest goal + section name from the store tree on every render
  // (plain loop — cheap for personal-scale trees and compiler-friendly)
  let goal: PlanGoalRecord | null = null
  let sectionName = ''
  for (const s of currentPlan?.sections ?? []) {
    const g = (s.goals ?? []).find(x => x.id === goalId)
    if (g) {
      goal = g
      sectionName = s.name
      break
    }
  }

  const [history, setHistory] = useState<StatusLogEntryRecord[]>([])
  const [msModal, setMsModal] = useState<{ open: boolean; initial: PlanMilestoneRecord | null }>({ open: false, initial: null })

  useEffect(() => {
    let cancelled = false
    fetchStatusLog('goal', goalId).then(entries => {
      if (!cancelled) setHistory(entries)
    })
    return () => {
      cancelled = true
    }
  }, [goalId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshHistory = useCallback(() => {
    fetchStatusLog('goal', goalId).then(setHistory)
  }, [goalId, fetchStatusLog])

  if (!goal) return null

  const overdue = isOverdue(goal.targetDate, goal.status)
  const linked = goal.linkedItemId ? trackerItems[goal.linkedItemId] : undefined

  const handleMilestoneStatus = async (mId: string, next: string) => {
    await updateMilestone(mId, { status: next })
    refreshHistory()
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this goal, its milestones and their history? This cannot be undone.')) return
    const ok = await deleteGoal(goal.id)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl space-y-6 overflow-y-auto rounded-[8px] border hairline bg-ink p-6" data-lenis-prevent
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-parchment/40">{sectionName}</p>
              <h2 className="mt-1 font-display text-xl leading-snug text-parchment">
                {(goal.overallGoal ?? '').trim() || 'Untitled draft'}
              </h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-md p-1.5 text-parchment/50 transition-colors hover:bg-mist hover:text-parchment">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {goal.isDraft && <DraftBadge />}
            <StatusBadge status={goal.status} />
            <span className="font-mono text-[11px] text-parchment/45">
              {format(new Date(goal.startDate), 'd MMM yyyy')} → {format(new Date(goal.targetDate), 'd MMM yyyy')}
            </span>
            {overdue && (
              <span className="rounded-full border border-ember/50 bg-ember/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#CD8B70]">
                Overdue
              </span>
            )}
          </div>

          {linked && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-parchment/55">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-gold-dim" strokeWidth={1.75} />
              Rolls up from yearly tracker: <span className="text-gold">{linked.title}</span>
              <span className="font-mono text-parchment/45">· {Math.round(linked.progress)}% complete</span>
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onEdit(goal)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-parchment/20 px-3 text-xs text-parchment/75 transition-colors hover:border-gold/40 hover:text-parchment"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit goal
            </button>
            <button
              onClick={async () => {
                const ok = await updateGoal(goal.id, { archived: !goal.archived })
                if (ok) onClose()
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-parchment/20 px-3 text-xs text-parchment/75 transition-colors hover:border-gold/40 hover:text-parchment"
            >
              {goal.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {goal.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-ember/30 px-3 text-xs text-[#CD8B70] transition-colors hover:bg-ember/15"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* The six PDP answers */}
        <div className="grid gap-4 sm:grid-cols-2">
          {BLOCK_LABELS.map(b => (
            <div key={String(b.key)} className={`rounded-md border border-parchment/12 bg-black/20 p-3.5 ${b.key === 'overallGoal' ? 'sm:col-span-2' : ''}`}>
              <p className={LABEL_CLASS}>{b.label}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-parchment/85">
                {(goal[b.key] as string | null)?.trim() || <span className="text-parchment/35">— not filled (draft)</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Milestones (§4) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className={LABEL_CLASS}>Milestones</p>
            <button
              onClick={() => setMsModal({ open: true, initial: null })}
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-dashed border-parchment/25 px-2.5 text-xs text-parchment/65 transition-colors hover:border-gold/40 hover:text-gold"
            >
              <Plus className="h-3.5 w-3.5" /> Add milestone
            </button>
          </div>

          {(goal.milestones?.length ?? 0) === 0 ? (
            <p className="text-xs text-parchment/40">
              No checkpoints yet — break longer goals into dated milestones and they’ll appear on the Gantt bar.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {goal.milestones!.map(m => (
                <li key={m.id} className="group flex items-center gap-2.5 rounded-md border border-parchment/12 px-3 py-2">
                  <select
                    value={m.status}
                    onChange={e => handleMilestoneStatus(m.id, e.target.value)}
                    aria-label={`Status of ${m.title}`}
                    title="Change milestone status"
                    className={`h-2 w-2 shrink-0 cursor-pointer appearance-none rotate-45 rounded-none border-none bg-current ${
                      m.status === 'achieved' ? 'text-moss' : m.status === 'at_risk' ? 'text-[#A14E37]' : m.status === 'in_progress' ? 'text-gold' : 'text-parchment/40'
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-parchment/85" title={m.notes || undefined}>{m.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-parchment/40">{format(new Date(m.targetDate), 'd MMM yyyy')}</span>
                  <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100">
                    <button onClick={() => setMsModal({ open: true, initial: m })} aria-label="Edit milestone" className="rounded p-1 text-parchment/40 transition-colors hover:bg-mist hover:text-parchment">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete milestone “${m.title}”?`)) return
                        await deleteMilestone(m.id)
                      }}
                      aria-label="Delete milestone"
                      className="rounded p-1 text-ember/70 transition-colors hover:bg-ember/20 hover:text-[#CD8B70]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* History log (§5) */}
        <div className="space-y-3">
          <p className={LABEL_CLASS}>History</p>
          <HistoryTimeline entries={history} />
        </div>

        {msModal.open && (
          <MilestoneFormModal
            key={msModal.initial?.id ?? 'new'}
            goal={goal}
            initial={msModal.initial}
            onClose={() => setMsModal({ open: false, initial: null })}
          />
        )}
      </div>
    </div>
  )
}