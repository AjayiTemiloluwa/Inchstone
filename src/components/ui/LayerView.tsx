'use client'

import type { ReactNode } from 'react'
import { Breadcrumb, type Crumb } from '@/components/ui/Breadcrumb'
import { Compass } from '@/components/ui/Compass'

/**
 * Shared hierarchy drill-down shell (Phase 3 / brief §5 "Hierarchy view").
 * One component instead of four near-identical pages (goal/quarter/month/week).
 *
 * Layout: mono breadcrumb → heading + mono meta → small compass alignment
 * figure → child-cards slot → reflection card. The caller supplies the child
 * list and reflection state; this shell owns the hierarchy framing.
 */
export interface LayerViewReflection {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

interface LayerViewProps {
  /** Mono path, leaf underscored in gold. */
  crumbs: Crumb[]
  /** Heading — Playfair H1 for the Why, Inter 600 for a goal (caller decides). */
  heading: ReactNode
  /** Optional mono subtitle, e.g. "Q1 · Jan 1 – Mar 31". */
  meta?: string
  /** 0-100 single alignment figure (the one gold number on screen). */
  alignment: number
  /** Mono label the compass ring shows, e.g. "QUEST" / "DEED". */
  ringLabel?: string
  /** Compass background layer label for breadcrumb ancestors (optional). */
  onOpenYear?: () => void
  children?: ReactNode
  reflection?: LayerViewReflection
  className?: string
}

export function LayerView({
  crumbs,
  heading,
  meta,
  alignment,
  ringLabel,
  onOpenYear,
  children,
  reflection,
  className = '',
}: LayerViewProps) {
  return (
    <div className={`mx-auto max-w-[720px] px-4 sm:px-6 pb-20 pt-4 sm:pt-8 space-y-8 ${className}`}>
      {/* Breadcrumb */}
      <Breadcrumb crumbs={crumbs} />

      {/* Heading + alignment figure */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-heading text-parchment">{heading}</div>
          {meta && <p className="mt-1 font-mono text-xs text-parchment/55">{meta}</p>}
        </div>
        <button
          type="button"
          onClick={onOpenYear}
          aria-label="Open year view"
          className="shrink-0 rounded-full transition-opacity focus-visible:outline-2 focus-visible:outline-gold hover:opacity-80"
        >
          <Compass alignment={alignment} ringProgress={alignment} size={96} ringLabel={ringLabel} />
        </button>
      </div>

      {/* Children slot */}
      {children}

      {/* Reflection card */}
      {reflection && (
        <section aria-label="Reflection">
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-parchment/45">
            Reflection
          </div>
          <textarea
            value={reflection.value}
            onChange={(e) => reflection.onChange(e.target.value)}
            placeholder={reflection.placeholder ?? 'Reflect on this period…'}
            className="min-h-32 w-full resize-none rounded-md border border-gold-dim/25 bg-ink px-4 py-3 text-body text-parchment placeholder:text-parchment/30 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
          <p className="mt-1 font-mono text-[11px] text-parchment/40">Auto-saves as you type</p>
        </section>
      )}
    </div>
  )
}