'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { usePlansStore } from '@/stores/plansStore'
import { GOAL_STATUSES, type GoalStatus, type PlanGoalRecord, type PlanMilestoneRecord } from '@/lib/plans/types'
import { STATUS_META } from '@/lib/plans/status'
import { errMsg } from '@/lib/plans/errors'
import { format } from 'date-fns'

type Props = {
  goal: PlanGoalRecord
  initial?: PlanMilestoneRecord | null
  onClose: () => void
}

const INPUT =
  'w-full px-3.5 py-2.5 text-sm bg-black/20 border border-parchment/15 rounded-md text-parchment placeholder:text-parchment/25 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 [color-scheme:dark]'
const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-parchment/50'

/**
 * Milestones break a Goal into checkpoints (§4).
 * Target date is constrained to the goal's own start → target window; the
 * server hard-blocks violations and the date input clamps up-front too.
 */
/**
 * Mounted only while visible — state initializes from `initial` directly.
 * Target date is constrained to the goal's own start → target window (§4).
 */
export function MilestoneFormModal({ goal, initial, onClose }: Props) {
  const { addMilestone, updateMilestone, fetchTrackerItems } = usePlansStore()
  const trackerMap = usePlansStore(s => s.trackerItems)
  const trackerItems = useMemo(() => Object.values(trackerMap), [trackerMap])
  const [title, setTitle] = useState(initial?.title ?? '')
  const [targetDate, setTargetDate] = useState(
    initial ? format(new Date(initial.targetDate), 'yyyy-MM-dd') : ''
  )
  const [status, setStatus] = useState<GoalStatus>(initial?.status ?? 'not_started')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [linkedItemId, setLinkedItemId] = useState(initial?.linkedItemId ?? '')

  useEffect(() => {
    fetchTrackerItems()
  }, [fetchTrackerItems])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minDate = format(new Date(goal.startDate), 'yyyy-MM-dd')
  const maxDate = format(new Date(goal.targetDate), 'yyyy-MM-dd')

  const handleSave = async () => {
    if (!title.trim()) return setError('Give the milestone a title.')
    if (!targetDate) return setError('Pick a target date between the goal’s start and target dates.')
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title: title.trim(),
        targetDate,
        status,
        notes: notes.trim() || null,
        linkedItemId: linkedItemId || null,
      }
      const res = initial
        ? await updateMilestone(initial.id, payload)
        : await addMilestone(goal.id, payload)
      if (!res.ok) throw new Error(res.error)
      onClose()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-5 rounded-[8px] border hairline bg-ink p-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-parchment">{initial ? 'Edit Milestone' : 'Add Milestone'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-parchment/50 transition-colors hover:bg-mist hover:text-parchment">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ms-title" className={LABEL}>Title</label>
          <input
            id="ms-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder='e.g. "2-year checkpoint: coursework done"'
            className={INPUT}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ms-date" className={LABEL}>Target date</label>
          <input
            id="ms-date"
            type="date"
            value={targetDate}
            min={minDate}
            max={maxDate}
            onChange={e => setTargetDate(e.target.value)}
            className={INPUT}
          />
          <p className="font-mono text-[11px] text-parchment/35">
            Must sit between {format(new Date(goal.startDate), 'd MMM yyyy')} and {format(new Date(goal.targetDate), 'd MMM yyyy')}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ms-status" className={LABEL}>Status</label>
          <select id="ms-status" value={status} onChange={e => setStatus(e.target.value as GoalStatus)} className={INPUT}>
            {GOAL_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ms-notes" className={LABEL}>
            Notes <span className="font-normal normal-case text-parchment/35">(optional)</span>
          </label>
          <textarea id="ms-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${INPUT} resize-none`} />
        </div>

        {/* Optional rollup source in the yearly tracker (§8) */}
        <div className="space-y-1.5">
          <label htmlFor="ms-link" className={LABEL}>
            Link to year tracker <span className="font-normal normal-case text-parchment/35">(optional)</span>
          </label>
          <select
            id="ms-link"
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

        {error && <p className="rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-[#CD8B70]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="min-h-11 rounded-md px-4 text-sm text-parchment/60 transition-colors hover:bg-mist hover:text-parchment">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="min-h-11 rounded-md bg-gold px-5 text-sm font-semibold text-ink transition-colors hover:bg-gold-glow disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add milestone'}
          </button>
        </div>
      </div>
    </div>
  )
}