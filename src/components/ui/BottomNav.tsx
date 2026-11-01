'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, Search, Sparkles, X } from 'lucide-react'
import { ALL_LINKS, MOBILE_TABS, NAV_GROUPS, SETTINGS_LINK, isNavActive } from '@/components/ds/nav'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDialog } from '@/components/ui/useDialog'
import { openAssistant, openCommand } from '@/lib/uiEvents'
import { useUnread } from '@/lib/useUnread'

/**
 * Phone navigation (v4): a floating dock with two tabs either side of a
 * raised gold assistant button, and a More sheet laid out as a tile grid.
 * The active tab wears a gold pill that slides between tabs.
 */
export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)
  const unread = useUnread()
  const sheetRef = useDialog<HTMLDivElement>(showMore, () => setShowMore(false))

  const tabs = MOBILE_TABS.map((href) => {
    const l = ALL_LINKS.find((x) => x.href === href)!
    return { name: l.short ?? l.name, href: l.href, icon: l.icon, hint: l.hint }
  })
  const left = tabs.slice(0, 2)
  const right = tabs.slice(2)

  const moreGroups = [
    ...NAV_GROUPS.map((g) => ({ label: g.label, links: g.links.filter((l) => !MOBILE_TABS.includes(l.href)) })),
    { label: 'App', links: [SETTINGS_LINK] },
  ].filter((g) => g.links.length > 0)
  const moreActive = moreGroups.some((g) => g.links.some((l) => isNavActive(pathname, l.href)))

  const go = (href: string) => {
    setShowMore(false)
    router.push(href)
  }

  const tab = ({ name, href, icon: Icon, hint, active, onClick }: { name: string; href: string; icon: React.ElementType; hint: string; active: boolean; onClick: () => void }) => (
    <button
      key={href}
      onClick={onClick}
      data-cursor={hint}
      aria-current={active ? 'page' : undefined}
      aria-label={name}
      className="relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
    >
      {active && (
        <motion.span
          layoutId="dock-active"
          aria-hidden
          className="absolute inset-x-1 inset-y-0 rounded-xl border border-gold/25 bg-gold/[0.12]"
          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
        />
      )}
      <Icon className={`relative h-[21px] w-[21px] ${active ? 'text-gold' : 'text-parchment/50'}`} strokeWidth={active ? 2 : 1.6} aria-hidden />
      <span className={`relative text-[10px] leading-none tracking-wide ${active ? 'font-semibold text-gold' : 'font-medium text-parchment/50'}`}>{name}</span>
    </button>
  )

  return (
    <>
      <div
        className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)' }}
      >
        <nav
          aria-label="Primary"
          className="nav-panel pointer-events-auto relative mx-auto flex max-w-md items-stretch gap-0.5 rounded-[22px] p-1.5"
        >
          {left.map((t) => tab({ ...t, active: isNavActive(pathname, t.href), onClick: () => go(t.href) }))}

          {/* Centre: the assistant, raised out of the dock */}
          <div className="flex w-[68px] shrink-0 items-start justify-center">
            <motion.button
              type="button"
              onClick={openAssistant}
              aria-label="Ask the assistant"
              whileTap={{ scale: 0.92 }}
              className="-mt-6 flex h-[58px] w-[58px] items-center justify-center rounded-full bg-gradient-to-br from-gold-glow to-gold text-ink shadow-[0_10px_28px_rgb(var(--gold-rgb)/0.45)] ring-4 ring-[var(--surface-solid)]"
            >
              <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
            </motion.button>
          </div>

          {right.map((t) => tab({ ...t, active: isNavActive(pathname, t.href), onClick: () => go(t.href) }))}
          {tab({ name: unread > 0 ? `More · ${unread}` : 'More', href: '#more', icon: LayoutGrid, hint: 'Every page', active: moreActive || showMore, onClick: () => setShowMore(true) })}
        </nav>
      </div>

      {/* More: every other page as a tile grid */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            className="lg:hidden fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMore(false)}
          >
            <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="All pages"
              ref={sheetRef}
              tabIndex={-1}
              data-lenis-prevent
              className="nav-panel absolute inset-x-2 bottom-2 max-h-[86dvh] overflow-y-auto overscroll-contain rounded-3xl"
              initial={{ y: '105%' }}
              animate={{ y: 0 }}
              exit={{ y: '105%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-parchment/15" />
              <div className="px-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                <div className="flex items-center justify-between pb-3">
                  <h3 className="font-display text-xl font-bold text-parchment">All pages</h3>
                  <button onClick={() => setShowMore(false)} aria-label="Close"
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-parchment/50 hover:text-parchment">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2">
                  <button onClick={() => { setShowMore(false); openCommand() }}
                    className="flex h-12 items-center gap-2.5 rounded-2xl border border-gold/15 bg-ink/40 px-3.5 text-sm text-parchment/60">
                    <Search className="h-4 w-4" aria-hidden /> Search
                  </button>
                  <button onClick={() => { setShowMore(false); openAssistant() }}
                    className="flex h-12 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-gold to-gold-glow px-3.5 text-sm font-semibold text-ink">
                    <Sparkles className="h-4 w-4" aria-hidden /> Ask assistant
                  </button>
                </div>

                <div className="space-y-5">
                  {moreGroups.map((group) => (
                    <section key={group.label}>
                      <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">
                        {group.label}<span aria-hidden className="h-px flex-1 bg-gold/10" />
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {group.links.map((link) => {
                          const Icon = link.icon
                          const active = isNavActive(pathname, link.href)
                          return (
                            <button
                              key={link.href}
                              onClick={() => go(link.href)}
                              aria-current={active ? 'page' : undefined}
                              className={`flex aspect-[1.05] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center transition-colors active:scale-95 ${
                                active ? 'border-gold/40 bg-gold/[0.12]' : 'border-gold/10 bg-ink/30 hover:border-gold/30'
                              }`}
                            >
                              <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-gold text-ink' : 'bg-gold/[0.08] text-gold'}`}>
                                {link.href === '/partners' && unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1 font-mono text-[10px] font-bold text-ink">{unread}</span>}
                                <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
                              </span>
                              <span className={`text-[12px] leading-tight ${active ? 'font-semibold text-parchment' : 'font-medium text-parchment/75'}`}>{link.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
