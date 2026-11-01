'use client'

/**
 * Inchstone v3 page system: the one set of building blocks every screen is
 * laid out with, so the app reads as one instrument rather than eleven pages.
 *
 *   <Page>            width cap + vertical rhythm (48px between sections, 24px on phones)
 *   <PageHeader>      mono eyebrow, Playfair title, one-line subline, actions on the right
 *   <Section>         labeled hairline header + body; the only way a page is divided
 *   <Panel>           the one surface: 12px radius, solid surface, hairline when `bordered`
 *   <StatGrid/Stat>   ledger figures: mono eyebrow, tabular display numeral, quiet caption
 *   <EmptyState>      work-clock glyph at 40px (style guide section 6), one line + optional action
 *   <Skeleton>        hairline block in gold-dim at 8% (spec E), never a shimmer bar
 *   <Field>           label + control pair for forms and settings rows
 *
 * Tokens only (ink / parchment / gold / gold-dim / ember / moss and the --text-* scale),
 * no hardcoded colors, so both themes keep working.
 */
import type { ElementType, ReactNode } from 'react'
import { WorkClock } from '@/components/ui/WorkClock'
import { RevealLines } from '@/components/ui/motion'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export type PageWidth = 'narrow' | 'default' | 'wide' | 'full'
const WIDTH: Record<PageWidth, string> = {
  narrow: 'max-w-[720px]',
  default: 'max-w-[1040px]',
  wide: 'max-w-[1280px]',
  full: 'max-w-none',
}

export function Page({ children, width = 'default', className }: { children: ReactNode; width?: PageWidth; className?: string }) {
  return <div className={cx('mx-auto w-full min-w-0 space-y-8 sm:space-y-10 lg:space-y-12', WIDTH[width], className)}>{children}</div>
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  /** Mono kicker above the title, e.g. "Week 44 · Oct 27 – Nov 2". */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Primary/secondary buttons; they wrap under the title on phones. */
  actions?: ReactNode
  /** A small trailing read (count, date range) beside the title. */
  meta?: ReactNode
  className?: string
}) {
  // The dashboard's hero language on every page: a mono strip over a hairline,
  // a large Playfair title that reveals line by line, and a gold rule leading
  // into the subline.
  return (
    <header data-noreveal className={cx('relative overflow-hidden rounded-xl border border-gold/15 bg-surface-solid p-5 sm:p-7 lg:p-8', className)}>
      <span aria-hidden="true" className="hero-orb pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/[0.09] blur-3xl" />
      <span aria-hidden="true" className="hero-orb hero-orb--slow pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-ember/[0.05] blur-3xl" />
      {(eyebrow || meta) && (
        <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gold/10 pb-3.5">
          {eyebrow ? <div className="min-w-0 font-mono text-[11px] uppercase tracking-[0.22em] text-parchment/45">{eyebrow}</div> : <span />}
          {meta && <div className="shrink-0 font-mono text-[11px] tabular-nums text-parchment/50">{meta}</div>}
        </div>
      )}
      <div className={cx('relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between', !!(eyebrow || meta) && 'mt-5 sm:mt-6')}>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.05] text-parchment">
            {typeof title === 'string' ? <RevealLines key={title} delay={60} fluid lines={[title]} /> : title}
          </h1>
          {description && (
            <div className="mt-5 flex items-start gap-4">
              <span aria-hidden="true" className="mt-[0.7em] h-px w-10 shrink-0 bg-gold/60 sm:w-12" />
              <div className="max-w-[60ch] text-body text-parchment/60">{description}</div>
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export function Section({
  title,
  action,
  children,
  id,
  as: Tag = 'section',
  className,
  description,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  id?: string
  as?: ElementType
  className?: string
  description?: ReactNode
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <Tag id={id} aria-labelledby={title && headingId ? headingId : undefined} className={cx('min-w-0', className)}>
      {title && (
        <div className="mb-4 flex items-center gap-3">
          <h2 id={headingId} className="shrink-0 font-mono text-[11px] uppercase tracking-[0.24em] text-parchment/50">{title}</h2>
          <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-gold/15" />
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {description && <p className="-mt-2 mb-4 text-caption text-parchment/50">{description}</p>}
      {children}
    </Tag>
  )
}

type PanelProps = {
  children: ReactNode
  className?: string
  /** Hairline border: on by default for cards that sit against other cards (spec A). */
  bordered?: boolean
  padded?: boolean
  interactive?: boolean
  as?: ElementType
  onClick?: () => void
  id?: string
  role?: string
  'aria-label'?: string
}

export function Panel({ children, className, bordered = true, padded = true, interactive = false, as: Tag = 'div', onClick, ...rest }: PanelProps) {
  const clickable = interactive || !!onClick
  return (
    <Tag
      data-fx=""
      onClick={onClick}
      tabIndex={onClick && Tag === 'div' ? 0 : undefined}
      // Only the panel's own focus activates it, so Space/Enter inside a nested input or button keeps working.
      onKeyDown={onClick && Tag === 'div' ? (e: React.KeyboardEvent) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className={cx(
        'min-w-0 rounded-xl bg-surface-solid',
        bordered && 'border border-gold/15',
        padded && 'p-4 sm:p-6',
        clickable && 'cursor-pointer transition-colors duration-200 hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
  // 2x2 on phones (spec D6): figures stay paired instead of a long vertical list.
  return <div className={cx('grid grid-cols-2 gap-3 sm:gap-4', grid, className)}>{children}</div>
}

export type Tone = 'neutral' | 'gold' | 'moss' | 'ember'
export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-parchment',
  gold: 'text-gold',
  moss: 'text-moss',
  ember: 'text-ember',
}

export function Stat({
  label,
  value,
  caption,
  tone = 'neutral',
  icon: Icon,
  className,
}: {
  label: ReactNode
  value: ReactNode
  caption?: ReactNode
  tone?: Tone
  icon?: ElementType
  className?: string
}) {
  return (
    <Panel className={cx('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.5} aria-hidden="true" />}
      </div>
      <p className={cx('font-display text-[1.75rem] leading-none tabular-nums sm:text-[2.25rem]', TONE_TEXT[tone])}>{value}</p>
      {caption && <p className="text-caption text-parchment/50">{caption}</p>}
    </Panel>
  )
}

export function EmptyState({ title, body, action, className }: { title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center gap-3 rounded-xl border border-dashed border-gold/20 px-6 py-10 text-center', className)}>
      <WorkClock size={40} progress={0} className="opacity-40" />
      <p className="text-heading text-parchment/80">{title}</p>
      {body && <p className="max-w-[44ch] text-body text-parchment/50">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('rounded-xl border border-gold-dim/10 bg-gold-dim/[0.08]', className)} />
}

/** Thin progress bar in token colours (replaces the legacy glow ProgressBar). */
export function Meter({ value, tone = 'gold', label, className }: { value: number; tone?: Tone; label?: string; className?: string }) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
  const fill = tone === 'moss' ? 'bg-moss' : tone === 'ember' ? 'bg-ember' : tone === 'neutral' ? 'bg-parchment/60' : 'bg-gold'
  return (
    <div
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className={cx('h-[3px] w-full overflow-hidden rounded-full bg-gold/10', className)}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none', fill)} style={{ width: pct + '%' }} />
    </div>
  )
}

/** Label + control pair for forms and settings rows. */
export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">{label}</span>
      {children}
      {hint && <span className="text-caption text-parchment/40">{hint}</span>}
    </label>
  )
}
