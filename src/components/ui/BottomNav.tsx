'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Calendar, FileText, MoreHorizontal, Users, BarChart3, Settings, X, MessageSquare, DollarSign } from 'lucide-react'
import { useState, useEffect } from 'react'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [pressAnimations, setPressAnimations] = useState<Record<string, boolean>>({})
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const mainLinks = [
    { name: 'Home', href: '/dashboard', icon: Home, badge: 0 },
    { name: 'Finance', href: '/finance', icon: DollarSign, badge: 0 },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays, badge: 0 },
    { name: 'Year', href: '/year', icon: Calendar, badge: 0 },
    { name: 'More', href: '#more', icon: MoreHorizontal, badge: 0 },
  ]

  const moreLinks = [
    { name: 'Notes', href: '/notes', icon: FileText, desc: 'Notes & journal entries' },
    { name: 'Partners', href: '/partners', icon: Users, desc: 'Accountability partners & messaging' },
    { name: 'Reports', href: '/reports', icon: BarChart3, desc: 'Progress reports & analytics' },
    { name: 'Settings', href: '/settings', icon: Settings, desc: 'App settings & preferences' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '#more') return false
    return pathname.startsWith(href)
  }

  const isMoreActive = moreLinks.some(l => pathname.startsWith(l.href))

  const handleTouchStart = (name: string) => {
    setPressAnimations(prev => ({ ...prev, [name]: true }))
  }

  const handleTouchEnd = (name: string) => {
    setTimeout(() => {
      setPressAnimations(prev => ({ ...prev, [name]: false }))
    }, 200)
  }

  const handleMainClick = (name: string, href: string) => {
    if (href === '#more') {
      setShowMoreMenu(true)
      return
    }
    setActiveTab(name)
    router.push(href)
  }

  const handleMoreNavigate = (href: string) => {
    setShowMoreMenu(false)
    router.push(href)
  }

  return (
    <>
      {/* Main bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bottom-nav-glass pb-safe">
        {/* Haptic feedback line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

        <nav className="flex items-center justify-around px-1 py-2">
          {mainLinks.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            const isPressed = pressAnimations[link.name]
            const isMore = link.name === 'More'
            const moreActive = isMore && isMoreActive

            return (
              <button
                key={link.name}
                onClick={() => handleMainClick(link.name, link.href)}
                onTouchStart={() => handleTouchStart(link.name)}
                onTouchEnd={() => handleTouchEnd(link.name)}
                className={`
                  relative flex flex-col items-center justify-center min-w-[64px] py-2 rounded-2xl
                  transition-all duration-300 ease-out
                  ${isPressed ? 'scale-90' : active || moreActive ? 'scale-105' : 'scale-100'}
                  ${active || moreActive ? 'text-gold' : 'text-ink/40'}
                `}
              >
                {/* Active background with glow */}
                {(active || moreActive) && (
                  <div className="absolute inset-0 bg-gold/10 rounded-2xl animate-pulseGlow" />
                )}

                {/* Press feedback ripple */}
                {isPressed && !active && !moreActive && (
                  <div className="absolute inset-0 bg-white/15 rounded-2xl animate-fadeIn" />
                )}

                {/* Icon container */}
                <div className="relative">
                  <div className={`
                    absolute -inset-2 rounded-xl transition-all duration-300
                    ${active || moreActive ? 'bg-gold/20 scale-100' : 'bg-transparent scale-0'}
                  `} />
                  <Icon
                    className={`
                      w-6 h-6 relative z-10 transition-all duration-300
                      ${active || moreActive ? 'text-gold scale-110' : ''}
                      ${isPressed ? 'rotate-12' : 'rotate-0'}
                    `}
                    strokeWidth={active || moreActive ? 2.5 : 1.8}
                  />
                </div>

                {/* Label */}
                <span className={`
                  text-[10px] mt-1.5 tracking-tight transition-all duration-300
                  ${active || moreActive ? 'font-bold text-gold' : 'font-medium'}
                  ${isPressed ? 'scale-110 opacity-70' : 'scale-100 opacity-100'}
                `}>
                  {link.name}
                </span>

                {/* Active indicator */}
                {(active || moreActive) && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center space-x-1">
                    <div className="w-1 h-1 bg-gold rounded-full animate-fadeIn" />
                    <div className="w-4 h-0.5 bg-gold rounded-full animate-slideUp" />
                  </div>
                )}

                {/* Badge */}
                {link.badge > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-coral text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {link.badge}
                  </div>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* More menu overlay */}
      {showMoreMenu && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-black/50 animate-fadeIn"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-paper rounded-t-3xl p-6 pb-12 animate-slideUp"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-ink">More</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 hover:bg-mist rounded-lg active:scale-90 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5 text-ink/60" />
              </button>
            </div>

            <div className="space-y-2">
              {moreLinks.map((link) => {
                const Icon = link.icon
                const active = pathname.startsWith(link.href)
                return (
                  <button
                    key={link.name}
                    onClick={() => handleMoreNavigate(link.href)}
                    className={`
                      w-full flex items-center space-x-4 p-4 rounded-xl transition-all active:scale-[0.98]
                      ${active
                        ? 'bg-gold/10 text-gold border border-gold/20'
                        : 'text-ink hover:bg-mist'
                      }
                    `}
                  >
                    <div className={`p-2.5 rounded-xl ${active ? 'bg-gold/20' : 'bg-mist'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`font-semibold text-sm ${active ? 'text-gold' : 'text-ink'}`}>{link.name}</p>
                      <p className="text-xs text-ink/50 mt-0.5">{link.desc}</p>
                    </div>
                    {active && (
                      <div className="w-2 h-2 rounded-full bg-gold" />
                    )}
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