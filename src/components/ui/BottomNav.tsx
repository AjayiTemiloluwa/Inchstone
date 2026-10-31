'use client'

import { usePathname, useRouter } from 'next/navigation'
import { MoreHorizontal, X } from 'lucide-react'
import { ALL_LINKS, MOBILE_TABS, NAV_GROUPS, SETTINGS_LINK, isNavActive } from '@/components/ds/nav'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDialog } from '@/components/ui/useDialog'

/**
 * BottomNav — the standard mobile tab bar.
 * Five primary destinations + a "More" bottom sheet for the rest. Active
 * tab: gold-tinted pill around the icon, gold semibold label — the canonical
 * mobile-app pattern. The bar sits above the home indicator (pb-safe) and
 * every target is ≥52px (thumb-comfort). The More panel is a proper sheet:
 * grab handle, spring slide-up, safe-area padding, tap-outside to dismiss.
 */

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const sheetRef = useDialog<HTMLDivElement>(showMoreMenu, () => setShowMoreMenu(false))

  // Tabs and More-sheet groups come from the shared nav list (ds/nav.ts).
  const mainLinks = [
    ...MOBILE_TABS.map((href) => {
      const l = ALL_LINKS.find((x) => x.href === href)!
      return { name: l.short ?? l.name, href: l.href, icon: l.icon, hint: l.hint }
    }),
    { name: 'More', href: '#more', icon: MoreHorizontal, hint: 'Even more good stuff' },
  ]

  const moreGroups = [
    ...NAV_GROUPS.map((g) => ({ label: g.label, links: g.links.filter((l) => !MOBILE_TABS.includes(l.href)) })),
    { label: 'App', links: [SETTINGS_LINK] },
  ].filter((g) => g.links.length > 0)
  const moreLinks = moreGroups.flatMap((g) => g.links)

  const isMoreActive = moreLinks.some(l => isNavActive(pathname, l.href))

  const isActive = (href: string) => {
    if (href === '#more') return isMoreActive
    return isNavActive(pathname, href)
  }

  const handleMainClick = (name: string, href: string) => {
    if (href === '#more') {
      setShowMoreMenu(true)
      return
    }
    router.push(href)
  }

  const handleMoreNavigate = (href: string) => {
    setShowMoreMenu(false)
    router.push(href)
  }

  return (
    <>
      {/* Main tab bar (mobile only): a floating dock above the home indicator.
          The active tab wears a gold pill that slides between tabs. */}
      <div
        className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)' }}
      >
        <nav
          aria-label="Primary"
          className="pointer-events-auto relative mx-auto flex max-w-md items-stretch gap-1 rounded-2xl border border-gold/20 bg-ink/85 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgb(var(--gold-rgb)/0.12)] backdrop-blur-xl"
        >
          {mainLinks.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <button
                key={link.name}
                onClick={() => handleMainClick(link.name, link.href)}
                data-cursor={link.hint}
                aria-current={active ? 'page' : undefined}
                aria-label={link.name}
                className="relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {active && (
                  <motion.span
                    layoutId="dock-active"
                    aria-hidden
                    className="absolute inset-0 rounded-xl border border-gold/30 bg-gold/[0.13]"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
                <Icon
                  className={`relative h-[21px] w-[21px] transition-colors ${active ? 'text-gold' : 'text-parchment/50'}`}
                  strokeWidth={active ? 2 : 1.6}
                  aria-hidden
                />
                <span
                  className={`relative text-[10px] leading-none tracking-wide transition-colors ${active ? 'font-semibold text-gold' : 'font-medium text-parchment/50'}`}
                >
                  {link.name}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* More sheet — mobile only */}
      <AnimatePresence>
        {showMoreMenu && (
          <motion.div
            className="lg:hidden fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMoreMenu(false)}
          >
            <div className="absolute inset-0 bg-ink/70" />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="More"
              ref={sheetRef}
              tabIndex={-1}
              data-lenis-prevent
              className="absolute bottom-0 left-0 right-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-ink hairline-top shadow-[0_-18px_50px_rgba(0,0,0,0.35)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Grab handle */}
              <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />

              <div className="px-2 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
                <div className="flex items-center justify-between px-3 pb-3">
                  <h3 className="text-lg font-semibold text-parchment">More</h3>
                  <button
                    onClick={() => setShowMoreMenu(false)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-gold-dim hover:text-parchment transition"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {moreGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                  <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-parchment/35">{group.label}</p>
                  {group.links.map((link) => {
                    const Icon = link.icon
                    const active = isNavActive(pathname, link.href)
                    return (
                      <button
                        key={link.name}
                        onClick={() => handleMoreNavigate(link.href)}
                        data-cursor={link.hint}
                        className={`relative w-full flex items-center gap-4 p-3.5 rounded-xl transition-colors text-left ${
                          active ? 'text-parchment bg-gold/10' : 'text-parchment/60 hover:bg-mist hover:text-parchment'
                        }`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? 'bg-gold/15 text-gold' : 'bg-white/[0.05] text-gold-dim'}`}>
                          <Icon className="w-5 h-5" strokeWidth={1.5} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{link.name}</p>
                          <p className="text-xs text-parchment/45 mt-0.5">{link.desc}</p>
                        </div>
                        {active && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-gold" />}
                      </button>
                    )
                  })}
                  </div>
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
