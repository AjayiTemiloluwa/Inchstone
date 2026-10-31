'use client'

/**
 * The full PDP record for one Goal (§3): all six answers, milestones (§4),
 * and its status history timeline (§5). Mounted only while a goal is open;
 * resolves the freshest goal data from the plans store by id.
 */
import { useCallback, useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { usePlansStore } from '@/stores/plansStore'
import type { PlanGoalRecord, PlanMilestoneRecord, StatusLogEntryRecord } from '@/lib/plans/types'
import { isGoalStatus, isOverdue } from '@/lib/plans/status'
import { Badge, Button, RowActions, Section } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'
import { StatusBadge, DraftBadge, STATUS_TEXT } from './StatusBadge'
import { HistoryTimeline } from './HistoryTimeline'
import { MilestoneFormModal } from './MilestoneFormModal'
import { PlanSheet } from './PlanSheet'

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

export function GoalDetailModal({ goalId, onClose, onEdit }: Props) {
  const { currentPlan, fetchStatusLog, updateMilestone, deleteMilestone, updateGoal, deleteGoal } = usePlansStore()
  const trackerItems = usePlansStore(s => s.trackerItems)
  const { confirm } = useToast()
  const [confirming, setConfirming] = useState(false)

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

  const askConfirm = async (message: string) => {
    setConfirming(true)
    try {
      return await confirm(message)
    } finally {
      setConfirming(false)
    }
  }

  const handleDelete = async () => {
    if (!(await askConfirm('Delete this goal, its milestones and their history? This cannot be undone.'))) return
    const ok = await deleteGoal(goal.id)
    if (ok) onClose()
  }

  return (
    <PlanSheet
      title={(goal.overallGoal ?? '').trim() || 'Untitled draft'}
      eyebrow={sectionName}
      onClose={onClose}
      size="xl"
      zClass="z-[55]"
      // Pause this dialog's key handling while a nested milestone form or confirm is on top
      active={!msModal.open && !confirming}
      overlay={
        msModal.open && (
          <MilestoneFormModal
            key={msModal.initial?.id ?? 'new'}
            goal={goal}
            initial={msModal.initial}
            onClose={() => setMsModal({ open: false, initial: null })}
          />
        )
      }
    >
      {/* Status line + actions */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {goal.isDraft && <DraftBadge />}
          <StatusBadge status={goal.status} />
          {overdue && <Badge tone="ember">Overdue</Badge>}
          <span className="font-mono text-[11px] tabular-nums text-parchment/45">
            {format(new Date(goal.startDate), 'd MMM yyyy')} → {format(new Date(goal.targetDate), 'd MMM yyyy')}
          </span>
        </div>

        {linked && (
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-parchment/60">
            <Link2 className="h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.75} aria-hidden="true" />
            Rolls up from yearly tracker: <span className="text-gold">{linked.title}</span>
            <span className="font-mono tabular-nums text-parchment/45">· {Math.round(linked.progress)}% complete</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={Pencil} onClick={() => onEdit(goal)}>
            Edit goal
          </Button>
          <Button
            size="sm"
            icon={goal.archived ? ArchiveRestore : Archive}
            onClick={async () => {
              const ok = await updateGoal(goal.id, { archived: !goal.archived })
              if (ok) onClose()
            }}
          >
            {goal.archived ? 'Unarchive' : 'Archive'}
          </Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* The six PDP answers: a quiet definition list, overall goal spanning both columns */}
      <dl className="grid gap-x-6 gap-y-5 border-t border-gold/10 pt-5 sm:grid-cols-2">
        {BLOCK_LABELS.map(b => (
          <div key={String(b.key)} className={b.key === 'overallGoal' ? 'sm:col-span-2' : ''}>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">{b.label}</dt>
            <dd className="mt-1.5 whitespace-pre-wrap text-body text-parchment/85">
              {(goal[b.key] as string | null)?.trim() || <span className="text-parchment/35">— not filled (draft)</span>}
            </dd>
          </div>
        ))}
      </dl>

      {/* Milestones (§4) */}
      <Section
        title="Milestones"
        action={
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setMsModal({ open: true, initial: null })}>
            Add milestone
          </Button>
        }
      >
        {(goal.milestones?.length ?? 0) === 0 ? (
          <p className="text-caption text-parchment/45">
            No checkpoints yet — break longer goals into dated milestones and they’ll appear on the Gantt bar.
          </p>
        ) : (
          <ul className="divide-y divide-gold/10">
            {goal.milestones!.map(m => (
              <li key={m.id} className="group flex min-h-11 items-center gap-3 py-1.5">
                <select
                  value={m.status}
                  onChange={e => handleMilestoneStatus(m.id, e.target.value)}
                  aria-label={`Status of ${m.title}`}
                  title="Change milestone status"
                  className={`h-2 w-2 shrink-0 cursor-pointer appearance-none rotate-45 rounded-none border-none bg-current ${
                    isGoalStatus(m.status) ? STATUS_TEXT[m.status] : STATUS_TEXT.not_started
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-parchment/85" title={m.notes || undefined}>{m.title}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-parchment/45">{format(new Date(m.targetDate), 'd MMM yyyy')}</span>
                <RowActions
                  label={`Actions for ${m.title}`}
                  actions={[
                    { label: 'Edit milestone', icon: Pencil, onSelect: () => setMsModal({ open: true, initial: m }) },
                    {
                      label: 'Delete milestone',
                      icon: Trash2,
                      destructive: true,
                      onSelect: async () => {
                        if (!(await askConfirm(`Delete milestone “${m.title}”?`))) return
                        await deleteMilestone(m.id)
                      },
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* History log (§5) */}
      <Section title="History">
        <HistoryTimeline entries={history} />
      </Section>
    </PlanSheet>
  )
}
