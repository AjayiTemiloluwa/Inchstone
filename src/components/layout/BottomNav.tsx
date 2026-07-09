'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Calendar, FileText, Settings } from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  const links = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Year', href: '/year', icon: Calendar },
    { name: 'Notes', href: '/notes', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bottom-nav-glass pb-safe">
      <nav className="flex items-center justify-around px-2 py-1.5">
        {links.map((link) => {
          const Icon = link.icon
          const active = isActive(link.href)
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`
                flex flex-col items-center justify-center min-w-[56px] py-1.5 rounded-2xl transition-all duration-200
                ${active
                  ? 'text-gold'
                  : 'text-ink/40 active:text-ink/70'
                }
              `}
            >
              <div className={`relative ${active ? 'scale-110' : ''} transition-transform duration-200`}>
                {active && (
                  <div className="absolute -inset-2.5 bg-gold/10 rounded-xl" />
                )}
                <Icon className={`w-5 h-5 relative z-10 ${active ? 'text-gold' : ''}`} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] mt-1 tracking-tight ${active ? 'font-semibold text-gold' : 'font-medium'}`}>
                {link.name}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
