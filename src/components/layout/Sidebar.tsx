'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Calendar, Users, FileText, Settings, BarChart3, Menu, X, Trophy, Flame } from 'lucide-react'
import { useState, useEffect } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Close on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const links = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Year View', href: '/year', icon: Calendar },
    { name: 'Partners', href: '/partners', icon: Users },
    { name: 'Notes', href: '/notes', icon: FileText },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-6 pb-2">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-gold/60 flex items-center justify-center shadow-lg shadow-gold/20">
            <Trophy className="w-5 h-5 text-paper" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">
              Inchstone
            </h1>
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/30 font-bold">Goals & Cascades</p>
          </div>
        </div>
      </div>

      {/* Streak / XP Section */}
      <div className="px-6 py-3">
        <div className="glass-gold rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-coral" />
              <span className="text-xs font-bold text-ink/70">Streak</span>
            </div>
            <span className="streak-badge">🔥 0 days</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-ink/40 font-mono">Level 1</span>
            <span className="xp-badge">✦ 0 XP</span>
          </div>
          <div className="mt-2 w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold to-gold-glow rounded-full" style={{ width: '0%' }} />
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 space-y-1 mt-2">
        {links.map((link) => {
          const Icon = link.icon
          const active = isActive(link.href)
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`
                flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative
                ${active
                  ? 'glass-gold text-gold font-semibold glow-sm'
                  : 'text-ink/50 hover:text-ink hover:bg-white/[0.04]'
                }
              `}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gold rounded-r-full" />
              )}
              <Icon className={`w-5 h-5 mr-3 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-gold' : ''}`} />
              <span className="text-sm">{link.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <p className="text-[10px] text-ink/20 text-center font-mono">v1.0 · Built with purpose</p>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 glass rounded-xl hover:bg-white/[0.08] transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-ink" />
      </button>

      {/* Mobile Overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <div className={`
        lg:hidden fixed top-0 left-0 z-50 h-full w-72
        glass-strong flex flex-col
        transform transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 p-2 hover:bg-white/[0.06] rounded-xl transition"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-ink/50" />
        </button>
        {navContent}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 h-full glass-strong flex-col shrink-0">
        {navContent}
      </div>
    </>
  )
}
