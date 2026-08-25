'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  QUICK_PICKS,
  cadenceOptionsForSpan,
  endFromQuickPick,
  formatSpan,
  isValidMonthRange,
} from '@/lib/plans/duration'
import { errMsg } from '@/lib/plans/errors'
import type { LongTermPlanRecord, ReviewCadence } from '@/lib/plans/types'

type Props = {
  /** When provided the modal edits an existing plan instead of creating */
  initial?: LongTermPlanRecord | null
  onClose: () => void
  onSaved: (plan: LongTermPlanRecord) => void
}

const INPUT =
  'w-full px-3.5 py-2.5 text-sm bg-black/20 border border-parchment/15 rounded-md text-parchment placeholder:text-parchment/25 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 [color-scheme:dark]'
const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-parchment/50'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[8px] border hairline bg-ink p-6 space-y-5"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-parchment">{initial ? 'Edit Plan' : 'New Long-Term Plan'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-parchment/50 hover:text-parchment hover:bg-mist transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="plan-title" className={LABEL}>Title</label>
          <input
            id="plan-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder='e.g. "7-Year Kingdom & Career Plan"'
            className={INPUT}
            autoFocus
          />
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className={LABEL}>Duration</label>
          <div className="flex items-center gap-3">
            <input
              type="month"
              aria-label="Start month"
              value={startMonth}
              onChange={e => setStartMonth(e.target.value)}
              className={`${INPUT} flex-1`}
            />
            <span className="text-xs text-parchment/40 shrink-0">to</span>
            <input
              type="month"
              aria-label="End month"
              value={endMonth}
              min={startMonth || undefined}
              onChange={e => setEndMonth(e.target.value)}
              className={`${INPUT} flex-1`}
            />
          </div>
          <p className="min-h-5 pt-0.5 font-mono text-xs text-gold" aria-live="polite">
            {spanText ? `↳ ${spanText}` : startMonth && endMonth ? '↳ end month is before start month' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_PICKS.map(qp => {
              const active = Boolean(startMonth) && endFromQuickPick(startMonth, qp.months) === endMonth
              return (
                <button
                  key={qp.label}
                  type="button"
                  disabled={!startMonth}
                  onClick={() => applyQuickPick(qp.months)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                    active
                      ? 'border-gold/60 bg-gold/15 text-gold'
                      : 'border-parchment/15 text-parchment/60 hover:border-gold/40 hover:text-parchment'
                  }`}
                >
                  {qp.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Anchor note */}
        <div className="space-y-1.5">
          <label htmlFor="plan-anchor" className={LABEL}>
            Anchor note <span className="font-normal normal-case text-parchment/35">(optional)</span>
          </label>
          <input
            id="plan-anchor"
            type="text"
            value={anchorNote}
            onChange={e => setAnchorNote(e.target.value)}
            placeholder="A guiding phrase, mission statement or quote"
            className={INPUT}
          />
        </div>

        {/* Cadence */}
        <div className="space-y-1.5">
          <label htmlFor="plan-cadence" className={LABEL}>Review cadence</label>
          <select
            id="plan-cadence"
            value={effectiveCadence}
            onChange={e => setCadence(e.target.value as ReviewCadence)}
            className={INPUT}
          >
            {(cadenceOptions.length > 0 ? cadenceOptions : [{ value: 'monthly' as const, label: 'Monthly' }]).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-parchment/35">
            {validRange ? 'Options adapt to this plan’s length.' : 'Pick the duration above to see suitable options.'}
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-[#CD8B70]">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="min-h-11 rounded-md px-4 text-sm text-parchment/60 transition-colors hover:bg-mist hover:text-parchment">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="min-h-11 rounded-md bg-gold px-5 text-sm font-semibold text-ink transition-colors hover:bg-gold-glow disabled:opacity-50"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  )
}