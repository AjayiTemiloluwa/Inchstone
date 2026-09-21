'use client'

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { WorkClock } from "@/components/ui/WorkClock";
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
    <header className="topbar-h bg-ink/95 backdrop-blur-xl border-b-2 border-gold-dim/20 flex shrink-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      {/* Left: the current screen. A gold tick + a full-strength title — the
          app-bar convention (nothing dimmer than what's below it). */}
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="hidden h-5 w-1 shrink-0 rounded-full bg-gold sm:block" />
        <h2 className="truncate text-[17px] font-semibold leading-none tracking-tight text-parchment sm:text-lg">
          {getPageTitle()}
        </h2>
      </div>

      {/* Right: year workspace picker + live work clock + theme + Clerk profile.
          Standard app-bar rules: every control is a 40px target, groups are
          separated by a 1px gold-dim rule, and the avatar sits last (thumb
          reach). The clock is desktop-only — on mobile the bottom bar's active
          glyph already carries the brand mark, so the row stays lean. */}
      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <YearPickerChip />
        <span aria-hidden className="hidden h-6 w-px bg-gold-dim/25 sm:block" />
        <span className="hidden sm:inline-flex">
          <WorkClock size={24} progress={100} showTime />
        </span>
        <span aria-hidden className="hidden h-6 w-px bg-gold-dim/25 sm:block" />
        <ThemeToggle />
        <span aria-hidden className="h-6 w-px bg-gold-dim/25" />
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-10 w-10 ring-2 ring-gold-dim/35 ring-offset-2 ring-offset-ink',
            }
          }}
        />
      </div>
    </header>
  )
}
