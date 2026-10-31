'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cx } from '@/components/ds'

export interface Crumb {
  label: string
  /** Omit for non-clickable crumbs. The last crumb is always the current page. */
  href?: string
}

/**
 * Mono breadcrumb trail; the final crumb is the current page.
 * Spec D4: on phones the path truncates to parent + current (`… / Q1 / Jan`);
 * tapping the leading `…` reveals the full path. From `sm` up every segment shows.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const collapsible = crumbs.length > 2 && !expanded
  const firstVisible = crumbs.length - 2

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-parchment/45">
        {collapsible && (
          <li className="flex items-center gap-1.5 sm:hidden">
            <button type="button" onClick={() => setExpanded(true)} aria-label="Show full path"
              className="-mx-1 inline-flex min-h-11 min-w-8 items-center justify-center rounded-md px-1 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
              …
            </button>
            <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 text-parchment/25" />
          </li>
        )}
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          const hiddenOnPhone = collapsible && i < firstVisible
          return (
            <Fragment key={`${i}-${c.label}`}>
              <li className={cx('flex min-w-0 items-center gap-1.5', hiddenOnPhone && 'hidden sm:flex')}>
                {last ? (
                  <span className="truncate text-parchment" aria-current="page">{c.label}</span>
                ) : c.href ? (
                  <button type="button" onClick={() => router.push(c.href as string)}
                    className="inline-flex min-h-11 max-w-[16rem] items-center truncate rounded-md transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 pointer-fine:min-h-0">
                    {c.label}
                  </button>
                ) : (
                  <span className="max-w-[16rem] truncate">{c.label}</span>
                )}
                {!last && <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 text-parchment/25" />}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
