'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'motion/react'
import { WorkClock } from '@/components/ui/WorkClock'
import { NAV_GROUPS, SETTINGS_LINK, isNavActive, type NavLink } from '@/components/ds/nav'

/**
 * v3 sidebar: links grouped by intent (Today / Plan / Money / People / Insight),
 * the work clock as the wordmark's mark, Settings pinned to the foot.
 * Active row = soft gold surface + a 2px gold bar on the leading edge.
 * Collapses to a 72px icon rail; group labels become hairline dividers.
 */
export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const row = (link: NavLink) => {
    const Icon = link.icon
    const active = isNavActive(pathname, link.href)
    return (
      <Link
        key={link.href}
        href={link.href}
        title={collapsed ? link.name : undefined}
        data-cursor={link.hint}
        aria-current={active ? 'page' : undefined}
        className={[
          'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
          collapsed ? 'justify-center' : '',
          active ? 'text-parchment' : 'text-parchment/55 hover:bg-gold/[0.05] hover:text-parchment/90',
        ].join(' ')}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active"
            aria-hidden
            className="absolute inset-0 rounded-lg border border-gold/20 bg-gold/[0.09]"
            transition={{ type: 'spring', stiffness: 520, damping: 40 }}
          >
            <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gold" />
          </motion.span>
        )}
        <Icon className={`relative h-[18px] w-[18px] shrink-0 ${active ? 'text-gold' : 'text-gold-dim group-hover:text-gold'}`} strokeWidth={1.6} />
        {!collapsed && <span className="relative truncate">{link.name}</span>}
      </Link>
    )
  }

  return (
    <aside
      aria-label="Primary"
      className={`hidden h-full shrink-0 flex-col border-r border-gold/10 bg-ink transition-[width] duration-300 lg:flex ${collapsed ? 'w-[72px]' : 'w-64'}`}
    >
      {/* Wordmark */}
      <div className={`flex h-16 items-center gap-3 px-4 ${collapsed ? 'justify-center' : ''}`}>
        <Link href="/dashboard" aria-label="Inchstone home" className="flex min-w-0 items-center gap-3">
          <WorkClock size={26} progress={100} />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block font-display text-lg leading-none text-parchment">Inchstone</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.28em] text-gold-dim">small deeds daily</span>
            </span>
          )}
        </Link>
      </div>

      {/* Groups */}
      <nav aria-label="Sections" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {collapsed ? (
              <span aria-hidden className="mx-auto mb-2 block h-px w-6 bg-gold/15" />
            ) : (
              <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-parchment/30">{group.label}</p>
            )}
            {group.links.map(row)}
          </div>
        ))}
      </nav>

      {/* Foot: settings + collapse */}
      <div className="space-y-1 border-t border-gold/10 px-3 py-3">
        {row(SETTINGS_LINK)}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-parchment/40 transition-colors hover:bg-gold/[0.05] hover:text-parchment/80 ${collapsed ? 'justify-center' : ''}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <ChevronsLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
