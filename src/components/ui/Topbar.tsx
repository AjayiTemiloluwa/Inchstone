'use client'

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { YearPickerChip } from "@/components/ui/YearPicker";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Topbar() {
  const pathname = usePathname()

  // Page title + optional breadcrumb eyebrow from the path.
  // Top-level routes get a title only; nested routes get their parent trail
  // ("2026 · Q3 · September"), and day routes get the real date spelled out.
  const segments = pathname.split('/').filter(Boolean)
  const [head, ...rest] = segments

  const sectionMap: Record<string, string> = {
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
  const prettify = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const title = sectionMap[head] || (head ? prettify(head) : 'Dashboard')

  let eyebrow: string | null = null
  if (head === 'day' && rest[0]) {
    const d = parseISO(rest[0])
    if (isValid(d)) eyebrow = format(d, 'EEEE · d MMM yyyy')
  } else if (rest.length > 0) {
    eyebrow = rest.map(prettify).join(' · ')
  }

  return (
    <header className="topbar-h relative shrink-0 overflow-hidden bg-ink hairline-bottom">
      {/* Sheen: a whisper of light across the top of the ribbon */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.035] to-transparent" />

      <div className="relative flex h-full w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: eyebrow breadcrumb + page title */}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 truncate font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">
              {eyebrow}
            </p>
          )}
          <h2 className="truncate font-display text-xl leading-tight text-parchment sm:text-[1.45rem]">
            {title}
          </h2>
        </div>

        {/* Right: year workspace picker + theme + user.
            The decorative compass is desktop-only — on mobile the bottom bar's
            active glyph already carries the brand mark, so the top row stays
            lean (that's the premium mobile-app pattern). */}
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <YearPickerChip />
          <div className="h-6 w-px bg-gold-dim/25" />
          <ThemeToggle />
          <div className="hidden sm:block h-6 w-px bg-gold-dim/25" />
          <Compass className="hidden sm:block h-6 w-6 text-gold-dim" strokeWidth={1.5} aria-hidden />
          <div className="h-6 w-px bg-gold-dim/25" />
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-9 h-9 ring-2 ring-gold-dim/30 ring-offset-2 ring-offset-ink',
              }
            }}
          />
        </div>
      </div>
    </header>
  )
}
