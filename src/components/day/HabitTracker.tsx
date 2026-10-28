'use client'

import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Activity, CheckCircle2, ChevronDown, Clock, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { Scramble } from '@/components/ui/motion'
import { HabitSparkline } from '@/components/ui/HabitSparkline'
import { HabitTrend } from './HabitTrend'
import {
  HABIT_PATTERN_LABEL,
  type GraphRange,
  type HabitDetail,
  type HabitHistoryEntry,
  type HabitOverviewEntry,
} from './types'

/** The unified Habit Tracker card: today's habits, off-day habits and the trend graph. */
export function HabitTracker({
  displayedHabits,
  offDayHabits,
  hasOverview,
  habitDetail,
  habitSeriesByTitle,
  habitHistory,
  range,
  customStart,
  customEnd,
  onRangeChange,
  onCustomStart,
  onCustomEnd,
  onApplyCustom,
  onQuickAdd,
  onToggleHabit,
  onDelete,
  onRename,
}: {
  displayedHabits: Task[]
  offDayHabits: HabitOverviewEntry[]
  hasOverview: boolean
  habitDetail: Record<string, HabitDetail>
  habitSeriesByTitle: Record<string, boolean[]>
  habitHistory: HabitHistoryEntry[]
  range: GraphRange
  customStart: string
  customEnd: string
  onRangeChange: (r: GraphRange) => void
  onCustomStart: (v: string) => void
  onCustomEnd: (v: string) => void
  onApplyCustom: () => void
  onQuickAdd: (title: string, pattern: string) => Promise<void>
  onToggleHabit: (task: Task) => Promise<void>
  onDelete: (e: React.MouseEvent, taskId: string) => void
  /** Resolves true when the rename went through. */
  onRename: (oldTitle: string, newTitle: string) => Promise<boolean>
}) {
  const [newHabitTitle, setNewHabitTitle] = useState('')
  const [newHabitPattern, setNewHabitPattern] = useState('daily')
  const [showHabitAdd, setShowHabitAdd] = useState(false)
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null)
  const [renamingHabitRow, setRenamingHabitRow] = useState<string | null>(null)
  const [renameHabitRowValue, setRenameHabitRowValue] = useState('')
  const renameSubmittedRef = useRef(false)

  const habitsDone = displayedHabits.filter(h => h.completed).length
  const habitsTotal = displayedHabits.length

  const submitRename = async (oldTitle: string) => {
    if (renameSubmittedRef.current) return
    const value = renameHabitRowValue.trim()
    if (!value || value === oldTitle) {
      setRenamingHabitRow(null)
      return
    }
    renameSubmittedRef.current = true
    try {
      const ok = await onRename(oldTitle, value)
      if (ok) {
        setRenamingHabitRow(null)
        setExpandedHabit(null)
      }
    } finally {
      renameSubmittedRef.current = false
    }
  }

  return (
      <Card className="p-4 sm:p-5 border border-gold/30">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10">
                <Activity className="w-4 h-4 text-gold" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-ink"><Scramble text="Habit Tracker" mono={false} /></h2>
                  {habitsTotal > 0 && (
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                      habitsDone === habitsTotal ? 'border-sage/30 bg-sage/10 text-sage' : 'border-gold/25 bg-gold/10 text-gold'
                    }`}>
                      {habitsDone}/{habitsTotal} today
                      {offDayHabits.length > 0 && (
                        <span className="text-ink/35"> · {offDayHabits.length} off-day</span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink/45 truncate">
                  {offDayHabits.length > 0
                    ? `Repeats automatically — ${offDayHabits.length} habit${offDayHabits.length === 1 ? '' : 's'} not due today, listed below`
                    : 'Repeats automatically — check in each day'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHabitAdd(v => !v)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                showHabitAdd ? 'border-gold/40 bg-gold/15 text-gold' : 'border-gold/25 bg-gold/10 text-gold hover:bg-gold/20'
              }`}
            >
              {showHabitAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showHabitAdd ? 'Close' : 'New habit'}
            </button>
          </div>

          {/* Quick-add (collapsible to keep the box compact) */}
          {showHabitAdd && (
            <div className="mb-4 flex flex-wrap items-center gap-2 animate-fadeIn">
              <input
                type="text"
                value={newHabitTitle}
                onChange={e => setNewHabitTitle(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newHabitTitle.trim()) {
                    const title = newHabitTitle.trim()
                    setNewHabitTitle('')
                    await onQuickAdd(title, newHabitPattern)
                  }
                }}
                autoFocus
                placeholder="New habit title…"
                className="flex-1 min-w-[150px] px-3 py-2 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80 placeholder:text-ink/30"
              />
              <select
                value={newHabitPattern}
                onChange={e => setNewHabitPattern(e.target.value)}
                className="px-2.5 py-2 text-xs bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 text-ink/80"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekdays">Weekdays</option>
              </select>
              <button
                onClick={async () => {
                  if (newHabitTitle.trim()) {
                    const title = newHabitTitle.trim()
                    setNewHabitTitle('')
                    await onQuickAdd(title, newHabitPattern)
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold bg-gold text-ink rounded-lg hover:bg-gold-glow transition flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
          )}

          {/* Today's Habits — compact rows */}
          <div className="space-y-1.5">
            {displayedHabits.map((task, idx) => {
              const detail = habitDetail[task.title]
              const expanded = expandedHabit === task.title
              return (
                <div key={task.id} className="space-y-1.5">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedHabit(expanded ? null : task.title)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedHabit(expanded ? null : task.title) } }}
                data-cursor={expanded ? 'Hide days & trend' : 'Show days & trend'}
                className={`group flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border px-3 py-2.5 transition-all sm:flex-nowrap sm:gap-3 sm:px-2.5 sm:py-2 ${expanded ? 'border-gold/40 bg-gold/[0.04]' : task.completed ? 'border-sage/25 bg-sage/[0.05]' : 'border-white/10 bg-black/15 hover:border-gold/40'}`}
              >
                <span className="hidden w-4 shrink-0 text-center font-mono text-[10px] text-ink/30 tabular-nums min-[400px]:block">{idx + 1}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); void onToggleHabit(task) }}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border transition-colors sm:h-5 sm:w-5 ${
                    task.completed ? 'border-sage bg-sage text-ink' : 'border-white/20 text-transparent hover:border-gold'
                  }`}
                  aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
                {renamingHabitRow === task.id ? (
                  <input
                    autoFocus
                    value={renameHabitRowValue}
                    onChange={e => setRenameHabitRowValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.stopPropagation(); submitRename(task.title) }
                      if (e.key === 'Escape') { e.stopPropagation(); setRenamingHabitRow(null) }
                    }}
                    onBlur={() => submitRename(task.title)}
                    onClick={e => e.stopPropagation()}
                    className="min-w-[120px] flex-[1_1_160px] break-words rounded-md border border-gold/40 bg-white/[0.07] px-1.5 py-0.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 sm:min-w-0 sm:flex-1"
                  />
                ) : (
                  <span className={`min-w-[120px] flex-[1_1_160px] break-words text-sm leading-snug sm:min-w-0 sm:flex-1 ${task.completed ? 'line-through text-ink/45' : 'text-ink font-medium'}`}>{task.title}</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenamingHabitRow(task.id)
                    setRenameHabitRowValue(task.title)
                  }}
                  className="hidden shrink-0 p-1 rounded sm:block opacity-0 group-hover:opacity-100 hover:bg-gold/15 transition text-ink/30 hover:text-gold"
                  title="Rename habit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <HabitSparkline values={habitSeriesByTitle[task.title] || []} width={96} height={20} className="hidden md:block" />
                <HabitSparkline values={habitSeriesByTitle[task.title] || []} width={44} height={20} className="hidden sm:block md:hidden" />
                {task.completed ? (
                  <span className="shrink-0 rounded-full bg-sage/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sage">Done</span>
                ) : (
                  <span className="hidden shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink/40 sm:inline-block">Today</span>
                )}
                <button onClick={(e) => onDelete(e, task.id)} className="shrink-0 p-1.5 -m-0.5 rounded hover:bg-ember/15 transition sm:opacity-0 sm:p-1 sm:m-0 sm:group-hover:opacity-100 text-ink/30 hover:text-[#cf8f78]" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-ink/30 transition-transform ${expanded ? 'rotate-180 text-gold' : ''}`} />
              </div>

              {expanded && detail && (
                <div className="rounded-lg border border-gold/20 bg-gold/[0.04] px-3 pb-3 pt-3 animate-fadeIn">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Last {detail.days.length} days</p>
                    <div className="flex items-center gap-2.5 font-mono text-[10px]">
                      <span className="text-sage">streak {detail.streak}d</span>
                      <span className="text-ink/50">{detail.rate}% · {detail.done}/{detail.total}</span>
                    </div>
                  </div>
                  <div className="mb-3 grid grid-cols-10 gap-1">
                    {detail.days.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-1" title={format(d.date, 'EEE d MMM')}>
                        <span className={`h-4 w-4 rounded-[5px] border ${d.done ? 'border-sage bg-sage/80' : 'border-white/15 bg-black/15'}`} />
                        <span className="font-mono text-[8px] text-ink/35">{format(d.date, 'd')}</span>
                      </div>
                    ))}
                  </div>
                  <HabitSparkline values={detail.days.map(d => d.done)} width={320} height={44} className="w-full" />
                  <p className="mt-1.5 font-mono text-[9px] text-ink/35">Gold = done · grey = missed · tap the row to collapse</p>
                </div>
              )}
              </div>
            )})}
            {(displayedHabits.length === 0 && !hasOverview) && (
              <button
                onClick={() => setShowHabitAdd(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-3 text-xs text-ink/40 transition hover:border-gold/40 hover:text-gold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add your first habit
              </button>
            )}

            {/* Off-day habits — owned but not due today. Read-only, so the schedule
                stays intact while nothing silently disappears from the tracker. */}
            {offDayHabits.length > 0 && (
              <div className="pt-2">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/35">
                    Not scheduled today · {offDayHabits.length}
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <div className="space-y-1.5">
                  {offDayHabits.map((h) => (
                    <div
                      key={h.title}
                      className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-2.5 sm:py-2"
                      title={h.nextDue ? `Next due ${format(parseISO(h.nextDue), 'EEEE d MMMM yyyy')}` : 'No further instances scheduled'}
                    >
                      <span className="hidden w-4 shrink-0 justify-center text-ink/25 min-[400px]:flex">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0 flex-[1_1_160px] truncate text-sm leading-snug text-ink/40 sm:flex-1">
                        {h.title}
                      </span>
                      <HabitSparkline values={habitSeriesByTitle[h.title] || []} width={96} height={20} className="hidden opacity-45 md:block" />
                      <HabitSparkline values={habitSeriesByTitle[h.title] || []} width={44} height={20} className="hidden opacity-45 sm:block md:hidden" />
                      <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink/35">
                        {HABIT_PATTERN_LABEL[h.pattern] || h.pattern}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] tabular-nums text-ink/45">
                        {h.nextDue ? `Next ${format(parseISO(h.nextDue), 'EEE d MMM')}` : 'No further dates'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <HabitTrend
            habitHistory={habitHistory}
            range={range}
            onRangeChange={onRangeChange}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStart={onCustomStart}
            onCustomEnd={onCustomEnd}
            onApplyCustom={onApplyCustom}
          />
        </div>
      </Card>
  )
}
