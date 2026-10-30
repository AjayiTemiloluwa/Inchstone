'use client'

import { motion } from 'motion/react'
import { format } from 'date-fns'
import { Activity, BookOpen, Bell, CheckCircle2, Circle, Clock, Repeat, Star, Target, Trash2, X } from 'lucide-react'
import type { Item } from '@/stores/hierarchyStore'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { BottleMentionTextarea } from '@/components/ui/BottleMentionTextarea'
import { useDialog } from '@/components/ui/useDialog'
import { compactCountdownLabel, formatCountdown } from '@/lib/useCountdown'
import { BACKDROP_CLASS, SHEET_SAFE_AREA, type DeedModalData } from './types'

/**
 * Deed detail / edit modal. A bottom sheet on phones, a centred card from sm up.
 * Mount it inside <AnimatePresence> only while a deed is selected.
 */
export function DeedDetailModal({
  selectedDeed,
  totalPoints,
  currentDate,
  categories,
  completionMap,
  countdownNow,
  reflection,
  onReflectionChange,
  onChange,
  onToggleComplete,
  onSave,
  onClose,
  onDelete,
}: {
  selectedDeed: DeedModalData
  /** Day total points, to show this deed's share. */
  totalPoints: number
  currentDate: Date
  categories: Item[]
  completionMap: Record<string, number>
  countdownNow: Date
  reflection: string
  onReflectionChange: (text: string) => void
  onChange: (next: DeedModalData) => void
  onToggleComplete: () => void
  /** Persist and close (the X button and Save). */
  onSave: () => void
  /** Close without saving (Escape, backdrop, Cancel). */
  onClose: () => void
  onDelete: (e: React.MouseEvent, taskId: string) => Promise<void>
}) {
  const setSelectedDeed = onChange
  const panelRef = useDialog<HTMLDivElement>(true, onClose)
  return (
    <motion.div
      className={BACKDROP_CLASS}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Deed details"
        tabIndex={-1}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gold-dim/25 bg-surface-solid outline-none sm:max-w-lg sm:rounded-[8px] ${SHEET_SAFE_AREA}`}
        onClick={e => e.stopPropagation()}
      >
            {/* Header */}
            <div className="px-4 pt-5 pb-4 sm:px-7 sm:pt-7 shrink-0">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  <input
                    type="text"
                    value={selectedDeed.task.title}
                    onChange={e => {
                      const updated = { ...selectedDeed, task: { ...selectedDeed.task, title: e.target.value } }
                      setSelectedDeed(updated)
                    }}
                    placeholder="Deed title"
                    className="w-full text-xl sm:text-2xl font-display font-bold text-ink bg-transparent border-b-2 border-transparent hover:border-white/20 focus:border-gold/50 focus:outline-none px-1 py-1 transition-all placeholder:text-ink/30"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
                    <button
                      onClick={onToggleComplete}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedDeed.task.completed
                        ? 'bg-sage/20 text-sage border border-sage/30'
                        : 'border-gold-dim/30 text-parchment/80 hover:border-gold hover:bg-mist'
                        }`}
                    >
                      {selectedDeed.task.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      <span>{selectedDeed.task.completed ? 'Completed' : 'Mark Complete'}</span>
                    </button>
                    {selectedDeed.task.isFrog && (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full">
                        <Target className="w-3 h-3" />
                        <span>Frog</span>
                      </span>
                    )}
                    {selectedDeed.task.isImportant && (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>Important</span>
                      </span>
                    )}
                    {selectedDeed.task.isHabit && (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                        <Repeat className="w-3 h-3" />
                        <span>Habit</span>
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onSave} className="p-2.5 shrink-0 hover:bg-white/10 rounded-xl transition text-ink/50 hover:text-ink" title="Close & save">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 sm:px-7 pb-6 space-y-5 flex-1 min-h-0 overflow-y-auto" data-lenis-prevent>
              {/* Time section - Google Calendar style */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Date & Time</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Date</label>
                    <div className="mt-1 px-3 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-ink/80 font-mono">
                      {format(currentDate, 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Start Time</label>
                    <input
                      type="time"
                      value={selectedDeed.task.startTime ? format(new Date(selectedDeed.task.startTime as string), 'HH:mm') : ''}
                      onChange={e => {
                        const [h, m] = e.target.value.split(':')
                        const newStart = selectedDeed.task.startTime ? new Date(selectedDeed.task.startTime as string) : new Date()
                        newStart.setHours(parseInt(h), parseInt(m))
                        setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, startTime: newStart.toISOString() } })
                      }}
                      className="w-full mt-1 px-3 py-2.5 text-sm font-mono bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">End Time</label>
                    <input
                      type="time"
                      value={selectedDeed.task.endTime ? format(new Date(selectedDeed.task.endTime as string), 'HH:mm') : ''}
                      onChange={e => {
                        const [h, m] = e.target.value.split(':')
                        const newEnd = selectedDeed.task.endTime ? new Date(selectedDeed.task.endTime as string) : (selectedDeed.task.startTime ? new Date(selectedDeed.task.startTime as string) : new Date())
                        newEnd.setHours(parseInt(h), parseInt(m))
                        setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, endTime: newEnd.toISOString() } })
                      }}
                      className="w-full mt-1 px-3 py-2.5 text-sm font-mono bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                    />
                  </div>
                  <div className="col-span-2 flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => {
                        const now = new Date()
                        const start = new Date(now)
                        start.setMinutes(Math.floor(start.getMinutes() / 30) * 30)
                        const end = new Date(start)
                        end.setHours(end.getHours() + 1)
                        setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, startTime: start.toISOString(), endTime: end.toISOString() } })
                      }}
                      className="px-3 py-1 text-[10px] font-bold text-ink/50 border border-dashed border-white/20 rounded-lg hover:border-gold/50 hover:text-gold transition"
                    >
                      + Set to now
                    </button>
                    <button
                      onClick={() => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, startTime: null, endTime: null } })}
                      className="px-3 py-1 text-[10px] font-bold text-ink/50 border border-dashed border-white/20 rounded-lg hover:border-ember/60 hover:text-[#e0a093] transition"
                    >
                      Clear time
                    </button>
                  </div>
                </div>

                {/* Live countdown for this scheduled deed */}
                {(() => {
                  const st = selectedDeed.task.startTime
                  if (!st) return null
                  const pt = formatCountdown(countdownNow, new Date(st), selectedDeed.task.endTime ? new Date(selectedDeed.task.endTime) : null)
                  if (!pt) return null
                  const label = compactCountdownLabel(pt)
                  const isLive = pt.state === 'live'
                  const isSoon = pt.state === 'future' && pt.soon
                  return (
                    <div
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 animate-fadeIn ${
                        isLive ? 'border-moss/40 bg-moss/10' : isSoon ? 'border-ember/40 bg-ember/10' : 'border-gold/30 bg-gold/10'
                      }`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isLive ? 'bg-moss/20 text-sage' : isSoon ? 'bg-ember/20 text-[#e0a093]' : 'bg-gold/20 text-gold'}`}>
                        {isLive ? <Activity className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${isLive ? 'text-sage' : isSoon ? 'text-[#e0a093]' : 'text-gold'}`}>
                          {isLive ? '● In progress' : isSoon ? 'Starting soon' : 'Countdown'}
                        </p>
                        <p className="font-mono text-lg font-bold text-ink tabular-nums leading-tight">{label}</p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Details section */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <Target className="w-3.5 h-3.5" />
                  <span>Details</span>
                </p>
                {/* Very-important toggle + its alarm lead */}
                <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition ${selectedDeed.task.isImportant ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-black/10'}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, isImportant: !selectedDeed.task.isImportant } })}
                    className="flex items-center space-x-2 text-left"
                  >
                    <Star className={`w-4 h-4 shrink-0 ${selectedDeed.task.isImportant ? 'fill-gold text-gold' : 'text-ink/40'}`} />
                    <span>
                      <span className="block text-xs font-bold text-ink">Very important</span>
                      <span className="block text-[10px] text-ink/50">Rings an alarm before it starts</span>
                    </span>
                  </button>
                  {selectedDeed.task.isImportant && (
                    <select
                      value={String(selectedDeed.task.reminderMinutes ?? 10)}
                      onChange={e => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, reminderMinutes: parseInt(e.target.value, 10) } })}
                      className="shrink-0 px-2.5 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                    >
                      <option value="0">At start time</option>
                      <option value="5">5 min before</option>
                      <option value="10">10 min before</option>
                      <option value="15">15 min before</option>
                      <option value="30">30 min before</option>
                      <option value="60">1 hour before</option>
                    </select>
                  )}
                </div>

                {/* Notify-me toggle — pins a live countdown + finish alert */}
                <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition ${selectedDeed.task.notifyDeed ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-black/10'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !selectedDeed.task.notifyDeed
                      setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, notifyDeed: next } })
                      // Ask for permission the moment they opt in.
                      if (next) {
                        try {
                          if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                            Notification.requestPermission().catch(() => {})
                          }
                        } catch {
                          /* notifications unavailable — skip */
                        }
                      }
                    }}
                    className="flex items-center space-x-2 text-left"
                  >
                    <Bell className={`w-4 h-4 shrink-0 ${selectedDeed.task.notifyDeed ? 'text-gold' : 'text-ink/40'}`} />
                    <span>
                      <span className="block text-xs font-bold text-ink">Notify me</span>
                      <span className="block text-[10px] text-ink/50">Pins a live countdown + light finish alert</span>
                    </span>
                  </button>
                  {selectedDeed.task.notifyDeed && selectedDeed.task.startTime && (
                    <select
                      value={String(selectedDeed.task.endWarnMinutes ?? 10)}
                      onChange={e => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, endWarnMinutes: parseInt(e.target.value, 10) } })}
                      className="shrink-0 px-2.5 py-1.5 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
                    >
                      <option value="5">5 min before end</option>
                      <option value="10">10 min before end</option>
                      <option value="15">15 min before end</option>
                    </select>
                  )}
                  {!selectedDeed.task.startTime && (
                    <span className="shrink-0 text-[10px] text-ink/40">Add a start time to enable</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Points &middot; {totalPoints > 0 ? Math.round((selectedDeed.task.weight / totalPoints) * 100) : 0}% of day</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="range" min="1" max={Math.max(100, Math.ceil(selectedDeed.task.weight))}
                        value={selectedDeed.task.weight}
                        onChange={e => {
                          const w = parseFloat(e.target.value)
                          setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, weight: w } })
                        }}
                        className="flex-1 h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold"
                      />
                      <input
                        type="number" min="1" step="any"
                        value={selectedDeed.task.weight}
                        onChange={e => {
                          const w = parseFloat(e.target.value) || 1
                          setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, weight: w } })
                        }}
                        className="w-14 px-1.5 py-1.5 text-xs font-mono bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80 text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-ink/40 font-bold uppercase">Progress</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="range" min="0" max="100"
                        value={Math.round(selectedDeed.task.progress)}
                        onChange={e => {
                          const p = parseFloat(e.target.value)
                          setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, progress: p } })
                        }}
                        className="flex-1 h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage"
                      />
                      <span className="w-10 text-center text-xs font-mono text-sage font-bold">{Math.round(selectedDeed.task.progress)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category / Color tag */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <span className="text-sm">🏷️</span>
                  <span>Category</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, categoryId: null } })}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition ${!selectedDeed.task.categoryId
                      ? 'bg-white/10 border-white/30 text-ink'
                      : 'border-white/10 text-ink/50 hover:border-white/30'
                      }`}
                  >
                    No tag
                  </button>
                  {categories.map((cat, idx) => {
                    const catColors = ['#d4af37', '#8fbc8f', '#6495ed', '#ff7f50', '#9370db', '#3cb371', '#ffd700', '#00bfff']
                    const color = catColors[idx % catColors.length]
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedDeed({ ...selectedDeed, task: { ...selectedDeed.task, categoryId: cat.id } })}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition flex items-center space-x-1.5 ${selectedDeed.task.categoryId === cat.id
                          ? 'border-current text-ink'
                          : 'border-white/10 text-ink/50 hover:border-white/30'
                          }`}
                        style={selectedDeed.task.categoryId === cat.id ? { borderColor: color, backgroundColor: `${color}15`, color } : {}}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span>{cat.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recurrence */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Repeat</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {['', 'daily', 'weekly', 'weekdays', 'monthly', 'yearly'].map(pattern => (
                    <button
                      key={pattern}
                      onClick={() => {
                        const isRecurring = pattern !== ''
                        setSelectedDeed({
                          ...selectedDeed,
                          task: {
                            ...selectedDeed.task,
                            isRecurring,
                            recurrencePattern: pattern || null,
                          }
                        })
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition ${(pattern === '' && !selectedDeed.task.isRecurring) || selectedDeed.task.recurrencePattern === pattern
                        ? 'bg-white/10 border-white/30 text-ink'
                        : 'border-white/10 text-ink/50 hover:border-white/30'
                        }`}
                    >
                      {pattern === '' ? 'Does not repeat' :
                        pattern === 'daily' ? 'Daily' :
                          pattern === 'weekly' ? 'Weekly' :
                            pattern === 'weekdays' ? 'Weekdays' :
                              pattern === 'monthly' ? 'Monthly' : 'Yearly'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reflection */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-ink/40 tracking-wider flex items-center space-x-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Reflection</span>
                </p>
                <BottleMentionTextarea
                  value={reflection}
                  onChange={onReflectionChange}
                  placeholder="What did you learn? How did it go?  e.g. @Workout 400 press-ups"
                  sourceRef={`deed-${selectedDeed.task.id}`}
                  className="w-full h-28 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all"
                />
              </div>

              {/* Goal contribution */}
              {selectedDeed.parentGoal && (
                <div className="bg-gradient-to-r from-black/30 to-black/10 border border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-[9px] font-bold uppercase text-ink/40 tracking-wider">Contributes To</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                      <span className="text-sm font-bold text-ink truncate">{selectedDeed.parentGoal.title}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-gold">{Math.round(completionMap[selectedDeed.parentGoal.id] || 0)}%</span>
                  </div>
                  <ProgressBar progress={completionMap[selectedDeed.parentGoal.id] || 0} colorClass="bg-gold" />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-7 py-3 sm:py-4 border-t border-white/10 bg-black/20 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={async (e) => {
                  await onDelete(e, selectedDeed.task.id)
                }}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs text-[#cf8f78] hover:bg-ember/10 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={onClose} className="px-4 sm:px-5 py-2.5 text-sm font-bold text-ink/60 hover:text-ink hover:bg-white/5 rounded-xl transition">Cancel</button>
                <button onClick={onSave} className="px-6 py-2.5 bg-gold text-ink text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:opacity-70   flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
      </motion.div>
    </motion.div>
  )
}
