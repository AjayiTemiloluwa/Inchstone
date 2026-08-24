'use client'

import { UserButton } from "@clerk/nextjs";
import { PushNotificationManager } from "@/components/ui/PushNotificationManager";
import { usePathname } from "next/navigation";
import { Menu, X, Compass } from "lucide-react";
import { useMobileMenu } from "@/components/ui/MobileMenuContext";

export function Topbar() {
  const pathname = usePathname()
  const { isOpen, setIsOpen } = useMobileMenu();

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
    <header className="h-14 bg-ink border-b hairline-bottom flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
      {/* Left: menu button + page title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-2 -ml-2 rounded-md hover:bg-mist transition text-gold-dim hover:text-parchment min-w-11 min-h-11 flex items-center justify-center"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <h2 className="text-sm font-semibold text-parchment/80">{getPageTitle()}</h2>
      </div>

      {/* Right: small compass + divider + user */}
      <div className="flex items-center space-x-4">
        <PushNotificationManager />
        <Compass className="h-5 w-5 text-gold-dim" strokeWidth={1.5} aria-hidden />
        <div className="w-px h-5 bg-gold-dim/25" />
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8 ring-2 ring-gold-dim/30 ring-offset-2 ring-offset-ink',
            }
          }}
        />
      </div>
    </header>
  )
}
