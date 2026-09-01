'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Calendar, FileText, MoreHorizontal, Users, BarChart3, Settings, X, DollarSign, Target, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

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

  const mainLinks = [
    { name: 'Home', href: '/dashboard', icon: Home, hint: 'Your home base' },
    { name: 'Finance', href: '/finance', icon: DollarSign, hint: 'Count your coins' },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays, hint: 'Mark the days' },
    { name: 'Year', href: '/year', icon: Calendar, hint: 'The long view' },
    { name: 'More', href: '#more', icon: MoreHorizontal, hint: 'Even more good stuff' },
  ]

  const moreLinks = [
    { name: 'Challenge', href: '/challenge', icon: FlaskConical, hint: 'Fill the bottles', desc: 'Challenge bottles filled from reflections' },
    { name: 'Long-Term Plans', href: '/plans', icon: Target, hint: 'Dream in decades', desc: 'Goals across months, years & decades' },
    { name: 'Notes', href: '/notes', icon: FileText, hint: 'Write it down', desc: 'Notes & journal entries' },
    { name: 'Partners', href: '/partners', icon: Users, hint: 'Your people', desc: 'Accountability partners & messaging' },
    { name: 'Reports', href: '/reports', icon: BarChart3, hint: 'See the patterns', desc: 'Progress reports & analytics' },
    { name: 'Settings', href: '/settings', icon: Settings, hint: 'Make it yours', desc: 'App settings & preferences' },
  ]

  const isMoreActive = moreLinks.some(l => pathname.startsWith(l.href))

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '#more') return isMoreActive
    return pathname.startsWith(href)
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
      {/* Main bottom tab bar — mobile only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-ink hairline-top pb-safe">
        <nav className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
          {mainLinks.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <button
                key={link.name}
                onClick={() => handleMainClick(link.name, link.href)}
                data-cursor={link.hint}
                aria-current={active ? 'page' : undefined}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 transition-opacity active:opacity-70"
                style={{ minHeight: 52 }}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 ${
                    active ? 'bg-gold/15' : 'bg-transparent'
                  }`}
                >
                  <Icon
                    className={active ? 'text-gold' : 'text-parchment/45'}
                    strokeWidth={active ? 2 : 1.5}
                    style={{ width: 22, height: 22 }}
                  />
                </span>
                <span
                  className={`leading-none ${
                    active ? 'font-semibold text-gold' : 'font-medium text-parchment/45'
                  }`}
                  style={{ fontSize: 10 }}
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
              className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-ink hairline-top shadow-[0_-18px_50px_rgba(0,0,0,0.35)]"
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

                <div className="space-y-1">
                  {moreLinks.map((link) => {
                    const Icon = link.icon
                    const active = pathname.startsWith(link.href)
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
