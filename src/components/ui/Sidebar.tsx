'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Calendar, Users, FileText, Settings, BarChart3, DollarSign, Compass, ChevronLeft, ChevronRight, Target } from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const links = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Finance', href: '/finance', icon: DollarSign },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Year View', href: '/year', icon: Calendar },
    { name: 'Long-Term', href: '/plans', icon: Target },
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
    <div className={`hidden lg:flex h-full flex-col shrink-0 bg-ink border-r hairline-right transition-[width] duration-300 ${collapsed ? 'w-[72px]' : 'w-60'}`}>
      <div className="flex flex-col h-full">
        {/* Top: wordmark + collapse */}
        <div className="flex items-center justify-between px-4 h-16">
          {!collapsed && (
            <span className="font-display text-lg text-parchment whitespace-nowrap">Inchstone</span>
          )}
          {collapsed && (
            <Compass className="h-5 w-5 text-gold mx-auto" strokeWidth={1.5} />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-gold-dim hover:text-parchment rounded-md transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-0.5 mt-2">
          {links.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <Link
                key={link.name}
                href={link.href}
                title={collapsed ? link.name : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active ? 'text-parchment' : 'text-parchment/55 hover:text-parchment/85 hover:bg-mist'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-gold' : 'text-gold-dim'}`} strokeWidth={1.5} />
                {!collapsed && <span>{link.name}</span>}
                {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-gold" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="px-6 py-4">
            <p className="text-[11px] text-parchment/35 font-mono">v2 · by small deeds</p>
          </div>
        )}
      </div>
    </div>
  )
}

