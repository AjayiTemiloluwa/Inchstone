'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Calendar, Users, FileText, Settings, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

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

  return (
    <div className={`hidden lg:flex h-full glass-strong flex-col shrink-0 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex flex-col h-full py-2">
        {/* Collapse Button */}
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition text-ink/40 hover:text-ink"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
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
                title={collapsed ? link.name : undefined}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gold rounded-r-full" />
                )}
                <Icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'} transition-transform duration-200 group-hover:scale-110 ${active ? 'text-gold' : ''}`} />
                {!collapsed && <span className="text-sm">{link.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 border-t border-white/[0.06]">
            <p className="text-[10px] text-ink/20 text-center font-mono">v1.0 · Built with purpose</p>
          </div>
        )}
      </div>
    </div>
  )
}
