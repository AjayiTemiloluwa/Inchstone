'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FlaskConical, ClipboardList, GraduationCap, Radar } from 'lucide-react'
import { cx } from '@/components/ds'

/** The rooms of Challenge: the bottle wall, the application tracker, the opportunity scout and the learning lab. */
const TABS = [
  { href: '/challenge', label: 'Bottles', icon: FlaskConical },
  { href: '/challenge/applications', label: 'Application Tracker', icon: ClipboardList },
  { href: '/challenge/opportunities', label: 'Opportunity Scout', icon: Radar },
  { href: '/challenge/learning', label: 'Learning Lab', icon: GraduationCap },
]

export function ChallengeTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Challenge sections" className="-mt-2 grid max-w-full grid-cols-2 gap-2 sm:-mt-4 sm:flex sm:gap-1 sm:overflow-x-auto sm:border-b sm:border-gold/10">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === '/challenge' ? pathname === '/challenge' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'relative flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium leading-tight transition-colors sm:-mb-px sm:shrink-0 sm:rounded-none sm:border-0',
              active ? 'border-gold/40 bg-gold/10 text-parchment sm:bg-transparent' : 'border-gold/10 text-parchment/55 hover:text-parchment/80',
            )}
          >
            <Icon className={cx('h-4 w-4 shrink-0', active ? 'text-gold' : 'text-gold-dim')} strokeWidth={1.6} aria-hidden="true" />
            {label}
            {active && <span aria-hidden className="absolute inset-x-2 -bottom-px hidden h-0.5 bg-gold sm:block" />}
          </Link>
        )
      })}
    </nav>
  )
}
