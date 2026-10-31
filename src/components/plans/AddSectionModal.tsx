'use client'

import { useState } from 'react'
import { Button, Field, inputClass } from '@/components/ds'
import { usePlansStore } from '@/stores/plansStore'
import { errMsg } from '@/lib/plans/errors'
import { FormNotice, Optional, PlanSheet, TEXTAREA } from './PlanSheet'

type Props = {
  planId: string
  initial?: { id: string; name: string; description: string | null } | null
  onClose: () => void
}

/** Sections are pure containers — just a name and optional description (§3) */
export function AddSectionModal({ planId, initial, onClose }: Props) {
  const { addSection, updateSection } = usePlansStore()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return setError('Give the section a name.')
    setSaving(true)
    setError(null)
    try {
      const res = initial
        ? await updateSection(initial.id, { name: name.trim(), description: description.trim() || null })
        : await addSection(planId, name.trim(), description.trim() || undefined)
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
      title={initial ? 'Edit section' : 'Add section'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add section'}
          </Button>
        </>
      }
    >
      <Field label="Name">
        <input
          id="sec-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='e.g. Career, Health, Financial, Spiritual'
          className={inputClass}
          autoFocus
        />
      </Field>

      <Field label={<>Description<Optional /></>}>
        <textarea
          id="sec-desc"
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
          className={`${inputClass} ${TEXTAREA}`}
        />
      </Field>

      {error && <FormNotice>{error}</FormNotice>}
    </PlanSheet>
  )
}
