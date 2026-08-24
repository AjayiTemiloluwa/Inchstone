'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Calendar, FileText, MoreHorizontal, Users, BarChart3, Settings, X, DollarSign, Compass } from 'lucide-react'
import { useState } from 'react'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const mainLinks = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Finance', href: '/finance', icon: DollarSign },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Year', href: '/year', icon: Calendar },
    { name: 'More', href: '#more', icon: MoreHorizontal },
  ]

  const moreLinks = [
    { name: 'Notes', href: '/notes', icon: FileText, desc: 'Notes & journal entries' },
    { name: 'Partners', href: '/partners', icon: Users, desc: 'Accountability partners & messaging' },
    { name: 'Reports', href: '/reports', icon: BarChart3, desc: 'Progress reports & analytics' },
    { name: 'Settings', href: '/settings', icon: Settings, desc: 'App settings & preferences' },
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
      {/* Main bottom nav — mobile only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-ink hairline-top pb-safe">
        <nav className="flex items-center justify-around px-1 py-1.5">
          {mainLinks.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <button
                key={link.name}
                onClick={() => handleMainClick(link.name, link.href)}
                className={`relative flex flex-col items-center justify-center min-w-[64px] py-1.5 rounded-md transition-opacity ${
                  active ? 'text-gold' : 'text-parchment/45 active:opacity-70'
                }`}
              >
                {active ? (
                  <Compass className="w-5 h-5" strokeWidth={1.5} />
                ) : (
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                )}
                <span className={`text-[10px] mt-1 tracking-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                  {link.name}
                </span>
                {active && (
                  <span aria-hidden className="absolute top-1/2 -translate-y-1/2 -right-0.5 flex items-center space-x-1">
                    <span className="w-1 h-1 bg-gold rounded-full" />
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* More menu overlay — mobile only */}
      {showMoreMenu && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-ink/70"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-ink rounded-t-[12px] hairline-top p-6 pb-12"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-parchment">More</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 text-gold-dim hover:text-parchment rounded-md transition min-w-11 min-h-11 flex items-center justify-center"
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
                    className={`relative w-full flex items-center gap-4 p-3.5 rounded-md transition-colors text-left ${
                      active ? 'text-parchment' : 'text-parchment/60 hover:bg-mist hover:text-parchment'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-gold' : 'text-gold-dim'}`} strokeWidth={1.5} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{link.name}</p>
                      <p className="text-xs text-parchment/45 mt-0.5">{link.desc}</p>
                    </div>
                    {active && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-gold" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
