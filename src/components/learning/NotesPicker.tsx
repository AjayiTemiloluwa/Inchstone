'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button, cx } from '@/components/ds'

export interface PickedNote { id: string; title: string; text: string }

const toText = (html: string) =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim()

/** Pick notes from the Notes page to bring into the Learning Lab. */
export function NotesPicker({ onPick, onClose, cta = 'Add selected' }: { onPick: (notes: PickedNote[]) => void; onClose: () => void; cta?: string }) {
  const [notes, setNotes] = useState<PickedNote[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/notes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setNotes(((d.notes || []) as { id: string; title: string; content: string }[]).map((n) => ({ id: n.id, title: n.title || 'Untitled', text: toText(n.content || '') }))) })
      .catch(() => { if (alive) setNotes([]) })
    return () => { alive = false }
  }, [])

  const shown = (notes ?? []).filter((n) => !q.trim() || `${n.title} ${n.text}`.toLowerCase().includes(q.toLowerCase()))
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="space-y-3 rounded-2xl border border-gold/25 bg-surface-solid p-4 animate-fadeIn">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold text-parchment">From your notes</p>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/50 hover:text-parchment"><X className="h-4 w-4" /></button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" aria-label="Search notes"
        className="min-h-10 w-full rounded-lg border border-gold/20 bg-ink/40 px-3 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none" />
      <ul className="max-h-72 space-y-1.5 overflow-y-auto" data-lenis-prevent>
        {notes === null && <li className="py-4 text-center text-sm text-parchment/45">Loading notes…</li>}
        {notes && shown.length === 0 && <li className="py-4 text-center text-sm text-parchment/45">No notes found.</li>}
        {shown.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => toggle(n.id)} aria-pressed={chosen.has(n.id)}
              className={cx('flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', chosen.has(n.id) ? 'border-gold/50 bg-gold/[0.08]' : 'border-gold/10 hover:border-gold/25')}>
              <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', chosen.has(n.id) ? 'border-gold bg-gold text-ink' : 'border-gold/30')}>
                {chosen.has(n.id) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-parchment">{n.title}</span>
                <span className="line-clamp-2 text-caption text-parchment/50">{n.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!chosen.size} onClick={() => onPick((notes ?? []).filter((n) => chosen.has(n.id)))}>{cta} {chosen.size ? `(${chosen.size})` : ''}</Button>
      </div>
    </div>
  )
}
