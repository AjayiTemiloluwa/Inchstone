'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, PanelLeftClose, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useUser } from '@clerk/nextjs'
import { format } from 'date-fns'
import { useLayoutStore } from '@/stores/layoutStore'
import { WorkClock } from '@/components/ui/WorkClock'
import { NAV_GROUPS, SETTINGS_LINK, isNavActive, type NavLink } from '@/components/ds/nav'
import { openAssistant, openCommand } from '@/lib/uiEvents'

/**
 * Inchstone navigation (v4): a floating panel instead of a flat column.
 *
 *   header   work-clock wordmark + close
 *   actions  quick search (Ctrl/Cmd K) and Ask assistant
 *   groups   each page as an icon tile; the active one is a solid gold tile
 *            with a soft highlight that slides between rows
 *   foot     today's date, Settings, the account card and Collapse
 *
 *  ≥1024px  docked: open (272px), a 76px icon rail, or closed. Remembered.
 *  <1024px  the same panel slides in as a drawer from the top-bar button.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, setCollapsed, hidden, toggleHidden, drawerOpen, setDrawer } = useLayoutStore()
  useEffect(() => { void useLayoutStore.persist.rehydrate() }, [])

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
      <div
        aria-hidden={hidden || undefined}
        inert={hidden || undefined}
        className={`hidden h-full shrink-0 transition-[width,padding] duration-300 ease-out lg:block ${hidden ? 'w-0 p-0' : `py-3 pl-3 ${collapsed ? 'w-[88px]' : 'w-[284px]'}`}`}
      >
        <aside aria-label="Primary" className={`nav-panel flex h-full flex-col overflow-hidden rounded-2xl ${hidden ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
          <PanelBody
            pathname={pathname}
            collapsed={collapsed}
            layoutId="nav-active"
            onClose={toggleHidden}
            onCollapse={() => setCollapsed(!collapsed)}
          />
        </aside>
      </div>

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
            <motion.div
              className="absolute inset-y-0 left-0 w-[300px] max-w-[86vw] p-3"
              initial={{ x: '-105%' }}
              animate={{ x: 0 }}
              exit={{ x: '-105%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <aside aria-label="Primary" role="dialog" aria-modal="true" data-lenis-prevent className="nav-panel flex h-full flex-col overflow-hidden rounded-2xl">
                <PanelBody
                  pathname={pathname}
                  collapsed={false}
                  layoutId="drawer-nav-active"
                  onClose={() => setDrawer(false)}
                  onNavigate={() => setDrawer(false)}
                  drawer
                />
              </aside>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const subscribeMinute = (cb: () => void) => {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}

function PanelBody({
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
  const { user } = useUser()
  const today = useSyncExternalStore(subscribeMinute, () => format(new Date(), 'EEE d MMM'), () => '')

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
          'group relative flex min-h-11 items-center gap-3 rounded-xl p-1.5 text-sm transition-colors',
          collapsed ? 'justify-center' : 'pr-3',
          active ? 'text-parchment' : 'text-parchment/60 hover:text-parchment',
        ].join(' ')}
      >
        {active ? (
          <motion.span
            layoutId={layoutId}
            aria-hidden
            className="absolute inset-0 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/[0.16] via-gold/[0.07] to-transparent"
            transition={{ type: 'spring', stiffness: 520, damping: 42 }}
          />
        ) : (
          <span aria-hidden className="absolute inset-0 rounded-xl bg-gold/[0.05] opacity-0 transition-opacity group-hover:opacity-100" />
        )}
        <span
          className={[
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            active ? 'bg-gold text-ink shadow-[0_4px_14px_rgb(var(--gold-rgb)/0.35)]' : 'bg-gold/[0.06] text-gold-dim group-hover:bg-gold/[0.12] group-hover:text-gold',
          ].join(' ')}
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2 : 1.7} aria-hidden />
        </span>
        {!collapsed && <span className={`relative truncate ${active ? 'font-semibold' : 'font-medium'}`}>{link.name}</span>}
      </Link>
    )
  }

  const name = user?.fullName || user?.firstName || user?.username || 'Your account'
  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <>
      {/* Wordmark */}
      <div className={`flex h-16 shrink-0 items-center gap-3 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <Link href="/dashboard" onClick={onNavigate} aria-label="Inchstone home" className="flex min-w-0 items-center gap-3">
          <WorkClock size={30} progress={100} />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block font-display text-[1.2rem] font-bold leading-none tracking-[-0.01em] text-parchment">Inchstone</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.3em] text-gold-dim">small deeds daily</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button type="button" onClick={onClose} aria-label="Close sidebar" title="Close sidebar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-parchment/40 transition-colors hover:bg-gold/[0.07] hover:text-parchment">
            {drawer ? <X className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.6} />}
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className={`shrink-0 space-y-2 px-3 pb-3 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        <button
          type="button"
          onClick={() => { onNavigate?.(); openCommand() }}
          title="Search and jump (Ctrl K)"
          aria-label="Search and jump"
          className={`flex items-center gap-2.5 rounded-xl border border-gold/15 bg-ink/40 text-sm text-parchment/45 transition-colors hover:border-gold/35 hover:text-parchment/75 ${collapsed ? 'h-11 w-11 justify-center' : 'h-10 w-full px-3'}`}
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search or jump</span>
              <kbd className="rounded-md border border-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-parchment/40">Ctrl K</kbd>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => { onNavigate?.(); openAssistant() }}
          title="Ask the assistant"
          aria-label="Ask the assistant"
          className={`group flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-glow font-semibold text-ink shadow-[0_8px_24px_rgb(var(--gold-rgb)/0.25)] transition-transform hover:-translate-y-px active:translate-y-0 ${collapsed ? 'h-11 w-11 justify-center' : 'h-10 w-full px-3 text-sm'}`}
        >
          <Sparkles className="h-4 w-4 shrink-0 transition-transform group-hover:rotate-12" strokeWidth={2} aria-hidden />
          {!collapsed && <span>Ask assistant</span>}
        </button>
      </div>

      {/* Groups */}
      <nav aria-label="Sections" className="nav-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {collapsed ? (
              <span aria-hidden className="mx-auto my-2 block h-px w-8 bg-gold/15" />
            ) : (
              <p className="flex items-center gap-2 px-2 pb-1 pt-1 font-mono text-[9.5px] uppercase tracking-[0.26em] text-parchment/35">
                {group.label}
                <span aria-hidden className="h-px flex-1 bg-gold/10" />
              </p>
            )}
            {group.links.map(row)}
          </div>
        ))}
      </nav>

      {/* Foot */}
      <div className="shrink-0 space-y-1 border-t border-gold/10 p-3" style={drawer ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' } : undefined}>
        {row(SETTINGS_LINK)}
        <Link
          href="/settings"
          onClick={onNavigate}
          title={collapsed ? name : undefined}
          className={`flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-gold/[0.05] ${collapsed ? 'justify-center' : ''}`}
        >
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Clerk-hosted avatar, already sized
            <img src={user.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gold/30" />
          ) : (
            <span className="h-8 w-8 shrink-0 rounded-full bg-gold/15 ring-1 ring-gold/30" />
          )}
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-parchment">{name}</span>
              <span className="block truncate font-mono text-[10px] text-parchment/40">{email ?? today}</span>
            </span>
          )}
        </Link>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-xs text-parchment/40 transition-colors hover:bg-gold/[0.05] hover:text-parchment/80 ${collapsed ? 'justify-center' : ''}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" strokeWidth={1.6} /> : <ChevronsLeft className="h-4 w-4" strokeWidth={1.6} />}
            {!collapsed && <span>Collapse</span>}
            {!collapsed && today && <span className="ml-auto font-mono text-[10px] text-parchment/30">{today}</span>}
          </button>
        )}
      </div>
    </>
  )
}
