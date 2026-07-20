'use client'

import { UserButton } from "@clerk/nextjs";
import { PushNotificationManager } from "@/components/ui/PushNotificationManager";
import { usePathname } from "next/navigation";
import { useMobileMenu } from "./MobileMenuContext";

export function Topbar() {
  const pathname = usePathname()
  const { isOpen } = useMobileMenu()

  // Extract page title from path
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return 'Dashboard'
    const map: Record<string, string> = {
      dashboard: 'Dashboard',
      calendar: 'Calendar',
      year: 'Year View',
      quarter: 'Quarter',
      month: 'Month',
      week: 'Week',
      day: 'Day',
      partners: 'Partners',
      notes: 'Notes',
      reports: 'Reports',
      settings: 'Settings',
    }
    return map[segments[0]] || segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
  }

  return (
    <header className={`h-14 glass-strong flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 transition-transform duration-300 ${isOpen ? 'lg:translate-x-[320px]' : ''}`}>
      {/* Left: page title */}
      <div className="flex items-center space-x-4">
        <h2 className="text-sm font-bold text-ink/60">{getPageTitle()}</h2>
      </div>

      {/* Right: actions */}
      <div className="flex items-center space-x-4">
        <PushNotificationManager />
        <div className="w-px h-6 bg-white/[0.06]" />
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8 ring-2 ring-gold/20 ring-offset-2 ring-offset-paper',
            }
          }}
        />
      </div>
    </header>
  )
}
