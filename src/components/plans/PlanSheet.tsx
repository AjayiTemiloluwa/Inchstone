'use client'

/**
 * The one dialog shell for every Long-Term plan form (spec D7):
 *   - desktop: centered panel, max width per `size`, 12px radius
 *   - phone:   bottom sheet, full width, rounded top corners only, drag-handle
 *              affordance (visual only; the backdrop tap, the close button and
 *              Cancel all still dismiss it)
 * Escape / focus trap / focus return come from `useDialog`.
 *
 * Local to the plans folder for now; a candidate for `@/components/ds`.
 */
import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton, cx } from '@/components/ds'
import { useDialog } from '@/components/ui/useDialog'

const SIZE = {
  sm: 'sm:max-w-[480px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[640px]',
  xl: 'sm:max-w-[720px]',
} as const

export function PlanSheet({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  size = 'sm',
  active = true,
  zClass = 'z-50',
  overlay,
}: {
  title: ReactNode
  /** Mono kicker above the title. */
  eyebrow?: ReactNode
  onClose: () => void
  children: ReactNode
  /** Action row pinned below the body. */
  footer?: ReactNode
  size?: keyof typeof SIZE
  /** False pauses this dialog's key handling while a nested dialog is on top. */
  active?: boolean
  zClass?: string
  /** A nested dialog. Rendered beside (not inside) the animated panel so its fixed
   *  positioning stays relative to the viewport; clicks in it never reach this backdrop. */
  overlay?: ReactNode
}) {
  const dialogRef = useDialog<HTMLDivElement>(active, onClose)
  const titleId = useId()

  return (
    <div
      className={cx('fixed inset-0 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center sm:p-4', zClass)}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        onClick={e => e.stopPropagation()}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-gold/15 bg-surface-solid shadow-2xl animate-slideUp focus:outline-none sm:rounded-xl',
          SIZE[size],
        )}
      >
        {/* Drag-handle affordance: phones only, decorative */}
        <div aria-hidden="true" className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-parchment/20" />
        </div>

        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-6 sm:pt-6">
          <div className="min-w-0 space-y-1.5">
            {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold-dim">{eyebrow}</p>}
            <h2 id={titleId} className="font-display text-xl leading-snug text-parchment">{title}</h2>
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1" />
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-5 pt-3 sm:px-6" data-lenis-prevent>
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gold/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
        {!footer && <div aria-hidden="true" className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
      {overlay && <div onClick={e => e.stopPropagation()}>{overlay}</div>}
    </div>
  )
}

/** Inline error / warning line used inside plan forms. */
export function FormNotice({ children, tone = 'ember' }: { children: ReactNode; tone?: 'ember' | 'neutral' }) {
  return (
    <p
      role={tone === 'ember' ? 'alert' : undefined}
      className={cx(
        'rounded-lg border px-3 py-2 text-caption',
        tone === 'ember' ? 'border-ember/40 bg-ember/10 text-ember' : 'border-dashed border-parchment/20 text-parchment/60',
      )}
    >
      {children}
    </p>
  )
}

/** "(optional)" suffix for a Field label. */
export function Optional() {
  return <span className="normal-case tracking-normal text-parchment/35"> (optional)</span>
}

/** Same look as the ds `Field` label, for groups that hold several controls. */
export const FIELD_LABEL = 'font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50'

/** Native date/month pickers follow the active theme. */
export const DATE_SCHEME = 'dark:[color-scheme:dark]'

/** inputClass is sized for single-line inputs; textareas need vertical padding. */
export const TEXTAREA = 'resize-none py-2.5'
