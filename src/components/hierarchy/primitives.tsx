'use client'

/**
 * Hierarchy-local building blocks for the year / quarter / month / week / goal
 * drill-down (DESIGN_PLAN_v2 D4). Built on the v3 page system; candidates for
 * promotion into `@/components/ds` once other screens need them.
 *
 *   <Meter>           hairline fill bar, tokens only, no glow or shimmer
 *   <NavPanel>        a Panel that navigates but may hold its own controls
 *   <PeriodTile>      a child period (quarter / month / week / day): a row on
 *                     phones, a tile from `md` up
 *   <ScoreInstrument> the WorkClock read of one period's progress
 */
import type { KeyboardEvent, ReactNode } from 'react'
import { ChevronRight, Lock, Unlock } from 'lucide-react'
import { cx, type Tone } from '@/components/ds'
import { WorkClock } from '@/components/ui/WorkClock'

const clamp = (n: number) => Math.min(100, Math.max(0, n || 0))

/** Gold while in progress, moss once complete. */
export const progressTone = (value: number): Tone => (clamp(value) >= 100 ? 'moss' : 'gold')

/** Habit-style tone: moss when healthy, gold midway, ember when lagging. */
export const healthTone = (value: number): Tone => (value >= 80 ? 'moss' : value >= 40 ? 'gold' : 'ember')

const FILL: Record<Tone, string> = {
  neutral: 'bg-parchment/50',
  gold: 'bg-gold',
  moss: 'bg-moss',
  ember: 'bg-ember',
}

export function Meter({ value, tone, className }: { value: number; tone?: Tone; className?: string }) {
  const v = clamp(value)
  return (
    <div aria-hidden="true" className={cx('h-1.5 w-full overflow-hidden rounded-full bg-gold/10', className)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none', FILL[tone ?? progressTone(v)])}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

/** Mono percentage figure that holds its width as digits change. */
export function Percent({ value, className }: { value: number; className?: string }) {
  return <span className={cx('font-mono tabular-nums', className)}>{Math.round(value || 0)}%</span>
}

/**
 * A surface that opens a route when clicked, while still hosting its own
 * buttons and sliders. Keyboard activation only fires when the panel itself
 * has focus, so Enter / Space on a nested control never navigates.
 */
export function NavPanel({ onOpen, label, children, className }: { onOpen: () => void; label?: string; children: ReactNode; className?: string }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
  }
  return (
    <div
      data-fx=""
      role="link"
      tabIndex={0}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={cx(
        'group relative min-w-0 cursor-pointer rounded-xl border border-gold/15 bg-surface-solid p-4 transition-colors duration-200',
        'hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * One child period. Spec D4: full-width row below `md` (every target at least
 * 44px tall), a tile in the grid from `md` up. Disabled tiles stay visible but
 * inert, at 25% per spec E's disabled treatment softened for read-only data.
 */
export function PeriodTile({
  label,
  sublabel,
  score,
  caption,
  onOpen,
  disabled = false,
  children,
}: {
  label: string
  sublabel?: string
  score: number
  caption?: ReactNode
  onOpen?: () => void
  disabled?: boolean
  /** Extra tags (e.g. a day's categories). */
  children?: ReactNode
}) {
  const interactive = !!onOpen && !disabled
  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 md:flex-none md:items-start">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{label}</p>
          {sublabel && <p className="mt-0.5 truncate text-caption text-parchment/50">{sublabel}</p>}
        </div>
        <Percent value={score} className="text-heading text-parchment md:hidden" />
        {interactive && <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 text-parchment/30 transition-colors group-hover:text-gold md:block" strokeWidth={1.75} />}
      </div>
      {children}
      <div className="hidden md:block">
        <Percent value={score} className="font-display text-[1.75rem] leading-none text-parchment" />
      </div>
      <div className="w-full space-y-1.5 md:mt-auto">
        <Meter value={score} />
        {caption && <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-parchment/45">{caption}</p>}
      </div>
    </>
  )
  const base = 'group flex min-h-11 w-full min-w-0 flex-col gap-3 rounded-xl border border-gold/15 bg-surface-solid p-4 text-left md:min-h-[9.5rem] md:gap-4 md:p-5'
  if (!onOpen) return <div className={base}>{body}</div>
  return (
    <button
      type="button"
      data-fx=""
      onClick={onOpen}
      disabled={disabled}
      className={cx(
        base,
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        interactive ? 'cursor-pointer hover:border-gold/40' : 'cursor-not-allowed opacity-40',
      )}
    >
      {body}
    </button>
  )
}

/** The grid child periods sit in: single column of rows on phones (spec D4). */
export function PeriodGrid({ children, cols = 3 }: { children: ReactNode; cols?: 3 | 4 | 7 }) {
  const grid = cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : cols === 7 ? 'md:grid-cols-4 xl:grid-cols-7' : 'md:grid-cols-3'
  return <div className={cx('grid grid-cols-1 gap-3 md:gap-4', grid)}>{children}</div>
}

/** WorkClock read of one period's progress: the ring is the score. */
export function ScoreInstrument({ score, label, caption, size = 88, children }: { score: number; label: string; caption?: ReactNode; size?: number; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-5 sm:gap-6">
      <WorkClock size={size} progress={clamp(score)} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">{label}</p>
        <div className="flex items-baseline gap-3">
          {children ?? <Percent value={score} className="font-display text-[2.25rem] leading-none text-parchment" />}
          {caption && <span className="text-caption text-parchment/50">{caption}</span>}
        </div>
        <Meter value={score} />
      </div>
    </div>
  )
}

/** Weight lock: gold when held, quiet when free. Clicks never bubble to a card. */
export function LockToggle({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  const Icon = locked ? Lock : Unlock
  const label = locked ? 'Unlock weight' : 'Lock weight'
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onToggle() }} aria-pressed={locked} aria-label={label} title={label}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors pointer-fine:h-9 pointer-fine:w-9',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 hover:bg-gold/[0.08]',
        locked ? 'text-gold' : 'text-parchment/35 hover:text-parchment',
      )}>
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}
