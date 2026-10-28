'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useToast } from '@/components/ui/ToastProvider'

interface HabitSummary {
  title: string
  total: number
  completed: number
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
  const [deleteMenu, setDeleteMenu] = useState<string | null>(null)
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
        showToast('Future instances deleted (past history preserved)', 'success')
        void fetchHabits()
      } else {
        showToast(await errorMessage(res, 'Failed to delete habit'), 'error')
      }
    } catch (e) { console.error(e) }
    setDeleteMenu(null)
  }

  const handleDeleteAll = async (title: string) => {
    if (!(await confirm(`Delete ALL instances of "${title}" including past data? This cannot be undone.`))) {
      setDeleteMenu(null)
      return
    }
    try {
      const res = await fetch(`/api/habits?title=${encodeURIComponent(title)}&deleteAll=true`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Habit deleted completely', 'success')
        void fetchHabits()
      } else {
        showToast(await errorMessage(res, 'Failed to delete habit'), 'error')
      }
    } catch (e) { console.error(e) }
    setDeleteMenu(null)
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
        setDeleteMenu(null)
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

  const iconBtn = 'p-1 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 rounded transition text-ink/30 min-w-[36px] min-h-[36px] flex items-center justify-center'

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink flex items-center gap-2 sm:gap-3">
          🌱 Habits
          <span className="text-xs font-mono font-normal bg-white/10 px-2 py-0.5 sm:py-1 rounded-full text-ink/60">{habits.length}</span>
        </h2>
        <button type="button" onClick={() => { setAdding(true); setNewTitle('') }}
          className="flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium bg-gold/10 text-gold rounded-lg border border-gold/30 hover:bg-gold/20 active:opacity-70 transition min-h-[40px]">
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Add Habit</span>
        </button>
      </div>

      {adding && (
        <Card className="p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Habit name (e.g., 'Morning run', 'Read 30 mins')..."
              className="flex-1 min-w-0 px-4 py-3 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 min-h-[44px]" />
            <div className="flex space-x-2">
              <button type="button" onClick={handleAdd}
                className="flex-1 sm:flex-none px-4 py-3 bg-gold text-ink text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:opacity-70 min-h-[44px]">
                Create Habit
              </button>
              <button type="button" onClick={() => setAdding(false)} aria-label="Cancel"
                className="px-4 py-3 text-ink/50 hover:text-ink hover:bg-white/5 rounded-xl transition min-h-[44px]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-ink/40 mt-2">This will create daily habit instances for the rest of the year.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {habits.map(ht => {
          const pct = ht.total > 0 ? Math.round((ht.completed / ht.total) * 100) : 0
          return (
            <Card key={ht.title} className="p-4 space-y-3 hover:border-gold/50 active:opacity-70 transition-colors group">
              <div className="flex items-center justify-between gap-2">
                {renaming === ht.title ? (
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleRename(ht.title)
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    onBlur={() => void handleRename(ht.title)}
                    className="min-w-0 flex-1 rounded-lg border border-gold/40 bg-white/[0.07] px-2 py-1 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-gold/30" />
                ) : (
                  <h3 className="min-w-0 flex-1 break-words font-bold text-ink text-sm leading-snug">{ht.title}</h3>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" title="Rename habit" aria-label="Rename habit"
                    onClick={e => { e.stopPropagation(); setRenaming(ht.title); setRenameValue(ht.title) }}
                    className={`${iconBtn} hover:bg-gold/15 hover:text-gold`}>
                    <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <div className="relative">
                    <button type="button" aria-label="Delete habit" aria-expanded={deleteMenu === ht.title}
                      onClick={() => setDeleteMenu(deleteMenu === ht.title ? null : ht.title)}
                      className={`${iconBtn} hover:bg-ember/15 hover:text-[#cf8f78]`}>
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    {deleteMenu === ht.title && (
                      <div className="absolute right-0 top-9 z-50 bg-paper border border-mist rounded-xl p-2 w-[min(14rem,calc(100vw-3rem))] animate-fadeIn">
                        <p className="text-[10px] text-ink/50 px-3 py-1 font-bold uppercase">Delete options</p>
                        <button type="button" onClick={() => handleDeleteFuture(ht.title)} className="w-full text-left px-3 py-2.5 text-xs text-ink hover:bg-mist rounded-lg transition flex items-center space-x-2">
                          <X className="w-3.5 h-3.5 shrink-0" />
                          <span>Delete future instances only</span>
                        </button>
                        <button type="button" onClick={() => handleDeleteAll(ht.title)} className="w-full text-left px-3 py-2.5 text-xs text-[#cf8f78] hover:bg-ember/15 rounded-lg transition flex items-center space-x-2">
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Delete completely (including past)</span>
                        </button>
                        <button type="button" onClick={() => setDeleteMenu(null)} className="w-full text-left px-3 py-2.5 text-xs text-ink/50 hover:bg-mist rounded-lg transition">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>{ht.completed}/{ht.total} days done</span>
                <span className="font-mono font-bold text-gold">{pct}%</span>
              </div>
              <ProgressBar progress={pct} colorClass={pct >= 80 ? 'bg-sage' : pct >= 40 ? 'bg-gold' : 'bg-ember'} />
            </Card>
          )
        })}
        {habits.length === 0 && !adding && (
          <Card className="p-6 col-span-full text-center">
            <p className="text-sm text-ink/50">No habits yet. Add daily habits to build consistency!</p>
          </Card>
        )}
      </div>
    </div>
  )
}
