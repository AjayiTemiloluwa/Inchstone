'use client'

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { WorkClock } from "@/components/ui/WorkClock";
import { YearPickerChip } from "@/components/ui/YearPicker";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { routeMeta } from "@/components/ds/nav";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";

export function Topbar() {
  const pathname = usePathname()

  const { title, group } = routeMeta(pathname)
  const { hidden, toggleHidden, drawerOpen, setDrawer } = useLayoutStore()
  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) toggleHidden()
    else setDrawer(!drawerOpen)
  }

  return (
    <header className="topbar-h bg-ink/90 backdrop-blur-xl border-b border-gold/10 flex shrink-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      {/* Left: where you are. Group as a mono eyebrow, page name beneath (v3). */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Desktop only: open or close the sidebar. */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={hidden ? 'Open sidebar' : 'Close sidebar'}
          aria-expanded={!hidden}
          title={hidden ? 'Open sidebar' : 'Close sidebar'}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/15 text-parchment/60 transition-colors hover:border-gold/40 hover:text-parchment md:flex"
        >
          {hidden ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.6} />}
        </button>
      <div className="flex min-w-0 flex-col justify-center">
        {group && <span className="hidden font-mono text-[9px] uppercase tracking-[0.26em] text-gold-dim sm:block">{group}</span>}
        <h2 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-parchment">{title}</h2>
      </div>
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
        {/* Clerk profile: the button is capped by a fixed 40px slot so the
            avatar can never paint taller than the bar (Clerk's remote UI
            defaults to a 36px box; the appearance class shrinks the ring so
            the whole control stays inside the 40px target). */}
        <span className="flex h-10 w-10 items-center justify-center">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'size-9 rounded-full ring-1 ring-gold-dim/40',
                userButtonTrigger: 'rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dim/60',
              },
            }}
          />
        </span>
      </div>
    </header>
  )
}
