'use client'

import React from 'react'
import { useMobileMenu } from './MobileMenuContext'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Calendar, Users, FileText, Settings, BarChart3, DollarSign, X, UserPlus, Bell } from 'lucide-react'

export function MobileMenu() {
    const { isOpen, setIsOpen } = useMobileMenu()
    const pathname = usePathname()
    const router = useRouter()

    const links = [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Calendar', href: '/calendar', icon: CalendarDays },
        { name: 'Year View', href: '/year', icon: Calendar },
        { name: 'Finance', href: '/finance', icon: DollarSign },
        { name: 'Partners', href: '/partners', icon: Users },
        { name: 'Notes', href: '/notes', icon: FileText },
        { name: 'Reports', href: '/reports', icon: BarChart3 },
        { name: 'Settings', href: '/settings', icon: Settings },
    ]

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard'
        return pathname.startsWith(href)
    }

    const handleNavigate = (href: string) => {
        setIsOpen(false)
        router.push(href)
    }

    // Toggle body class for CSS-based content shift
    React.useEffect(() => {
        if (isOpen) {
            document.body.classList.add('mobile-menu-open')
        } else {
            document.body.classList.remove('mobile-menu-open')
        }
        return () => document.body.classList.remove('mobile-menu-open')
    }, [isOpen])

    return (
        <>
            {isOpen && (
                <div className="mobile-menu-overlay" onClick={() => setIsOpen(false)} />
            )}

            <div className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] z-50 overflow-y-auto bg-surface-solid border-r hairline-right transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center justify-between border-b border-gold-dim/15 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-dim/20">
                            <span className="text-sm font-bold text-gold">I</span>
                        </div>
                        <span className="font-display font-bold text-parchment">Inchstone</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-parchment/60 transition-colors hover:bg-mist hover:text-parchment"
                        aria-label="Close menu"
                    >
                        <X className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                </div>

                <nav className="space-y-1 p-3">
                    {links.map((link) => {
                        const Icon = link.icon
                        const active = isActive(link.href)
                        return (
                            <div
                                key={link.name}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleNavigate(link.href)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNavigate(link.href) }}
                                className={`relative flex cursor-pointer items-center gap-3 rounded-md px-4 py-3.5 text-left transition-colors ${
                                    active ? 'text-parchment' : 'text-parchment/55 hover:bg-mist hover:text-parchment'
                                }`}
                            >
                                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-gold' : 'text-gold-dim'}`} strokeWidth={1.5} />
                                <span className="text-sm font-medium">{link.name}</span>
                                {active && <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 bg-gold" />}
                            </div>
                        )
                    })}
                </nav>

                <div className="mt-2 border-t border-gold-dim/15 p-3">
                    <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-parchment/35">Quick Actions</p>
                    <div className="space-y-1">
                        <button
                            onClick={() => handleNavigate('/partners')}
                            className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-parchment/55 transition-colors hover:bg-mist hover:text-parchment"
                        >
                            <UserPlus className="h-4 w-4 text-gold-dim" strokeWidth={1.5} />
                            <span className="text-sm">Add Partner</span>
                        </button>
                        <button
                            onClick={() => handleNavigate('/settings')}
                            className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-parchment/55 transition-colors hover:bg-mist hover:text-parchment"
                        >
                            <Bell className="h-4 w-4 text-gold-dim" strokeWidth={1.5} />
                            <span className="text-sm">Notifications</span>
                        </button>
                    </div>
                </div>

                <div className="mt-2 border-t border-gold-dim/15 p-4">
                    <p className="text-center font-mono text-[10px] text-parchment/25">v2 · by small deeds</p>
                </div>
            </div>
        </>
    )
}