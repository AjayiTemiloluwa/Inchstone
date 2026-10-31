'use client'

import { useMemo, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ds'
import {
  QUICK_PICKS,
  cadenceOptionsForSpan,
  endFromQuickPick,
  formatSpan,
  isValidMonthRange,
} from '@/lib/plans/duration'
import { errMsg } from '@/lib/plans/errors'
import type { LongTermPlanRecord, ReviewCadence } from '@/lib/plans/types'
import { DATE_SCHEME, FIELD_LABEL, FormNotice, Optional, PlanSheet } from './PlanSheet'

type Props = {
  /** When provided the modal edits an existing plan instead of creating */
  initial?: LongTermPlanRecord | null
  onClose: () => void
  onSaved: (plan: LongTermPlanRecord) => void
}

/**
 * Mounted only while visible (parents conditionally render), so form state
 * initializes straight from `initial` — no reset effects needed.
 */
export function PlanFormModal({ initial, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? '')
  const [endMonth, setEndMonth] = useState(initial?.endMonth ?? '')
  const [anchorNote, setAnchorNote] = useState(initial?.anchorNote ?? '')
  const [cadence, setCadence] = useState<ReviewCadence>(initial?.reviewCadence ?? 'monthly')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validRange = Boolean(startMonth && endMonth && isValidMonthRange(startMonth, endMonth))
  const spanText = validRange ? formatSpan(startMonth, endMonth) : null
  const cadenceOptions = useMemo(
    () => (validRange ? cadenceOptionsForSpan(startMonth, endMonth) : []),
    [validRange, startMonth, endMonth]
  )
  // If dates don't allow the selected cadence anymore, fall back to the longest offered
  const effectiveCadence: ReviewCadence = cadenceOptions.some(o => o.value === cadence)
    ? cadence
    : cadenceOptions[cadenceOptions.length - 1]?.value ?? 'monthly'

  const applyQuickPick = (months: number) => {
    if (!startMonth) return
    setEndMonth(endFromQuickPick(startMonth, months))
  }

  const handleSave = async () => {
    if (!title.trim()) return setError('Give your plan a title.')
    if (!validRange) return setError('Pick a valid start month and end month (end can’t precede start).')
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(initial ? `/api/plans/${initial.id}` : '/api/plans', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          startMonth,
          endMonth,
          anchorNote: anchorNote.trim() || null,
          reviewCadence: effectiveCadence,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save plan')
      onSaved(json.plan)
      onClose()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PlanSheet
      title={initial ? 'Edit plan' : 'New long-term plan'}
      eyebrow="Long-Term"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create plan'}
          </Button>
        </>
      }
    >
      <Field label="Title">
        <input
          id="plan-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder='e.g. "7-Year Kingdom & Career Plan"'
          className={inputClass}
          autoFocus
        />
      </Field>

      {/* Duration is a group, not a <label>, because it holds several controls */}
      <div role="group" aria-labelledby="plan-duration-label" className="flex flex-col gap-1.5">
        <span id="plan-duration-label" className={FIELD_LABEL}>Duration</span>
        <div className="flex items-center gap-3">
          <input
            type="month"
            aria-label="Start month"
            value={startMonth}
            onChange={e => setStartMonth(e.target.value)}
            className={`${inputClass} ${DATE_SCHEME} min-w-0 flex-1`}
          />
          <span className="shrink-0 text-caption text-parchment/40">to</span>
          <input
            type="month"
            aria-label="End month"
            value={endMonth}
            min={startMonth || undefined}
            onChange={e => setEndMonth(e.target.value)}
            className={`${inputClass} ${DATE_SCHEME} min-w-0 flex-1`}
          />
        </div>
        <p className="min-h-5 font-mono text-mono tabular-nums text-gold" aria-live="polite">
          {spanText ? `↳ ${spanText}` : startMonth && endMonth ? '↳ end month is before start month' : ''}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PICKS.map(qp => {
            const active = Boolean(startMonth) && endFromQuickPick(startMonth, qp.months) === endMonth
            return (
              <button
                key={qp.label}
                type="button"
                aria-pressed={active}
                disabled={!startMonth}
                onClick={() => applyQuickPick(qp.months)}
                className={`min-h-11 rounded-full border px-3 text-xs transition-colors pointer-fine:min-h-8 disabled:cursor-not-allowed disabled:opacity-35 ${
                  active
                    ? 'border-gold/60 bg-gold/10 text-gold'
                    : 'border-gold/15 text-parchment/60 hover:border-gold/40 hover:text-parchment'
                }`}
              >
                {qp.label}
              </button>
            )
          })}
        </div>
      </div>

      <Field label={<>Anchor note<Optional /></>}>
        <input
          id="plan-anchor"
          type="text"
          value={anchorNote}
          onChange={e => setAnchorNote(e.target.value)}
          placeholder="A guiding phrase, mission statement or quote"
          className={inputClass}
        />
      </Field>

      <Field
        label="Review cadence"
        hint={validRange ? 'Options adapt to this plan’s length.' : 'Pick the duration above to see suitable options.'}
      >
        <select
          id="plan-cadence"
          value={effectiveCadence}
          onChange={e => setCadence(e.target.value as ReviewCadence)}
          className={inputClass}
        >
          {(cadenceOptions.length > 0 ? cadenceOptions : [{ value: 'monthly' as const, label: 'Monthly' }]).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>

      {error && <FormNotice>{error}</FormNotice>}
    </PlanSheet>
  )
}
