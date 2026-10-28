'use client'

import { useState } from 'react'
import { Bell, Repeat, Star } from 'lucide-react'
import type { Item } from '@/stores/hierarchyStore'
import type { NewDeedValues } from './types'

const SWATCHES = ['#d4af37', '#8fbc8f', '#6495ed', '#ff7f50', '#9370db', '#3cb371', '#ffd700', '#00bfff', '#ff6b6b', '#a8e6cf', '#ffb347', '#ba68c8']

/**
 * Inline "add a deed" form. It owns all of its field state and is only
 * mounted while open, so every opening starts from a clean slate.
 */
export function AddDeedForm({
  initialStart,
  initialEnd,
  initialWeight,
  categories,
  saving,
  onCancel,
  onSubmit,
}: {
  initialStart: string
  initialEnd: string
  initialWeight: string
  categories: Item[]
  saving: boolean
  onCancel: () => void
  onSubmit: (values: NewDeedValues) => Promise<boolean>
}) {
  const [title, setTitle] = useState('')
  const [newDeedStart, setNewDeedStart] = useState(initialStart)
  const [newDeedEnd, setNewDeedEnd] = useState(initialEnd)
  const [newDeedWeight, setNewDeedWeight] = useState(initialWeight)
  const [newDeedCategory, setNewDeedCategory] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState('')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [isFrog, setIsFrog] = useState(false)
  const [newDeedImportant, setNewDeedImportant] = useState(false)
  const [newDeedReminder, setNewDeedReminder] = useState('10')
  const [newDeedNotify, setNewDeedNotify] = useState(true)
  const [newDeedEndWarn, setNewDeedEndWarn] = useState('10')
  const [isHabit, setIsHabit] = useState(false)
  const [deedColor, setDeedColor] = useState('')

  // Follow the prefill when the grid is clicked again while the form is open.
  const [seenPrefill, setSeenPrefill] = useState({ start: initialStart, end: initialEnd })
  if (seenPrefill.start !== initialStart || seenPrefill.end !== initialEnd) {
    setSeenPrefill({ start: initialStart, end: initialEnd })
    setNewDeedStart(initialStart)
    setNewDeedEnd(initialEnd)
  }

  const submit = () => {
    if (!title.trim() || saving) return
    void onSubmit({
      title,
      start: newDeedStart,
      end: newDeedEnd,
      categoryId: newDeedCategory,
      isRecurring,
      recurrencePattern,
      recurrenceEnd,
      isFrog,
      isHabit,
      isImportant: newDeedImportant,
      reminder: newDeedReminder,
      notify: newDeedNotify,
      endWarn: newDeedEndWarn,
      color: deedColor,
    })
  }

  return (
              <div className="pt-4 border-t border-white/10 animate-fadeIn space-y-4">
                {/* What → title */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-ink/40">What are you doing?</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    placeholder="Deed title…"
                    autoFocus
                    className="w-full px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 text-ink"
                  />
                </div>

                {/* When → time range */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-ink/40">Time (optional)</label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input type="time" value={newDeedStart} onChange={e => setNewDeedStart(e.target.value)}
                      className="min-w-0 px-3 py-2.5 text-sm font-mono bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80" />
                    <span className="text-ink/30 text-xs">–</span>
                    <input type="time" value={newDeedEnd} onChange={e => setNewDeedEnd(e.target.value)}
                      className="min-w-0 px-3 py-2.5 text-sm font-mono bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80" />
                  </div>
                </div>

                {/* Group → category + weight */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-ink/40">Category</label>
                    <select value={newDeedCategory} onChange={e => setNewDeedCategory(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80">
                      <option value="">None</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-ink/40">Weight</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={newDeedWeight} onChange={e => setNewDeedWeight(e.target.value)}
                        min="1" max="100" placeholder="Wt"
                        className="w-20 px-3 py-2.5 text-sm font-mono bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80" />
                      <span className="text-xs text-ink/40">% of the day</span>
                    </div>
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-ink/40">Accent color</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {SWATCHES.map(c => (
                      <button
                        key={c}
                        onClick={() => setDeedColor(deedColor === c ? '' : c)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                          deedColor === c ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`color ${c}`}
                      >
                        {deedColor === c && <span className="text-[#0a0908] font-bold text-xs">✓</span>}
                      </button>
                    ))}
                    <button onClick={() => setDeedColor('')} className={`px-2 py-1 text-[9px] font-bold rounded border ${!deedColor ? 'bg-white/20 border-white/40 text-ink' : 'border-white/10 text-ink/50'}`}>None</button>
                  </div>
                </div>
          {/* Flags */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={isFrog} onChange={e => setIsFrog(e.target.checked)}
                      className="w-4 h-4 rounded border-mist text-gold focus:ring-gold" />
                    <span className="text-xs font-bold text-ink/70 flex items-center space-x-1">
                      <span className="text-sm">🐸</span><span>Eat That Frog</span>
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isHabit}
                      onChange={e => {
                        setIsHabit(e.target.checked)
                        if (e.target.checked) { setIsRecurring(true); setRecurrencePattern('daily') }
                      }}
                      className="w-4 h-4 rounded accent-moss focus:ring-moss" />
                    <span className="text-xs font-bold text-ink/70 flex items-center space-x-1">
                      <span className="text-sm">🌱</span><span>Habit</span>
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded accent-gold focus:ring-gold" />
                    <span className="text-xs font-bold text-ink/70 flex items-center space-x-1">
                      <Repeat className="w-3.5 h-3.5" /><span>Recurring</span>
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={newDeedImportant} onChange={e => setNewDeedImportant(e.target.checked)}
                      className="w-4 h-4 rounded accent-gold focus:ring-gold" />
                    <span className="text-xs font-bold text-ink/70 flex items-center space-x-1">
                      <Star className="w-3.5 h-3.5 text-gold" /><span>Very important</span>
                    </span>
                  </label>
                  {newDeedImportant && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-ink/40">Ring alarm</span>
                      <select
                        value={newDeedReminder}
                        onChange={e => setNewDeedReminder(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                      >
                        <option value="0">At start time</option>
                        <option value="5">5 min before</option>
                        <option value="10">10 min before</option>
                        <option value="15">15 min before</option>
                        <option value="30">30 min before</option>
                        <option value="60">1 hour before</option>
                      </select>
                    </div>
                  )}
                                    <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDeedNotify}
                      disabled={!newDeedStart}
                      onChange={e => {
                        setNewDeedNotify(e.target.checked)
                        // Ask for permission the moment they opt in.
                        if (e.target.checked) {
                          try {
                            if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                              Notification.requestPermission().catch(() => {})
                            }
                          } catch {
                            /* notifications unavailable — skip */
                          }
                        }
                      }}
                      className="w-4 h-4 rounded accent-gold focus:ring-gold" />
                    <span className={`text-xs font-bold ${newDeedStart ? 'text-ink/70' : 'text-ink/35'} flex items-center space-x-1`}>
                      <Bell className="w-3.5 h-3.5 text-gold" /><span>Notify me</span>
                    </span>
                  </label>
                  {!newDeedStart && (
                    <p className="w-full text-[10px] text-ink/40">Add a start time to pin a countdown + finish alert.</p>
                  )}
                  {newDeedNotify && newDeedStart && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-ink/40">Ring before end</span>
                      <select
                        value={newDeedEndWarn}
                        onChange={e => setNewDeedEndWarn(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                      >
                        <option value="5">5 min before end</option>
                        <option value="10">10 min before end</option>
                        <option value="15">15 min before end</option>
                      </select>
                    </div>
                  )}
                  {isRecurring && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={recurrencePattern}
                        onChange={e => setRecurrencePattern(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                      >
                        <option value="">Every…</option>
                        <option value="daily">Day</option>
                        <option value="weekly">Week</option>
                        <option value="biweekly">2 weeks</option>
                        <option value="monthly">Month</option>
                        <option value="yearly">Year</option>
                        <option value="weekdays">Weekdays</option>
                      </select>
                      <input
                        type="date"
                        value={recurrenceEnd}
                        onChange={e => setRecurrenceEnd(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                        placeholder="End date"
                      />
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
                  <button
                    onClick={onCancel}
                    className="px-4 py-2.5 text-sm font-bold text-ink/60 hover:text-ink hover:bg-white/5 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={saving || !title.trim()}
                    className="px-5 py-2.5 bg-gold text-ink text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Adding…' : '+ Add Deed'}
                  </button>
                </div>
              </div>
  )
}
