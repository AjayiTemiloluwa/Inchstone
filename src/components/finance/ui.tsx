'use client'

/**
 * Finance-local presentation helpers built on the v3 design system.
 * Kept here (not in components/ds) because only Finance and Transactions use them.
 */
import { useEffect, useRef, type ElementType, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton, cx } from '@/components/ds'

/** Same look as the ds <Field> label, for controls that cannot sit inside a <label>. */
export const labelClass = 'font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50'

/** Section names are fixed: Need, Want, Offerings, Savings. Tokens only. */
export const SECTION_TONE: Record<string, { text: string; bar: string }> = {
  Need: { text: 'text-gold', bar: 'bg-gold' },
  Want: { text: 'text-gold-dim', bar: 'bg-gold-dim' },
  Offerings: { text: 'text-moss', bar: 'bg-moss' },
  Savings: { text: 'text-parchment/70', bar: 'bg-parchment/60' },
}

/** Neutral purse mark: initial in a hairline circle. A purse's chosen color shows as a small dot. */
export function PurseMark({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative grid shrink-0 place-items-center rounded-full border border-gold/25 font-mono uppercase text-parchment/70',
        size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-9 w-9 text-xs',
      )}
    >
      {name.trim().charAt(0) || '·'}
      {color && size === 'md' && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
    </span>
  )
}

/** Thin progress bar. `value` is 0-100. */
export function ProgressBar({ value, tone = 'bg-gold', min = 0, label }: { value: number; tone?: string; min?: number; label?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-parchment/10"
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none', tone)}
        style={{ width: `${Math.max(value, min)}%` }}
      />
    </div>
  )
}

/** Inline status line for forms. */
export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-lg border px-3 py-2 text-caption',
        tone === 'error' ? 'border-ember/30 bg-ember/10 !text-ember' : 'border-moss/30 bg-moss/10 !text-moss',
      )}
    >
      {children}
    </p>
  )
}

/**
 * Bottom sheet for phones (spec D7): full width, rounded top corners, a visual
 * drag handle, and explicit close + Done buttons (no drag-to-dismiss).
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Latest onClose without re-running the effect (which would steal focus from fields on every render).
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/70" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-xl border-t border-gold/20 bg-surface-solid px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-2 animate-fadeIn focus:outline-none"
        data-lenis-prevent
      >
        <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-parchment/20" />
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-heading text-parchment">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="space-y-4">{children}</div>
        <Button variant="primary" className="mt-6 w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

/**
 * Single secondary action on a row (spec C): fades in on hover/focus for
 * pointer devices, always visible on touch. Used where a one-item menu would
 * be an extra tap, or where a dropdown would be clipped by a scroll container.
 * The row needs the `group` class.
 */
export function RowAction({ icon, label, onClick, className }: { icon: ElementType; label: string; onClick: () => void; className?: string }) {
  return (
    <IconButton
      icon={icon}
      label={label}
      tone="danger"
      onClick={onClick}
      className={cx('can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100 can-hover:focus-visible:opacity-100', className)}
    />
  )
}
