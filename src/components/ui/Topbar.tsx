'use client'

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { WorkClock } from "@/components/ui/WorkClock";
import { YearPickerChip } from "@/components/ui/YearPicker";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { routeMeta } from "@/components/ds/nav";
import { useLayoutStore } from "@/stores/layoutStore";
import { openCommand } from "@/lib/uiEvents";

/**
 * Top bar (v4): one calm row that stays pinned while the page scrolls.
 *   left   sidebar toggle · "Group / Page" in the display face
 *   centre search-or-jump field (Ctrl K), desktop
 *   right  one control pill: year · live time · theme, then the avatar
 * No boxed buttons or stacked dividers: controls are borderless inside a
 * single hairline pill, so the bar reads as one instrument.
 */
export function Topbar() {
  const pathname = usePathname()
  const { title, group } = routeMeta(pathname)
  const { hidden, toggleHidden, drawerOpen, setDrawer } = useLayoutStore()
  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) toggleHidden()
    else setDrawer(!drawerOpen)
  }

  return (
    <header className="topbar-h sticky top-0 z-40 flex shrink-0 items-center gap-3 border-b border-gold/10 bg-ink/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-ink/65 sm:px-5 lg:px-6">
      {/* Left */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={hidden ? 'Open sidebar' : 'Toggle sidebar'}
          title="Toggle sidebar"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-parchment/55 transition-colors hover:bg-gold/[0.08] hover:text-parchment md:flex"
        >
          {hidden ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.6} />}
        </button>
        {/* Phones have no sidebar: the mark doubles as the home link. */}
        <Link href="/dashboard" aria-label="Inchstone home" className="flex shrink-0 md:hidden">
          <WorkClock size={26} progress={100} />
        </Link>
        <h2 className="flex min-w-0 items-baseline gap-2 leading-none">
          {group && <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.24em] text-parchment/40 sm:inline">{group} /</span>}
          <span className="truncate font-display text-[19px] font-bold tracking-[-0.01em] text-parchment sm:text-[21px]">{title}</span>
        </h2>
      </div>

      {/* Centre: search */}
      <button
        type="button"
        onClick={openCommand}
        className="hidden h-9 w-full max-w-[320px] items-center gap-2.5 rounded-full border border-gold/15 bg-surface-solid/60 px-3.5 text-sm text-parchment/45 transition-colors hover:border-gold/35 hover:text-parchment/75 lg:flex"
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="rounded-md border border-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-parchment/40">Ctrl K</kbd>
      </button>

      {/* Right */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <button type="button" onClick={openCommand} aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full text-parchment/55 hover:bg-gold/[0.08] hover:text-parchment lg:hidden">
          <Search className="h-[18px] w-[18px]" strokeWidth={1.7} />
        </button>
        <div className="flex items-center gap-0.5 rounded-full border border-gold/15 bg-surface-solid/60 p-0.5">
          <YearPickerChip />
          <span aria-hidden className="hidden h-5 w-px bg-gold/15 sm:block" />
          <span className="hidden items-center px-2 sm:inline-flex">
            <WorkClock size={20} progress={100} showTime />
          </span>
          <span aria-hidden className="h-5 w-px bg-gold/15" />
          <ThemeToggle />
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'size-8 rounded-full ring-2 ring-gold/25',
                userButtonTrigger: 'rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
              },
            }}
          />
        </span>
      </div>
    </header>
  )
}
