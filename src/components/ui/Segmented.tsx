'use client'

/**
 * Shared segmented control (v2 A / v2 D6).
 * Quiet: active option = parchment text + 2px gold underline (never a filled pill).
 * Used by timeline/table, period selectors, mood, NGN/USD, graph ranges, etc.
 */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  mono?: boolean
  className?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  mono = false,
  className = '',
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              'relative -mb-px flex min-h-11 items-center px-3 text-sm transition-colors',
              mono ? 'font-mono' : 'font-medium',
              active ? 'text-parchment' : 'text-parchment/45 hover:text-parchment/75',
            ].join(' ')}
          >
            {opt.label}
            {active && (
              <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-gold" />
            )}
          </button>
        )
      })}
    </div>
  )
}
