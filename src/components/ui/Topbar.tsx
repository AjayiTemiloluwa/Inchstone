'use client'

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { YearPickerChip } from "@/components/ui/YearPicker";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Topbar() {
  const pathname = usePathname()

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
      {/* Left: page title (navigation lives in the bottom bar on mobile, sidebar on desktop) */}
      <h2 className="text-sm font-semibold text-parchment/80">{getPageTitle()}</h2>

      {/* Right: year workspace picker + compass + user */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <YearPickerChip />
        <div className="w-px h-5 bg-gold-dim/25" />
        <ThemeToggle />
        <div className="w-px h-5 bg-gold-dim/25" />
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
