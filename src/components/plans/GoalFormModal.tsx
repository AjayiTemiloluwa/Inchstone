'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ds'
import { usePlansStore } from '@/stores/plansStore'
import { GOAL_STATUSES, type GoalStatus, type PlanGoalRecord } from '@/lib/plans/types'
import { STATUS_META } from '@/lib/plans/status'
import { isValidMonthRange } from '@/lib/plans/duration'
import { errMsg } from '@/lib/plans/errors'
import { DATE_SCHEME, FormNotice, Optional, PlanSheet, TEXTAREA } from './PlanSheet'

type Props = {
  sectionId: string
  /** Plan range used for defaults + soft warnings */
  planStartMonth: string
  planEndMonth: string
  initial?: PlanGoalRecord | null
  onClose: () => void
}

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

  // Only the goal itself is required; every other prompt is optional, and the
  // target date falls back to the plan's end.
  const complete = Boolean(texts.overallGoal.trim())

  // Soft warning when dates fall outside the plan range (§3 — warn, not block)
  const outOfRange = useMemo(() => {
    const msgs: string[] = []
    if (!isValidMonthRange(planStartMonth, planEndMonth)) return msgs
    const inPlan = (s: string) => s.slice(0, 7) >= planStartMonth && s.slice(0, 7) <= planEndMonth
    if (startDate && !inPlan(startDate)) msgs.push('start date')
    if (targetDate && !inPlan(targetDate)) msgs.push('target date')
    return msgs
  }, [startDate, targetDate, planStartMonth, planEndMonth])

  const handleSave = async (asDraft: boolean) => {
    if (!asDraft && !complete) return setError('Write the overall goal first, or save it as a draft.')
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
    <PlanSheet
      title={initial ? 'Edit goal' : 'New goal'}
      eyebrow="Personal development plan"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!complete && (
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving}>
              Save as draft
            </Button>
          )}
          <Button variant="primary" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : complete ? 'Save goal' : 'Save goal'}
          </Button>
        </>
      }
    >
      {/* Six PDP fields — placeholders are the prompts themselves */}
      {PDP_FIELDS.map(f => (
        <Field key={f.key} label={f.key === 'overallGoal' ? f.label : <>{f.label}<span className="normal-case tracking-normal text-parchment/35"> (optional)</span></>}>
          <textarea
            id={`goal-${f.key}`}
            rows={f.rows}
            value={texts[f.key]}
            onChange={e => setTexts(t => ({ ...t, [f.key]: e.target.value }))}
            placeholder={f.prompt}
            className={`${inputClass} ${TEXTAREA}`}
          />
        </Field>
      ))}

      {/* Dates + status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={<>Start date<span className="normal-case tracking-normal text-parchment/35"> (defaults to plan start)</span></>}>
          <input
            id="goal-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={`${inputClass} ${DATE_SCHEME}`}
          />
        </Field>
        {/* Sixth PDP field */}
        <Field label={<>Target date for completion<span className="normal-case tracking-normal text-parchment/35"> (defaults to plan end)</span></>}>
          <input
            id="goal-target"
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            placeholder="What is the date you want to complete this by?"
            className={`${inputClass} ${DATE_SCHEME}`}
          />
        </Field>
      </div>

      {outOfRange.length > 0 && (
        <FormNotice>
          Heads-up: the {outOfRange.join(' and ')} fall outside this plan’s range ({planStartMonth} → {planEndMonth}). You can still save it.
        </FormNotice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select id="goal-status" value={status} onChange={e => setStatus(e.target.value as GoalStatus)} className={inputClass}>
            {GOAL_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </Field>
        <Field label={<>Link to year tracker<Optional /></>}>
          <select
            id="goal-link"
            value={linkedItemId}
            onChange={e => setLinkedItemId(e.target.value)}
            className={inputClass}
          >
            <option value="">Not linked</option>
            {trackerItems.map(i => (
              <option key={i.id} value={i.id}>
                {i.title} · {Math.round(i.progress)}%
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <FormNotice>{error}</FormNotice>}
    </PlanSheet>
  )
}

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function firstOfMonthInput(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}
