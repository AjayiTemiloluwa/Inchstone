'use client'

/**
 * Review tab (§7): a low-friction pass over every Goal ("Still on track?"),
 * each action writing to the same history log; finishing saves a ReviewSession.
 * Past sessions are listed chronologically below.
 */
import { useMemo, useState } from 'react'
import { CalendarCheck, Play } from 'lucide-react'
import { format } from 'date-fns'
import { usePlansStore } from '@/stores/plansStore'
import { CADENCE_LABELS, type LongTermPlanRecord, type PlanGoalRecord } from '@/lib/plans/types'
import { Button, Panel, Section, cx, inputClass } from '@/components/ds'
import { StatusBadge } from './StatusBadge'
import { DATE_SCHEME, TEXTAREA } from './PlanSheet'

interface WalkItem {
  sectionName: string
  goal: PlanGoalRecord
}

type Phase = 'idle' | 'walk' | 'reflect'

const CADENCE_APPROX_MONTHS: Record<string, number> = {
  weekly: 0.25,
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
}

// Captured at module load — pure enough for due-date display math during render
const MODULE_LOAD_MS = Date.now()

/** The three verdict buttons share one shape; only the tone changes. */
const CHOICE =
  'inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40'

export function ReviewTab({ plan }: { plan: LongTermPlanRecord }) {
  const { updateGoal, saveReviewSession } = usePlansStore()
  const [phase, setPhase] = useState<Phase>('idle')
  const [idx, setIdx] = useState(0)
  const [changes, setChanges] = useState(0)
  const [pushOpen, setPushOpen] = useState(false)
  const [pushDate, setPushDate] = useState('')
  const [summaryNote, setSummaryNote] = useState('')
  const [saving, setSaving] = useState(false)

  const walkItems: WalkItem[] = useMemo(
    () =>
      (plan.sections ?? []).flatMap(s =>
        (s.goals ?? [])
          .filter(g => !g.archived)
          .map(goal => ({ sectionName: s.name, goal }))
      ),
    [plan]
  )

  const sessions = plan.reviewSessions ?? []
  const lastSession = sessions[0]

  const cadenceDue = useMemo(() => {
    if (!lastSession) return true
    const months = CADENCE_APPROX_MONTHS[plan.reviewCadence] ?? 1
    const dueAt = new Date(lastSession.conductedAt)
    dueAt.setDate(dueAt.getDate() + Math.round(months * 30))
    return dueAt.getTime() <= MODULE_LOAD_MS
  }, [lastSession, plan.reviewCadence])

  const startWalk = () => {
    setIdx(0)
    setChanges(0)
    setPhase('walk')
  }

  const advance = () => {
    setPushOpen(false)
    setPushDate('')
    if (idx + 1 >= walkItems.length) {
      setPhase('reflect')
    } else {
      setIdx(idx + 1)
    }
  }

  const applyStatus = async (goal: PlanGoalRecord, status?: string) => {
    let changed = false
    // Plain "Yes": restore an At-Risk goal back to In Progress; otherwise keep as-is
    const nextStatus = status ?? (goal.status === 'at_risk' ? 'in_progress' : undefined)
    if (nextStatus && nextStatus !== goal.status) {
      const res = await updateGoal(goal.id, { status: nextStatus })
      changed = res.ok
    }
    if (changed) setChanges(c => c + 1)
    advance()
  }

  const confirmPush = async (goal: PlanGoalRecord) => {
    if (!pushDate) return
    const res = await updateGoal(goal.id, { targetDate: pushDate })
    if (res.ok) {
      // Target-date moves also enter the history log (§7)
      await fetch('/api/status-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentType: 'goal',
          parentId: goal.id,
          note: `Target date pushed to ${format(new Date(pushDate), 'd MMM yyyy')}`,
        }),
      })
      setChanges(c => c + 1)
    }
    advance()
  }

  const saveSession = async () => {
    setSaving(true)
    try {
      await saveReviewSession(plan.id, summaryNote.trim() || undefined)
      setPhase('idle')
      setSummaryNote('')
    } finally {
      setSaving(false)
    }
  }

  const cadenceLabel = CADENCE_LABELS[plan.reviewCadence] ?? plan.reviewCadence

  return (
    <div className="space-y-10">
      {/* Idle: cadence banner + past sessions + start CTA */}
      {phase === 'idle' && (
        <>
          <Panel className={cx('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', cadenceDue && 'border-gold/40')}>
            <div className="flex items-start gap-3">
              <CalendarCheck
                className={cx('mt-0.5 h-5 w-5 shrink-0', cadenceDue ? 'text-gold' : 'text-parchment/50')}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-heading text-parchment">{!lastSession ? 'No reviews yet' : cadenceDue ? 'A review is due' : 'Up to date'}</p>
                <p className="text-body text-parchment/60">
                  {lastSession ? (
                    <>
                      Last reviewed <span className="font-mono tabular-nums">{format(new Date(lastSession.conductedAt), 'd MMM yyyy')}</span> ·{' '}
                      {cadenceLabel} cadence
                      {cadenceDue ? ' — a review is due' : ''}
                    </>
                  ) : (
                    <>Never reviewed · {cadenceLabel} cadence — reviews can be run anytime</>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              icon={Play}
              onClick={startWalk}
              disabled={walkItems.length === 0}
              title={walkItems.length === 0 ? 'Add goals to review first' : undefined}
              className="shrink-0"
            >
              Start review (<span className="tabular-nums">{walkItems.length}</span> goals)
            </Button>
          </Panel>

          <Section title={<>Past reviews · <span className="tabular-nums">{sessions.length}</span></>}>
            {sessions.length === 0 ? (
              <p className="text-caption text-parchment/45">
                Reviews you complete will appear here, so you can scroll back and watch how the plan evolved.
              </p>
            ) : (
              <ol className="relative ml-1 space-y-5 border-l border-gold/15 pl-5">
                {sessions.map(s => (
                  <li key={s.id} className="relative">
                    <span aria-hidden className="absolute -left-[24.5px] top-1.5 block h-2 w-2 rotate-45 bg-gold-dim" />
                    <p className="font-mono text-[11px] tabular-nums text-parchment/45">{format(new Date(s.conductedAt), 'EEEE d MMMM yyyy · HH:mm')}</p>
                    {s.summaryNote ? (
                      <p className="mt-1 whitespace-pre-wrap text-body italic text-parchment/75">“{s.summaryNote}”</p>
                    ) : (
                      <p className="mt-1 text-caption text-parchment/40">No reflection note.</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </>
      )}

      {/* Walk-through */}
      {phase === 'walk' && walkItems[idx] && (
        <Section
          title={<>Goal <span className="tabular-nums">{idx + 1}</span> of <span className="tabular-nums">{walkItems.length}</span></>}
          action={
            <div className="flex h-1 w-24 overflow-hidden rounded-full bg-parchment/10 sm:w-40" aria-hidden="true">
              <div className="bg-gold transition-all" style={{ width: `${((idx + 1) / walkItems.length) * 100}%` }} />
            </div>
          }
        >
          <Panel className="space-y-5">
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold-dim">{walkItems[idx].sectionName}</p>
              <h3 className="whitespace-pre-wrap font-display text-xl leading-snug text-parchment">
                {(walkItems[idx].goal.overallGoal ?? '').trim() || 'Untitled draft'}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-parchment/45">
                <StatusBadge status={walkItems[idx].goal.status} />
                <span>target {format(new Date(walkItems[idx].goal.targetDate), 'd MMM yyyy')}</span>
                {(walkItems[idx].goal.milestones?.length ?? 0) > 0 && (
                  <span>{walkItems[idx].goal.milestones!.length} milestone{walkItems[idx].goal.milestones!.length === 1 ? '' : 's'}</span>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-gold/10 pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">Still on track?</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => applyStatus(walkItems[idx].goal)} className={cx(CHOICE, 'border-moss/50 text-moss hover:bg-moss/10')}>
                  Yes
                </button>
                <button onClick={() => applyStatus(walkItems[idx].goal, 'at_risk')} className={cx(CHOICE, 'border-ember/50 text-ember hover:bg-ember/10')}>
                  At Risk
                </button>
                <button onClick={() => applyStatus(walkItems[idx].goal, 'achieved')} className={cx(CHOICE, 'border-gold/40 text-gold hover:bg-gold/10')}>
                  Achieved
                </button>
                {!pushOpen ? (
                  <Button variant="ghost" onClick={() => setPushOpen(true)}>
                    Push target date
                  </Button>
                ) : (
                  <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input
                      type="date"
                      aria-label="New target date"
                      value={pushDate}
                      onChange={e => setPushDate(e.target.value)}
                      className={cx(inputClass, DATE_SCHEME, 'w-auto min-w-0 flex-1 sm:flex-none')}
                    />
                    <Button variant="primary" onClick={() => confirmPush(walkItems[idx].goal)} disabled={!pushDate}>
                      Save date
                    </Button>
                    <Button variant="ghost" onClick={() => setPushOpen(false)}>
                      Cancel
                    </Button>
                  </span>
                )}
              </div>
            </div>
          </Panel>

          <Button variant="ghost" size="sm" onClick={() => setPhase('idle')} className="mt-4">
            Stop review{changes > 0 ? ` (${changes} change${changes === 1 ? '' : 's'} kept)` : ''}
          </Button>
        </Section>
      )}

      {/* Reflection → saves the ReviewSession */}
      {phase === 'reflect' && (
        <Panel className="space-y-4">
          <h3 className="font-display text-xl text-parchment">
            Review complete — <span className="tabular-nums">{changes}</span> change{changes === 1 ? '' : 's'} logged
          </h3>
          <p className="text-body text-parchment/60">
            Optional: an overall reflection for the whole plan (e.g. “Q2 review: two goals slipping, both tied to the new job”).
          </p>
          <textarea
            rows={3}
            aria-label="Review reflection"
            value={summaryNote}
            onChange={e => setSummaryNote(e.target.value)}
            placeholder="How did the plan evolve?"
            className={cx(inputClass, TEXTAREA)}
          />
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => saveSession()} disabled={saving}>
              {saving ? 'Saving…' : 'Save review session'}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
