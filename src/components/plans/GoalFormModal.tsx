'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { usePlansStore } from '@/stores/plansStore'
import { GOAL_STATUSES, type GoalStatus, type PlanGoalRecord } from '@/lib/plans/types'
import { STATUS_META } from '@/lib/plans/status'
import { isValidMonthRange } from '@/lib/plans/duration'
import { errMsg } from '@/lib/plans/errors'

type Props = {
  sectionId: string
  /** Plan range used for defaults + soft warnings */
  planStartMonth: string
  planEndMonth: string
  initial?: PlanGoalRecord | null
  onClose: () => void
}

const INPUT =
  'w-full px-3.5 py-2.5 text-sm bg-black/20 border border-parchment/15 rounded-md text-parchment placeholder:text-parchment/25 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 [color-scheme:dark]'
const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-parchment/50'

/** The six PDP prompts, in fixed order (§1) */
export const PDP_FIELDS = [
  {
    key: 'overallGoal',
    label: 'Overall goal',
    prompt: 'What is your overall goal? What do you want to achieve?',
    rows: 2,
  },
  {
    key: 'developmentOpportunity',
    label: 'Development opportunity',
    prompt: 'What’s the gap or opportunity you need to grow into to meet that goal?',
    rows: 3,
  },
  {
    key: 'actionsPlanned',
    label: 'What I will do',
    prompt: 'What specific actions will you take?',
    rows: 3,
  },
  {
    key: 'resourcesAndSupport',
    label: 'Resources and support needed',
    prompt: 'What resources might you need, and who will help you?',
    rows: 3,
  },
  {
    key: 'successCriteria',
    label: 'What success looks like',
    prompt: 'How will you know when you’ve achieved success?',
    rows: 3,
  },
] as const

type TextKey = (typeof PDP_FIELDS)[number]['key']

/**
 * Mounted only while visible — the six PDP answers initialize from `initial`.
 */
export function GoalFormModal({ sectionId, planStartMonth, planEndMonth, initial, onClose }: Props) {
  const { addGoal, updateGoal, fetchTrackerItems } = usePlansStore()
  const trackerMap = usePlansStore(s => s.trackerItems)
  const trackerItems = useMemo(() => Object.values(trackerMap), [trackerMap])
  const [texts, setTexts] = useState<Record<TextKey, string>>({
    overallGoal: initial?.overallGoal ?? '',
    developmentOpportunity: initial?.developmentOpportunity ?? '',
    actionsPlanned: initial?.actionsPlanned ?? '',
    resourcesAndSupport: initial?.resourcesAndSupport ?? '',
    successCriteria: initial?.successCriteria ?? '',
  })
  // Start defaults to the Plan's start month (§3); target left empty = plan end (server default)
  const [startDate, setStartDate] = useState(
    initial ? formatDateInput(new Date(initial.startDate)) : firstOfMonthInput(planStartMonth)
  )
  const [targetDate, setTargetDate] = useState(
    initial ? formatDateInput(new Date(initial.targetDate)) : ''
  )
  const [status, setStatus] = useState<GoalStatus>(initial?.status ?? 'not_started')
  const [linkedItemId, setLinkedItemId] = useState(initial?.linkedItemId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Optional link targets from the existing yearly tracker (§8) — additive only
  useEffect(() => {
    fetchTrackerItems()
  }, [fetchTrackerItems])

  const complete = Object.values(texts).every(v => v.trim()) && Boolean(targetDate)

  // Soft warning when dates fall outside the plan range (§3 — warn, not block)
  const outOfRange = useMemo(() => {
    const msgs: string[] = []
    if (!isValidMonthRange(planStartMonth, planEndMonth)) return msgs
    const inPlan = (s: string) => s.slice(0, 7) >= planStartMonth && s.slice(0, 7) <= planEndMonth
    if (startDate && !inPlan(startDate)) msgs.push('start date')
    if (targetDate && !inPlan(targetDate)) msgs.push('target date')
    return msgs
  }, [startDate, targetDate, planStartMonth, planEndMonth])

  const missing: string[] = PDP_FIELDS.filter(f => !texts[f.key].trim()).map(f => f.label)

  const handleSave = async (asDraft: boolean) => {
    if (!asDraft && !complete) {
      const needs = [...missing]
      if (!targetDate) needs.push('Target date')
      return setError(`To mark this goal active, fill: ${needs.join(', ')}. Or save it as a draft.`)
    }
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        ...texts,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
        status,
        linkedItemId: linkedItemId || null,
        isDraft: asDraft || !complete,
      }
      const res = initial ? await updateGoal(initial.id, payload) : await addGoal(sectionId, payload)
      if (!res.ok) throw new Error(res.error)
      onClose()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-[8px] border hairline bg-ink p-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-parchment">{initial ? 'Edit Goal' : 'New Goal'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-parchment/50 transition-colors hover:bg-mist hover:text-parchment">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!complete && (
          <p className="rounded-md border border-dashed border-parchment/25 px-3 py-2 text-xs text-parchment/55">
            Fill all six fields to mark this goal <span className="text-gold">active</span> — anything less saves as a{' '}
            <span className="italic">draft flagged “incomplete”</span>.
          </p>
        )}
        {/* Six PDP fields — placeholders are the prompts themselves */}
        {PDP_FIELDS.map(f => (
          <div key={f.key} className="space-y-1.5">
            <label htmlFor={`goal-${f.key}`} className={LABEL}>{f.label}</label>
            <textarea
              id={`goal-${f.key}`}
              rows={f.rows}
              value={texts[f.key]}
              onChange={e => setTexts(t => ({ ...t, [f.key]: e.target.value }))}
              placeholder={f.prompt}
              className={`${INPUT} resize-none`}
            />
          </div>
        ))}

        {/* Dates + status */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="goal-start" className={LABEL}>Start date <span className="font-normal normal-case text-parchment/35">(defaults to plan start)</span></label>
            <input
              id="goal-start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={INPUT}
            />
          </div>
          <div className="space-y-1.5">
            {/* Sixth PDP field */}
            <label htmlFor="goal-target" className={LABEL}>Target date for completion</label>
            <input
              id="goal-target"
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              placeholder="What is the date you want to complete this by?"
              className={INPUT}
            />
          </div>
        </div>

        {outOfRange.length > 0 && (
          <p className="rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-[#CD8B70]">
            Heads-up: the {outOfRange.join(' and ')} fall outside this plan’s range ({planStartMonth} → {planEndMonth}). You can still save it.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="goal-status" className={LABEL}>Status</label>
            <select id="goal-status" value={status} onChange={e => setStatus(e.target.value as GoalStatus)} className={INPUT}>
              {GOAL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="goal-link" className={LABEL}>
              Link to year tracker <span className="font-normal normal-case text-parchment/35">(optional)</span>
            </label>
            <select
              id="goal-link"
              value={linkedItemId}
              onChange={e => setLinkedItemId(e.target.value)}
              className={INPUT}
            >
              <option value="">Not linked</option>
              {trackerItems.map(i => (
                <option key={i.id} value={i.id}>
                  {i.title} · {Math.round(i.progress)}%
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-[#CD8B70]">{error}</p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button onClick={onClose} className="min-h-11 rounded-md px-4 text-sm text-parchment/60 transition-colors hover:bg-mist hover:text-parchment">
            Cancel
          </button>
          {!complete && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="min-h-11 rounded-md border border-parchment/25 px-4 text-sm text-parchment/75 transition-colors hover:border-gold/40 hover:text-parchment disabled:opacity-50"
            >
              Save as draft
            </button>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="min-h-11 rounded-md bg-gold px-5 text-sm font-semibold text-ink transition-colors hover:bg-gold-glow disabled:opacity-50"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : complete ? 'Save goal' : 'Save goal'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function firstOfMonthInput(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}