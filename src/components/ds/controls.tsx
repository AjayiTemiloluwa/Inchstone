'use client'

/**
 * Inchstone v3 controls: one button language for the whole app.
 *
 *   <Button variant="primary">   gold fill, ink text; one per view
 *   <Button variant="secondary"> hairline outline, parchment text
 *   <Button variant="ghost">     text only, for tertiary actions
 *   <Button variant="danger">    ember outline; destructive confirms
 *   <IconButton>                 44px hit area on touch (spec B2), 36px visual on pointer
 *   <RowActions>                 spec C: hover-reveal on pointer, always-visible kebab on touch
 *   <Badge>                      mono pill for counts and statuses
 */
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ElementType, type ReactNode } from 'react'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import { cx, type Tone } from './layout'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold-glow border border-gold',
  secondary: 'border border-gold/25 text-parchment hover:border-gold/50 hover:bg-gold/[0.06]',
  ghost: 'text-parchment/70 hover:text-parchment hover:bg-gold/[0.06]',
  danger: 'border border-ember/50 text-ember hover:bg-ember/10',
}
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
}

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
    'disabled:cursor-not-allowed disabled:opacity-25',
    VARIANT[variant],
    SIZE[size],
    className,
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ElementType
  /** Render as a Next link instead of a button. */
  href?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, href, className, children, type = 'button', ...rest },
  ref,
) {
  const inner = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </>
  )
  if (href) return <Link href={href} className={buttonClass(variant, size, className)}>{inner}</Link>
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest}>
      {inner}
    </button>
  )
})

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { icon: ElementType; label: string; tone?: 'neutral' | 'danger' }>(
  function IconButton({ icon: Icon, label, tone = 'neutral', className, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cx(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors pointer-fine:h-9 pointer-fine:w-9',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-25',
          tone === 'danger' ? 'text-parchment/50 hover:bg-ember/10 hover:text-ember' : 'text-parchment/50 hover:bg-gold/[0.08] hover:text-parchment',
          className,
        )}
        {...rest}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    )
  },
)

export interface RowAction {
  label: string
  icon?: ElementType
  onSelect: () => void
  destructive?: boolean
}

/**
 * Spec C: secondary row actions. On pointer devices the kebab fades in when the
 * row (a parent with the `group` class) is hovered or focused; on touch it is
 * always visible. Never swipe, never long-press.
 */
export function RowActions({ actions, label = 'More actions', className }: { actions: RowAction[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={ref} className={cx('relative shrink-0', className)} onClick={(e) => e.stopPropagation()}>
      <IconButton
        icon={MoreHorizontal}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx('can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100', open && 'can-hover:opacity-100')}
      />
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-gold/20 bg-surface-solid p-1 shadow-xl animate-fadeIn">
          {actions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); a.onSelect() }}
                className={cx(
                  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors pointer-fine:min-h-9',
                  a.destructive ? 'text-ember hover:bg-ember/10' : 'text-parchment/80 hover:bg-gold/[0.08] hover:text-parchment',
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
                {a.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const BADGE: Record<Tone, string> = {
  neutral: 'border-parchment/15 text-parchment/60',
  gold: 'border-gold/30 text-gold',
  moss: 'border-moss/40 text-moss',
  ember: 'border-ember/40 text-ember',
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums', BADGE[tone], className)}>
      {children}
    </span>
  )
}

/** Shared text-input look so every form field matches. */
export const inputClass =
  'min-h-11 w-full rounded-lg border border-gold/20 bg-ink/40 px-3 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20'
