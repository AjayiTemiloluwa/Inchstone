'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { usePlansStore } from '@/stores/plansStore'
import { errMsg } from '@/lib/plans/errors'

type Props = {
  planId: string
  initial?: { id: string; name: string; description: string | null } | null
  onClose: () => void
}

const INPUT =
  'w-full px-3.5 py-2.5 text-sm bg-black/20 border border-parchment/15 rounded-md text-parchment placeholder:text-parchment/25 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 [color-scheme:dark]'
const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-parchment/50'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-5 rounded-[8px] border hairline bg-ink p-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-parchment">{initial ? 'Edit Section' : 'Add Section'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-parchment/50 transition-colors hover:bg-mist hover:text-parchment">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sec-name" className={LABEL}>Name</label>
          <input
            id="sec-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder='e.g. Career, Health, Financial, Spiritual'
            className={INPUT}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sec-desc" className={LABEL}>
            Description <span className="font-normal normal-case text-parchment/35">(optional)</span>
          </label>
          <textarea
            id="sec-desc"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${INPUT} resize-none`}
          />
        </div>

        {error && <p className="rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-[#CD8B70]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="min-h-11 rounded-md px-4 text-sm text-parchment/60 transition-colors hover:bg-mist hover:text-parchment">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="min-h-11 rounded-md bg-gold px-5 text-sm font-semibold text-ink transition-colors hover:bg-gold-glow disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add section'}
          </button>
        </div>
      </div>
    </div>
  )
}