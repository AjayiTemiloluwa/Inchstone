'use client'

/**
 * A calendar button for the day page: opens a month view so you can jump to any date, not just the days in the
 * week strip. Pick a day and the page goes there; the popover closes on a pick, on Escape or on a click outside.
 *
 * Keyboard: the focused day moves with the arrow keys (a day / a week), PageUp/PageDown change month, Enter picks.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '@/components/ds'

const WEEK = { weekStartsOn: 1 } as const

export function DatePickerButton({ date, onPick }: { date: Date; onPick: (date: Date) => void }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(date))
  const [focus, setFocus] = useState(date)
  const wrap = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const show = () => { setMonth(startOfMonth(date)); setFocus(date); setOpen(true) }
  const pick = (d: Date) => { setOpen(false); if (!isSameDay(d, date)) onPick(d) }

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  // Keep the panel on screen: on a phone the header row wraps, so the button is not always at the right edge.
  // Measure once it opens and slide it sideways just enough to leave a 12px margin.
  useLayoutEffect(() => {
    const el = panel.current
    if (!open || !el) return
    el.style.transform = ''
    const r = el.getBoundingClientRect()
    const margin = 12
    const shift = r.left < margin ? margin - r.left : r.right > window.innerWidth - margin ? window.innerWidth - margin - r.right : 0
    if (shift) el.style.transform = `translateX(${Math.round(shift)}px)`
  }, [open])

  // Keep keyboard focus on the focused day while the popover is open.
  useEffect(() => {
    if (!open) return
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${format(focus, 'yyyy-MM-dd')}"]`)?.focus()
  }, [open, focus])

  const moveFocus = (d: Date) => { setFocus(d); if (!isSameMonth(d, month)) setMonth(startOfMonth(d)) }
  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in step) { e.preventDefault(); moveFocus(addDays(focus, step[e.key])) }
    else if (e.key === 'PageUp') { e.preventDefault(); moveFocus(addMonths(focus, -1)) }
    else if (e.key === 'PageDown') { e.preventDefault(); moveFocus(addMonths(focus, 1)) }
  }

  const today = new Date()
  const first = startOfWeek(startOfMonth(month), WEEK)
  const last = endOfWeek(endOfMonth(month), WEEK)
  const days: Date[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d)

  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => (open ? setOpen(false) : show())} aria-label="Pick a date" aria-haspopup="dialog" aria-expanded={open} title="Pick a date"
        className={cx('flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          open ? 'bg-gold/[0.12] text-gold' : 'text-parchment/60 hover:bg-gold/[0.08] hover:text-parchment')}>
        <CalendarDays className="h-4 w-4" />
      </button>

      {open && (
        <div ref={panel} role="dialog" aria-label="Pick a date"
          className="absolute right-0 top-11 z-50 w-[18.5rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-gold/20 bg-surface-solid p-3 font-sans normal-case tracking-normal shadow-[0_18px_50px_rgb(var(--shadow-rgb)/0.35)]">
          <div className="flex items-center justify-between pb-2">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/60 hover:bg-gold/[0.08] hover:text-parchment"><ChevronLeft className="h-4 w-4" /></button>
            <p className="font-display text-base text-parchment" aria-live="polite">{format(month, 'MMMM yyyy')}</p>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-parchment/60 hover:bg-gold/[0.08] hover:text-parchment"><ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="grid grid-cols-7 pb-1 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-parchment/40" aria-hidden>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="py-1">{d}</span>)}
          </div>
          <div ref={grid} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const sel = isSameDay(d, date)
              const now = isSameDay(d, today)
              const inMonth = isSameMonth(d, month)
              return (
                <button key={d.toISOString()} type="button" data-day={format(d, 'yyyy-MM-dd')} onClick={() => pick(d)}
                  tabIndex={isSameDay(d, focus) ? 0 : -1} aria-label={format(d, 'EEEE d MMMM yyyy')} aria-current={sel ? 'date' : undefined}
                  className={cx('flex h-9 items-center justify-center rounded-lg font-mono text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
                    sel ? 'bg-gold font-bold text-ink'
                      : now ? 'border border-gold/50 text-gold hover:bg-gold/10'
                        : inMonth ? 'text-parchment/85 hover:bg-gold/[0.08]' : 'text-parchment/30 hover:bg-gold/[0.05]')}>
                  {format(d, 'd')}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex justify-end border-t border-gold/10 pt-2">
            <button type="button" onClick={() => pick(today)}
              className="h-9 rounded-lg px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gold hover:bg-gold/10">Go to today</button>
          </div>
        </div>
      )}
    </div>
  )
}
