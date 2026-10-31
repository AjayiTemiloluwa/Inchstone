'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Button, Field, inputClass } from '@/components/ds'
import { usePlansStore } from '@/stores/plansStore'
import { GOAL_STATUSES, type GoalStatus, type PlanGoalRecord, type PlanMilestoneRecord } from '@/lib/plans/types'
import { STATUS_META } from '@/lib/plans/status'
import { errMsg } from '@/lib/plans/errors'
import { DATE_SCHEME, FormNotice, Optional, PlanSheet, TEXTAREA } from './PlanSheet'

type Props = {
  goal: PlanGoalRecord
  initial?: PlanMilestoneRecord | null
  onClose: () => void
}

/**
 * Milestones break a Goal into checkpoints (§4).
 * Mounted only while visible — state initializes from `initial` directly.
 * Target date is constrained to the goal's own start → target window; the
 * server hard-blocks violations and the date input clamps up-front too.
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
    <PlanSheet
      title={initial ? 'Edit milestone' : 'Add milestone'}
      onClose={onClose}
      zClass="z-[60]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add milestone'}
          </Button>
        </>
      }
    >
      <Field label="Title">
        <input
          id="ms-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder='e.g. "2-year checkpoint: coursework done"'
          className={inputClass}
          autoFocus
        />
      </Field>

      <Field
        label="Target date"
        hint={
          <span className="font-mono tabular-nums">
            Must sit between {format(new Date(goal.startDate), 'd MMM yyyy')} and {format(new Date(goal.targetDate), 'd MMM yyyy')}
          </span>
        }
      >
        <input
          id="ms-date"
          type="date"
          value={targetDate}
          min={minDate}
          max={maxDate}
          onChange={e => setTargetDate(e.target.value)}
          className={`${inputClass} ${DATE_SCHEME}`}
        />
      </Field>

      <Field label="Status">
        <select id="ms-status" value={status} onChange={e => setStatus(e.target.value as GoalStatus)} className={inputClass}>
          {GOAL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </Field>

      <Field label={<>Notes<Optional /></>}>
        <textarea id="ms-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputClass} ${TEXTAREA}`} />
      </Field>

      {/* Optional rollup source in the yearly tracker (§8) */}
      <Field label={<>Link to year tracker<Optional /></>}>
        <select
          id="ms-link"
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

      {error && <FormNotice>{error}</FormNotice>}
    </PlanSheet>
  )
}
