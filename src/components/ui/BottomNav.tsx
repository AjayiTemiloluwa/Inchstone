'use client'

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Calendar, FileText, Settings, Flame, Target, BarChart3 } from 'lucide-react'
import { useState, useEffect } from 'react'

export function BottomNav() {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [pressAnimations, setPressAnimations] = useState<Record<string, boolean>>({})

  const links = [
    { name: 'Home', href: '/dashboard', icon: Home, badge: 0 },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays, badge: 0 },
    { name: 'Year', href: '/year', icon: Calendar, badge: 0 },
    { name: 'Notes', href: '/notes', icon: FileText, badge: 0 },
    { name: 'Settings', href: '/settings', icon: Settings, badge: 0 },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleTouchStart = (name: string) => {
    setPressAnimations(prev => ({ ...prev, [name]: true }))
  }

  const handleTouchEnd = (name: string) => {
    setTimeout(() => {
      setPressAnimations(prev => ({ ...prev, [name]: false }))
    }, 200)
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bottom-nav-glass pb-safe">
      {/* Haptic feedback line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      <nav className="flex items-center justify-around px-1 py-2">
        {links.map((link) => {
          const Icon = link.icon
          const active = isActive(link.href)
          const isPressed = pressAnimations[link.name]

          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setActiveTab(link.name)}
              onTouchStart={() => handleTouchStart(link.name)}
              onTouchEnd={() => handleTouchEnd(link.name)}
              className={`
                relative flex flex-col items-center justify-center min-w-[64px] py-2 rounded-2xl
                transition-all duration-300 ease-out
                ${isPressed ? 'scale-90' : active ? 'scale-105' : 'scale-100'}
                ${active ? 'text-gold' : 'text-ink/40'}
              `}
            >
              {/* Active background with glow */}
              {active && (
                <div className="absolute inset-0 bg-gold/10 rounded-2xl animate-pulseGlow" />
              )}

              {/* Press feedback ripple */}
              {isPressed && !active && (
                <div className="absolute inset-0 bg-white/15 rounded-2xl animate-fadeIn" />
              )}

              {/* Icon container */}
              <div className="relative">
                <div className={`
                  absolute -inset-2 rounded-xl transition-all duration-300
                  ${active ? 'bg-gold/20 scale-100' : 'bg-transparent scale-0'}
                `} />
                <Icon
                  className={`
                    w-6 h-6 relative z-10 transition-all duration-300
                    ${active ? 'text-gold scale-110' : ''}
                    ${isPressed ? 'rotate-12' : 'rotate-0'}
                  `}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>

              {/* Label */}
              <span className={`
                text-[10px] mt-1.5 tracking-tight transition-all duration-300
                ${active ? 'font-bold text-gold' : 'font-medium'}
                ${isPressed ? 'scale-110 opacity-70' : 'scale-100 opacity-100'}
              `}>
                {link.name}
              </span>

              {/* Active indicator */}
              {active && (
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
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
