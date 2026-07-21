'use client'

import React from 'react'
import { useMobileMenu } from './MobileMenuContext'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Calendar, Users, FileText, Settings, BarChart3, X, Menu, MessageSquare, UserPlus, Bell } from 'lucide-react'

export function MobileMenu() {
    const { isOpen, setIsOpen } = useMobileMenu()
    const pathname = usePathname()
    const router = useRouter()

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
            {/* Hamburger button */}
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden fixed top-3 left-3 z-30 p-2.5 rounded-xl bg-surface/80 backdrop-blur-md border border-mist shadow-lg active:scale-90 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5 text-ink" />
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="mobile-menu-overlay"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Panel */}
            <div className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-paper z-50 shadow-xl overflow-y-auto transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-mist">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                            <span className="text-gold font-bold text-sm">I</span>
                        </div>
                        <span className="font-display font-bold text-ink">Inchstone</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-mist rounded-lg active:scale-90 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="p-3 space-y-1">
                    {links.map((link) => {
                        const Icon = link.icon
                        const active = isActive(link.href)
                        return (
                            <button
                                key={link.name}
                                onClick={() => handleNavigate(link.href)}
                                className={`
                  w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 text-left
                  ${active
                                        ? 'bg-gold/10 text-gold font-semibold border border-gold/20'
                                        : 'text-ink/60 hover:text-ink hover:bg-mist'
                                    }
                `}
                            >
                                <Icon className={`w-5 h-5 ${active ? 'text-gold' : ''}`} />
                                <span className="text-sm">{link.name}</span>
                                {active && (
                                    <div className="ml-auto w-2 h-2 rounded-full bg-gold" />
                                )}
                            </button>
                        )
                    })}
                </nav>

                {/* Quick Actions */}
                <div className="p-3 border-t border-mist mt-2">
                    <p className="text-[10px] font-bold uppercase text-ink/30 tracking-wider px-4 mb-2">Quick Actions</p>
                    <div className="space-y-1">
                        <button
                            onClick={() => handleNavigate('/partners')}
                            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-ink/60 hover:text-ink hover:bg-mist transition text-left"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span className="text-sm">Add Partner</span>
                        </button>
                        <button
                            onClick={() => handleNavigate('/settings')}
                            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-ink/60 hover:text-ink hover:bg-mist transition text-left"
                        >
                            <Bell className="w-4 h-4" />
                            <span className="text-sm">Notifications</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-mist mt-2">
                    <p className="text-[10px] text-ink/20 text-center font-mono">v1.0 · Built with purpose</p>
                </div>
            </div>
        </>
    )
}