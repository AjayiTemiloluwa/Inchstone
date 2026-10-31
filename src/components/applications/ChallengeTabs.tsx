'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FlaskConical, ClipboardList } from 'lucide-react'
import { cx } from '@/components/ds'

/** The two rooms of Challenge: the bottle wall and the application tracker. */
const TABS = [
  { href: '/challenge', label: 'Bottles', icon: FlaskConical },
  { href: '/challenge/applications', label: 'Application Tracker', icon: ClipboardList },
]

export function ChallengeTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Challenge sections" className="-mt-2 flex max-w-full gap-1 overflow-x-auto border-b border-gold/10 sm:-mt-4">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === '/challenge' ? pathname === '/challenge' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'relative -mb-px flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors',
              active ? 'text-parchment' : 'text-parchment/45 hover:text-parchment/75',
            )}
          >
            <Icon className={cx('h-4 w-4', active ? 'text-gold' : 'text-gold-dim')} strokeWidth={1.6} aria-hidden="true" />
            {label}
            {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-gold" />}
          </Link>
        )
      })}
    </nav>
  )
}
