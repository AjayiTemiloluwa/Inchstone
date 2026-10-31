'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Badge, Button, EmptyState, IconButton, Panel, RowActions, Section, TONE_TEXT, cx, inputClass, type RowAction } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'
import { Meter, Percent, healthTone } from '../primitives'

interface HabitSummary {
  title: string
  total: number
  completed: number
  /** Days still to come; 0 = stopped, only history left. */
  upcoming?: number
  latestDate?: string
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data: { error?: string } = await res.json()
    return data.error || fallback
  } catch {
    return fallback
  }
}

/** Habits section: list, add, rename and delete (future-only or everything). */
export function YearHabits() {
  const { showToast, confirm } = useToast()
  const [habits, setHabits] = useState<HabitSummary[]>([])
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameSubmitted = useRef(false)

  const loadHabits = useCallback(async (): Promise<HabitSummary[] | null> => {
    try {
      const res = await fetch('/api/habits?range=year')
      if (!res.ok) return null
      const data: { uniqueTitles?: HabitSummary[] } = await res.json()
      return data.uniqueTitles || []
    } catch (e) {
      console.error('Failed to fetch habits', e)
      return null
    }
  }, [])

  const fetchHabits = useCallback(async () => {
    const list = await loadHabits()
    if (list) setHabits(list)
  }, [loadHabits])

  useEffect(() => {
    let cancelled = false
    loadHabits().then(list => { if (!cancelled && list) setHabits(list) })
    return () => { cancelled = true }
  }, [loadHabits])

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    try {
      const res = await fetch('/api/habits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      if (res.ok) {
        showToast('Habit created for the rest of the year!', 'success')
        setNewTitle('')
        setAdding(false)
        void fetchHabits()
      } else {
        showToast(await errorMessage(res, 'Failed to create habit'), 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
  }

  const handleDeleteFuture = async (title: string) => {
    try {
      const res = await fetch(`/api/habits?title=${encodeURIComponent(title)}`, { method: 'DELETE' })
      if (res.ok) {
        const data: { kept?: number } = await res.json().catch(() => ({}))
        showToast(data.kept
          ? 'Habit stopped. Past days are kept for your history — choose "Delete completely" to remove it.'
          : 'Habit deleted', 'success')
        void fetchHabits()
      } else {
        showToast(await errorMessage(res, 'Failed to delete habit'), 'error')
      }
    } catch (e) { console.error(e) }
  }

  const handleDeleteAll = async (title: string) => {
    if (!(await confirm(`Delete ALL instances of "${title}" including past data? This cannot be undone.`))) {
      return
    }
    try {
      const res = await fetch(`/api/habits?title=${encodeURIComponent(title)}&deleteAll=true`, { method: 'DELETE' })
      if (res.ok) {
        setHabits(list => list.filter(h => h.title !== title))
        showToast('Habit deleted completely', 'success')
        void fetchHabits()
      } else {
        showToast(await errorMessage(res, 'Failed to delete habit'), 'error')
      }
    } catch (e) { console.error(e) }
  }

  const handleRename = async (oldTitle: string) => {
    if (renameSubmitted.current) return
    const value = renameValue.trim()
    if (!value || value === oldTitle) { setRenaming(null); return }
    renameSubmitted.current = true
    try {
      const res = await fetch('/api/habits', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTitle, newTitle: value }),
      })
      if (res.ok) {
        showToast('Habit renamed — all instances updated', 'success')
        setRenaming(null)
        void fetchHabits()
      } else {
        showToast(await errorMessage(res, 'Failed to rename habit'), 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    } finally {
      renameSubmitted.current = false
    }
  }

  return (
    <Section title="Habits" id="year-habits"
      action={
        <>
          <Badge>{habits.length}</Badge>
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setAdding(true); setNewTitle('') }}>Add habit</Button>
        </>
      }>
      {adding && (
        <Panel className="mb-4 space-y-2 animate-fadeIn">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus aria-label="Habit name"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Habit name (e.g., 'Morning run', 'Read 30 mins')..."
              className={cx(inputClass, 'flex-1 min-w-0')} />
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAdd} className="flex-1 sm:flex-none">Create habit</Button>
              <IconButton icon={X} label="Cancel" onClick={() => setAdding(false)} />
            </div>
          </div>
          <p className="text-caption text-parchment/45">This will create daily habit instances for the rest of the year.</p>
        </Panel>
      )}

      {habits.length === 0 && !adding ? (
        <EmptyState title="No habits yet" body="Add daily habits to build consistency." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {habits.map(ht => {
            const pct = ht.total > 0 ? Math.round((ht.completed / ht.total) * 100) : 0
            const ended = ht.upcoming === 0
            const actions: RowAction[] = [
              { label: 'Rename habit', icon: Pencil, onSelect: () => { setRenaming(ht.title); setRenameValue(ht.title) } },
              // A stopped habit has no future days left, so only "delete completely" applies.
              ...(!ended ? [{ label: 'Delete future instances only', icon: X, onSelect: () => { void handleDeleteFuture(ht.title) } }] : []),
              { label: 'Delete completely (including past)', icon: Trash2, destructive: true, onSelect: () => { void handleDeleteAll(ht.title) } },
            ]
            return (
              <Panel key={ht.title} padded={false} className="group space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  {renaming === ht.title ? (
                    <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} aria-label="Habit name"
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleRename(ht.title)
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      onBlur={() => void handleRename(ht.title)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gold/40 bg-ink/40 px-2 text-sm font-semibold text-parchment outline-none focus:ring-2 focus:ring-gold/30" />
                  ) : (
                    <h3 className="min-w-0 flex-1 break-words pt-2 text-sm font-semibold leading-snug text-parchment pointer-fine:pt-1.5">
                      {ht.title}
                      {ended && <Badge className="ml-2 align-middle">Ended</Badge>}
                    </h3>
                  )}
                  <RowActions label={`Actions for ${ht.title}`} actions={actions} />
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] tabular-nums text-parchment/50">{ht.completed}/{ht.total} days done</span>
                  <Percent value={pct} className={cx('text-heading', TONE_TEXT[healthTone(pct)])} />
                </div>
                <Meter value={pct} tone={healthTone(pct)} />
              </Panel>
            )
          })}
        </div>
      )}
    </Section>
  )
}
