'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Calendar, ChevronDown } from 'lucide-react'
import { useDialog } from '@/components/ui/useDialog'
import { HabitChart } from './HabitChart'
import { buildHabitGraph } from './habitGraph'
import type { GraphRange, HabitHistoryEntry } from './types'

const RANGES: GraphRange[] = ['week', 'month', 'quarter', 'year', 'all']

function rangeLabel(range: GraphRange) {
  switch (range) {
    case 'week': return 'Week'
    case 'month': return 'Month'
    case 'quarter': return 'Quarter'
    case 'year': return 'Year'
    case 'all': return 'All Time'
    case 'custom': return 'Custom'
  }
}

function CustomRangePicker({
  start,
  end,
  onStart,
  onEnd,
  onApply,
  onClose,
}: {
  start: string
  end: string
  onStart: (v: string) => void
  onEnd: (v: string) => void
  onApply: () => void
  onClose: () => void
}) {
  const ref = useDialog<HTMLDivElement>(true, onClose)
  return (
    <>
      {/* Phone: dimmed backdrop so it reads as a sheet. */}
      <div className="fixed inset-0 z-40 bg-ink/60 sm:hidden" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Custom date range"
        tabIndex={-1}
        data-lenis-prevent
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-mist bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-fadeIn sm:absolute sm:inset-auto sm:right-0 sm:top-8 sm:w-60 sm:rounded-xl sm:p-3 sm:pb-3"
      >
        <div className="space-y-2">
          <div>
            <label className="text-[9px] font-bold uppercase text-ink/50">From</label>
            <input type="date" value={start} onChange={e => onStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-ink/80 focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase text-ink/50">To</label>
            <input type="date" value={end} onChange={e => onEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-ink/80 focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>
          <button
            onClick={onApply}
            className="w-full rounded-lg bg-gold px-3 py-2 text-xs font-bold text-ink transition hover:bg-gold-glow"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  )
}

export function HabitTrend({
  habitHistory,
  range,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStart,
  onCustomEnd,
  onApplyCustom,
}: {
  habitHistory: HabitHistoryEntry[]
  range: GraphRange
  onRangeChange: (r: GraphRange) => void
  customStart: string
  customEnd: string
  onCustomStart: (v: string) => void
  onCustomEnd: (v: string) => void
  onApplyCustom: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const completionRates = useMemo(() => {
    const titles = [...new Set(habitHistory.map(h => h.title))]
    return titles.map(title => {
      const instances = habitHistory.filter(h => h.title === title)
      const total = instances.length
      const done = instances.filter(h => h.completed).length
      return { title, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
    })
  }, [habitHistory])

  // Only decides whether there is enough data to chart at all (>= 2 days).
  const hasGraph = useMemo(() => buildHabitGraph(habitHistory, range, 100, 100) !== null, [habitHistory, range])

  if (habitHistory.length === 0 || !hasGraph) return null

  const overallRate = completionRates.length
    ? Math.round(completionRates.reduce((s, c) => s + c.rate, 0) / completionRates.length)
    : 0

  const chip = (active: boolean) =>
    `px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition sm:px-2 sm:py-1 sm:text-[9px] ${
      active ? 'bg-gold/20 text-gold border border-gold/30' : 'text-ink/40 hover:text-ink hover:bg-white/5 border border-transparent'
    }`

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/15 px-3 py-2.5 text-xs font-bold text-ink/70 transition hover:border-gold/40 hover:text-gold"
      >
        <span className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-gold" />
          Habit trend
        </span>
        <span className="flex items-center gap-2">
          {overallRate > 0 && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-gold">{overallRate}% avg</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-gold" />
              <h3 className="text-xs font-bold uppercase text-ink/50">Habit Completion</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => { onRangeChange(r); setPickerOpen(false) }}
                  className={chip(range === r && !pickerOpen)}
                >
                  {rangeLabel(r)}
                </button>
              ))}
              <div className="relative">
                <button
                  onClick={() => setPickerOpen(v => !v)}
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen}
                  className={`${chip(range === 'custom' || pickerOpen)} flex items-center space-x-1`}
                >
                  <Calendar className="h-3 w-3" />
                  <span>Custom</span>
                </button>
                {pickerOpen && (
                  <CustomRangePicker
                    start={customStart}
                    end={customEnd}
                    onStart={onCustomStart}
                    onEnd={onCustomEnd}
                    onClose={() => setPickerOpen(false)}
                    onApply={() => {
                      if (customStart && customEnd) {
                        onRangeChange('custom')
                        setPickerOpen(false)
                        onApplyCustom()
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {completionRates.map(({ title, rate }) => (
              <div key={title} className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
                <p className="truncate text-[8px] font-bold uppercase text-ink/50">{title}</p>
                <p className="font-mono text-sm font-bold text-gold">{rate}%</p>
              </div>
            ))}
          </div>

          <HabitChart habitHistory={habitHistory} range={range} />
        </>
      )}
    </div>
  )
}
