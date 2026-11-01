'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, PanelLeftClose, X } from 'lucide-react'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLayoutStore } from '@/stores/layoutStore'
import { WorkClock } from '@/components/ui/WorkClock'
import { NAV_GROUPS, SETTINGS_LINK, isNavActive, type NavLink } from '@/components/ds/nav'

/**
 * v3 sidebar: links grouped by intent (Today / Plan / Money / People / Insight),
 * the work clock as the wordmark's mark, Settings pinned to the foot.
 *
 *  ≥1024px  a docked column: open (256px), collapsed to a 72px icon rail, or
 *           closed entirely. The choice is remembered.
 *  <1024px  a drawer that slides in over the page from the top-bar button.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, setCollapsed, hidden, toggleHidden, drawerOpen, setDrawer } = useLayoutStore()
  useEffect(() => { void useLayoutStore.persist.rehydrate() }, [])

  // Close the drawer on Escape, and once the screen grows to desktop width.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    const mq = window.matchMedia('(min-width: 1024px)')
    const onWide = () => { if (mq.matches) setDrawer(false) }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onWide)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onWide)
    }
  }, [drawerOpen, setDrawer])

  return (
    <>
      <aside
        aria-label="Primary"
        aria-hidden={hidden || undefined}
        inert={hidden || undefined}
        className={`hidden h-full shrink-0 flex-col overflow-hidden bg-ink transition-[width] duration-300 lg:flex ${hidden ? 'w-0 border-r-0' : `border-r border-gold/10 ${collapsed ? 'w-[72px]' : 'w-64'}`}`}
      >
        <SidebarBody
          pathname={pathname}
          collapsed={collapsed}
          layoutId="sidebar-active"
          onClose={toggleHidden}
          onCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            className="fixed inset-0 z-[65] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawer(false)}
          >
            <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
            <motion.aside
              aria-label="Primary"
              role="dialog"
              aria-modal="true"
              data-lenis-prevent
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-gold/15 bg-ink shadow-[18px_0_50px_rgba(0,0,0,0.45)]"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarBody
                pathname={pathname}
                collapsed={false}
                layoutId="drawer-active"
                onClose={() => setDrawer(false)}
                onNavigate={() => setDrawer(false)}
                drawer
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function SidebarBody({
  pathname,
  collapsed,
  layoutId,
  onClose,
  onCollapse,
  onNavigate,
  drawer = false,
}: {
  pathname: string
  collapsed: boolean
  layoutId: string
  onClose: () => void
  onCollapse?: () => void
  onNavigate?: () => void
  drawer?: boolean
}) {
  const row = (link: NavLink) => {
    const Icon = link.icon
    const active = isNavActive(pathname, link.href)
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        title={collapsed ? link.name : undefined}
        data-cursor={link.hint}
        aria-current={active ? 'page' : undefined}
        className={[
          'group relative flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200',
          drawer ? 'min-h-11' : 'min-h-10',
          collapsed ? 'justify-center' : '',
          active ? 'font-semibold text-parchment' : 'font-medium text-parchment/55 hover:bg-gold/[0.05] hover:text-parchment/90',
        ].join(' ')}
      >
        {active && (
          <motion.span
            layoutId={layoutId}
            aria-hidden
            className="absolute inset-0 rounded-xl border border-gold/20 bg-gradient-to-r from-gold/[0.16] via-gold/[0.06] to-transparent"
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
    <>
      {/* Wordmark + close */}
      <div className={`flex h-16 shrink-0 items-center gap-3 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <Link href="/dashboard" onClick={onNavigate} aria-label="Inchstone home" className="flex min-w-0 items-center gap-3">
          <WorkClock size={28} progress={100} />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block font-display text-[1.2rem] font-bold leading-none tracking-[-0.01em] text-parchment">Inchstone</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.28em] text-gold-dim">small deeds daily</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-parchment/40 transition-colors hover:bg-gold/[0.06] hover:text-parchment"
          >
            {drawer ? <X className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.6} />}
          </button>
        )}
      </div>

      {/* Groups */}
      <nav aria-label="Sections" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {collapsed ? (
              <span aria-hidden className="mx-auto mb-2 block h-px w-6 bg-gold/15" />
            ) : (
              <p className="flex items-center gap-2 px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-parchment/35">{group.label}<span aria-hidden className="h-px flex-1 bg-gold/10" /></p>
            )}
            {group.links.map(row)}
          </div>
        ))}
      </nav>

      {/* Foot: settings + collapse (desktop only) */}
      <div className="space-y-1 border-t border-gold/10 px-3 py-3" style={drawer ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' } : undefined}>
        {row(SETTINGS_LINK)}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-parchment/40 transition-colors hover:bg-gold/[0.05] hover:text-parchment/80 ${collapsed ? 'justify-center' : ''}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <ChevronsLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </>
  )
}
