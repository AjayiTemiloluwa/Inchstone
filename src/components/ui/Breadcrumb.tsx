'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Hierarchy breadcrumb (v1 B4 / v2 D4).
 * Mono segments separated by `/` in gold-dim. Leaf = parchment + thin gold rule.
 * Ancestors dim to parchment/45. On narrow screens the path truncates to
 * parent + current with a tappable "…" that reveals the full path.
 */
export interface Crumb {
  label: string
  href?: string
}

interface BreadcrumbProps {
  crumbs: Crumb[]
  /** show a trailing "…" collapsed segment when the path exceeds maxVisible + 1 */
  maxVisible?: number
  className?: string
}

export function Breadcrumb({ crumbs, maxVisible = 0, className = '' }: BreadcrumbProps) {
  const [expanded, setExpanded] = useState(false)
  const last = crumbs.length - 1
  const shouldCollapse = !expanded && maxVisible > 0 && crumbs.length > maxVisible + 1

  let items: { label: string; href?: string; key: number }[] = crumbs.map((c, i) => ({ ...c, key: i }))

  if (shouldCollapse) {
    const keep = crumbs.length - maxVisible
    const lastOnes = crumbs.slice(keep).map((c, i2) => ({ ...c, key: keep + i2 }))
    items = [{ label: crumbs[0].label, href: crumbs[0].href, key: 0 }, { label: '…', key: -1 }, ...lastOnes]
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 overflow-x-auto whitespace-nowrap font-mono text-[11px] sm:text-xs text-parchment/60 scrollbar-none ${className}`}
    >
      {items.map((c, i) => {
        const isLast = c.key === last
        const isEllipsis = c.label === '…'
        return (
          <span key={`${c.key}-${i}`} className="flex items-center gap-1.5">
            {isEllipsis ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Show full path"
                className="text-parchment/45 transition-colors hover:text-parchment/80"
              >
                …
              </button>
            ) : c.href && !isLast ? (
              <Link href={c.href} className="text-parchment/45 transition-colors hover:text-parchment/80">
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? 'pb-px border-b border-gold text-parchment' : 'text-parchment/45'}>
                {c.label}
              </span>
            )}
            {!isLast && <span aria-hidden className="text-gold-dim/50">/</span>}
          </span>
        )
      })}
    </nav>
  )
}

