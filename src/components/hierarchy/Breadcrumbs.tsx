'use client'

import { Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  /** Omit for non-clickable crumbs. The last crumb is always the current page. */
  href?: string
}

/** Breadcrumb trail; the final crumb renders bold as the current page. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const router = useRouter()
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-x-2 gap-y-1 text-sm text-ink/50 flex-wrap">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <Fragment key={`${i}-${c.label}`}>
            {last ? (
              <span className="text-ink font-bold" aria-current="page">{c.label}</span>
            ) : c.href ? (
              <button type="button" onClick={() => router.push(c.href as string)} className="hover:text-gold transition">{c.label}</button>
            ) : (
              <span>{c.label}</span>
            )}
            {!last && <ChevronRight className="w-3 h-3 shrink-0" />}
          </Fragment>
        )
      })}
    </nav>
  )
}
