'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button, IconButton, cx, inputClass } from '@/components/ds'
import { useDialog } from '@/components/ui/useDialog'
import { useToast } from '@/components/ui/ToastProvider'
import type { Item } from '@/stores/hierarchyStore'

export type ItemEditField = 'title' | 'description' | 'theme' | 'focusQuestion' | 'anchorScripture' | 'dates' | 'parent'

interface ItemEditDialogProps {
  item: Item
  heading: string
  fields: ItemEditField[]
  /** For the "parent" field: where the item can be moved to (e.g. the year's categories). */
  parentOptions?: { id: string; title: string }[]
  parentLabel?: string
  onClose: () => void
  /** Called after a successful save so the page can reload the tree. */
  onSaved?: () => unknown
}

const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

/** Edit the full details of one plan item (a yearly goal, a quarter…) in a proper form, saved in one request. */
export function ItemEditDialog({ item, heading, fields, parentOptions, parentLabel = 'Category', onClose, onSaved }: ItemEditDialogProps) {
  const { showToast } = useToast()
  const ref = useDialog<HTMLDivElement>(true, onClose)
  const [v, setV] = useState({
    title: item.title,
    description: item.description ?? '',
    theme: item.theme ?? '',
    focusQuestion: item.focusQuestion ?? '',
    anchorScripture: item.anchorScripture ?? '',
    startDate: day(item.startDate),
    endDate: day(item.endDate),
    parentId: item.parentId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }))
  const has = (f: ItemEditField) => fields.includes(f)

  const datesBad = has('dates') && v.startDate && v.endDate && v.endDate < v.startDate
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (has('title') && !v.title.trim()) { showToast('Give it a name', 'error'); return }
    if (datesBad) { showToast('The end date must be on or after the start date', 'error'); return }
    // Send only what changed, so an untouched field can never be overwritten.
    const body: Record<string, unknown> = {}
    const same = (a: string, b: string | null) => a === (b ?? '')
    if (has('title') && v.title.trim() !== item.title) body.title = v.title.trim()
    if (has('description') && !same(v.description, item.description)) body.description = v.description.trim() || null
    if (has('theme') && !same(v.theme, item.theme)) body.theme = v.theme.trim() || null
    if (has('focusQuestion') && !same(v.focusQuestion, item.focusQuestion)) body.focusQuestion = v.focusQuestion.trim() || null
    if (has('anchorScripture') && !same(v.anchorScripture, item.anchorScripture)) body.anchorScripture = v.anchorScripture.trim() || null
    if (has('dates')) {
      if (v.startDate !== day(item.startDate)) body.startDate = v.startDate || null
      if (v.endDate !== day(item.endDate)) body.endDate = v.endDate || null
    }
    if (has('parent') && v.parentId && v.parentId !== item.parentId) body.parentId = v.parentId
    if (!Object.keys(body).length) { onClose(); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { showToast((await res.json().catch(() => ({}))).error || 'Could not save the changes', 'error'); return }
      await onSaved?.()
      showToast('Saved', 'success')
      onClose()
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  const label = 'mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/55'
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn sm:items-center" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={heading} tabIndex={-1} onClick={(e) => e.stopPropagation()} data-lenis-prevent
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gold-dim/25 bg-surface-solid outline-none animate-slideUp sm:max-w-lg sm:rounded-[8px]">
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Edit</p>
              <h3 className="mt-0.5 truncate font-display text-lg font-bold text-parchment">{heading}</h3>
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {has('title') && (
              <div><label className={label} htmlFor="ied-title">Name</label>
                <input id="ied-title" autoFocus value={v.title} onChange={set('title')} className={inputClass} /></div>
            )}
            {has('description') && (
              <div><label className={label} htmlFor="ied-desc">Description</label>
                <textarea id="ied-desc" rows={3} value={v.description} onChange={set('description')} placeholder="What does success look like?" className={cx(inputClass, 'py-2.5')} /></div>
            )}
            {has('theme') && (
              <div><label className={label} htmlFor="ied-theme">Theme</label>
                <input id="ied-theme" value={v.theme} onChange={set('theme')} placeholder="One word or phrase that frames it" className={inputClass} /></div>
            )}
            {has('focusQuestion') && (
              <div><label className={label} htmlFor="ied-focus">Focus question</label>
                <input id="ied-focus" value={v.focusQuestion} onChange={set('focusQuestion')} placeholder="What must be true by the end?" className={inputClass} /></div>
            )}
            {has('anchorScripture') && (
              <div><label className={label} htmlFor="ied-verse">Anchor scripture</label>
                <input id="ied-verse" value={v.anchorScripture} onChange={set('anchorScripture')} placeholder="e.g. Proverbs 16:3" className={inputClass} /></div>
            )}
            {has('parent') && parentOptions && parentOptions.length > 0 && (
              <div><label className={label} htmlFor="ied-parent">{parentLabel}</label>
                <select id="ied-parent" value={v.parentId} onChange={set('parentId')} className={inputClass}>
                  {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select></div>
            )}
            {has('dates') && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className={label} htmlFor="ied-start">Start date</label>
                  <input id="ied-start" type="date" value={v.startDate} onChange={set('startDate')} className={inputClass} /></div>
                <div><label className={label} htmlFor="ied-end">End date</label>
                  <input id="ied-end" type="date" min={v.startDate || undefined} value={v.endDate} onChange={set('endDate')} className={inputClass} /></div>
                {datesBad && <p role="alert" className="text-caption text-ember sm:col-span-2">The end date must be on or after the start date.</p>}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !!datesBad}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
