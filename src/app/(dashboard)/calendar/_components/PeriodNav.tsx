'use client'

/**
 * Local v3 primitives shared by the Calendar and Week screens (candidates for
 * `src/components/ds`):
 *
 *   <PeriodNav>  prev / current-period label / next, plus a "Today" jump that
 *                only appears when the view is off the current period.
 *   <Meter>      a 4px token-coloured progress hairline (no glow, no gradient).
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, IconButton, cx } from '@/components/ds'

export function PeriodNav({
  label,
  onPrev,
  onNext,
  onToday,
  prevLabel,
  nextLabel,
  todayLabel = 'Today',
  showToday,
  labelTitle,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  prevLabel: string
  nextLabel: string
  todayLabel?: string
  /** Render the Today jump (only when the view is away from the current period). */
  showToday: boolean
  labelTitle?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Period navigation">
      <div className="flex items-center rounded-lg border border-gold/20">
        <IconButton icon={ChevronLeft} label={prevLabel} onClick={onPrev} />
        <button
          type="button"
          onClick={onToday}
          title={labelTitle}
          className="min-h-11 min-w-[7.5rem] px-2 text-center font-mono text-mono tabular-nums text-parchment/80 transition-colors hover:text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 pointer-fine:min-h-9"
        >
          {label}
        </button>
        <IconButton icon={ChevronRight} label={nextLabel} onClick={onNext} />
      </div>
      {showToday && (
        <Button variant="secondary" size="sm" onClick={onToday} className="min-h-11 pointer-fine:min-h-9">
          {todayLabel}
        </Button>
      )}
    </div>
  )
}

const METER_TONE = {
  gold: 'bg-gold',
  moss: 'bg-moss',
  ember: 'bg-ember',
  neutral: 'bg-parchment/40',
} as const

export function Meter({
  value,
  tone = 'gold',
  className,
  label,
}: {
  value: number
  tone?: keyof typeof METER_TONE
  className?: string
  /** Accessible name; when omitted the meter is decorative. */
  label?: string
}) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
  return (
    <span
      className={cx('block h-1 w-full overflow-hidden rounded-full bg-parchment/10', className)}
      {...(label
        ? { role: 'meter', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct) }
        : { 'aria-hidden': true })}
    >
      <span className={cx('block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none', METER_TONE[tone])} style={{ width: `${pct}%` }} />
    </span>
  )
}
