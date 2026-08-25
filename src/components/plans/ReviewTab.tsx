'use client'

/**
 * Review tab (§7): a low-friction pass over every Goal ("Still on track?"),
 * each action writing to the same history log; finishing saves a ReviewSession.
 * Past sessions are listed chronologically below.
 */
import { useMemo, useState } from 'react'
import { CalendarCheck, ClipboardList, Play } from 'lucide-react'
import { format } from 'date-fns'
import { usePlansStore } from '@/stores/plansStore'
import { CADENCE_LABELS, type LongTermPlanRecord, type PlanGoalRecord } from '@/lib/plans/types'
import { StatusBadge } from './StatusBadge'

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

  return (
    <div className="space-y-6">
      {/* Idle: cadence banner + past sessions + start CTA */}
      {phase === 'idle' && (
        <>
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[8px] border px-4 py-3 ${cadenceDue ? 'border-gold/35 bg-gold/[0.06]' : 'border-parchment/15 bg-black/20'}`}>
            <div className="flex items-center gap-2.5">
              <CalendarCheck className={`h-4 w-4 shrink-0 ${cadenceDue ? 'text-gold' : 'text-parchment/50'}`} strokeWidth={1.5} />
              <p className="text-xs text-parchment/65">
                {lastSession ? (
                  <>
                    Last reviewed <span className="font-mono">{format(new Date(lastSession.conductedAt), 'd MMM yyyy')}</span> ·{' '}
                    {CADENCE_LABELS[plan.reviewCadence] ?? plan.reviewCadence} cadence
                    {cadenceDue ? ' — a review is due' : ''}
                  </>
                ) : (
                  <>
                    Never reviewed · {CADENCE_LABELS[plan.reviewCadence] ?? plan.reviewCadence} cadence — reviews can be run anytime
                  </>
                )}
              </p>
            </div>
            <button
              onClick={startWalk}
              disabled={walkItems.length === 0}
              title={walkItems.length === 0 ? 'Add goals to review first' : undefined}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-gold px-4 text-xs font-semibold text-ink transition-colors hover:bg-gold-glow disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" /> Start review ({walkItems.length} goals)
            </button>
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-parchment/40">
              <ClipboardList className="h-3.5 w-3.5" /> Past reviews · {sessions.length}
            </p>
            {sessions.length === 0 ? (
              <p className="text-xs text-parchment/40">
                Reviews you complete will appear here, so you can scroll back and watch how the plan evolved.
              </p>
            ) : (
              <ol className="relative ml-1.5 space-y-4 border-l border-parchment/15 pl-4">
                {sessions.map(s => (
                  <li key={s.id} className="relative">
                    <span aria-hidden className="absolute -left-[21px] top-1 block h-2 w-2 rotate-45 bg-gold-dim" />
                    <p className="font-mono text-[11px] text-parchment/45">{format(new Date(s.conductedAt), 'EEEE d MMMM yyyy · HH:mm')}</p>
                    {s.summaryNote ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm italic leading-relaxed text-parchment/75">“{s.summaryNote}”</p>
                    ) : (
                      <p className="mt-1 text-xs text-parchment/35">No reflection note.</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
      {/* Walk-through */}
      {phase === 'walk' && walkItems[idx] && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-wider text-parchment/40">
              Goal {idx + 1} of {walkItems.length}
            </p>
            <div className="flex h-1 w-40 overflow-hidden rounded-full bg-parchment/10">
              <div className="bg-gold transition-all" style={{ width: `${((idx + 1) / walkItems.length) * 100}%` }} />
            </div>
          </div>

          <div className="rounded-[8px] border hairline bg-black/20 p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gold">{walkItems[idx].sectionName}</p>
            <h3 className="mt-2 whitespace-pre-wrap font-display text-lg leading-snug text-parchment">
              {(walkItems[idx].goal.overallGoal ?? '').trim() || 'Untitled draft'}
            </h3>
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-parchment/45">
              <StatusBadge status={walkItems[idx].goal.status} />
              <span>
                target {format(new Date(walkItems[idx].goal.targetDate), 'd MMM yyyy')}
              </span>
              {(walkItems[idx].goal.milestones?.length ?? 0) > 0 && (
                <span>{walkItems[idx].goal.milestones!.length} milestone{walkItems[idx].goal.milestones!.length === 1 ? '' : 's'}</span>
              )}
            </span>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-parchment/45">Still on track?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => applyStatus(walkItems[idx].goal)} className="min-h-11 rounded-md border border-moss/50 bg-moss/15 px-4 text-sm font-medium text-[#9DB98F] transition-colors hover:bg-moss/25">
                Yes
              </button>
              <button onClick={() => applyStatus(walkItems[idx].goal, 'at_risk')} className="min-h-11 rounded-md border border-ember/45 bg-ember/15 px-4 text-sm font-medium text-[#CD8B70] transition-colors hover:bg-ember/25">
                At Risk
              </button>
              <button onClick={() => applyStatus(walkItems[idx].goal, 'achieved')} className="min-h-11 rounded-md border border-gold/40 bg-gold/10 px-4 text-sm font-medium text-gold transition-colors hover:bg-gold/20">
                Achieved
              </button>
              {!pushOpen ? (
                <button onClick={() => setPushOpen(true)} className="min-h-11 rounded-md border border-parchment/20 px-4 text-sm text-parchment/70 transition-colors hover:border-parchment/40 hover:text-parchment">
                  Push target date
                </button>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  <input type="date" value={pushDate} onChange={e => setPushDate(e.target.value)} className="rounded-md border border-parchment/15 bg-black/30 px-3 py-2 text-xs text-parchment [color-scheme:dark]" />
                  <button onClick={() => confirmPush(walkItems[idx].goal)} disabled={!pushDate} className="min-h-11 rounded-md bg-gold px-3 text-xs font-semibold text-ink disabled:opacity-40">Save date</button>
                  <button onClick={() => setPushOpen(false)} className="text-xs text-parchment/50 hover:text-parchment">Cancel</button>
                </span>
              )}
            </div>
          </div>

          <button onClick={() => setPhase('idle')} className="text-xs text-parchment/45 underline underline-offset-2 transition-colors hover:text-parchment">
            Stop review{changes > 0 ? ` (${changes} change${changes === 1 ? '' : 's'} kept)` : ''}
          </button>
        </div>
      )}

      {/* Reflection → saves the ReviewSession */}
      {phase === 'reflect' && (
        <div className="space-y-4 rounded-[8px] border hairline bg-black/20 p-5">
          <h3 className="font-display text-lg text-parchment">Review complete — {changes} change{changes === 1 ? '' : 's'} logged</h3>
          <p className="text-xs text-parchment/55">Optional: an overall reflection for the whole plan (e.g. “Q2 review: two goals slipping, both tied to the new job”).</p>
          <textarea
            rows={3}
            value={summaryNote}
            onChange={e => setSummaryNote(e.target.value)}
            placeholder="How did the plan evolve?"
            className="w-full resize-none rounded-md border border-parchment/15 bg-black/30 px-3.5 py-2.5 text-sm text-parchment placeholder:text-parchment/25 focus:border-gold/50 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => saveSession()} disabled={saving} className="min-h-11 rounded-md bg-gold px-5 text-sm font-semibold text-ink transition-colors hover:bg-gold-glow disabled:opacity-50">
              {saving ? 'Saving…' : 'Save review session'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}