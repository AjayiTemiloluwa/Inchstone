'use client'

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Search, Sparkles } from "lucide-react";
import { WorkClock } from "@/components/ui/WorkClock";
import { YearPickerChip } from "@/components/ui/YearPicker";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { routeMeta } from "@/components/ds/nav";
import { useLayoutStore } from "@/stores/layoutStore";
import { openAssistant, openCommand } from "@/lib/uiEvents";

/**
 * Top bar (v5): a quiet, solid 56px row pinned while the page scrolls.
 *   left   sidebar toggle · breadcrumb "Group › Page" in the UI face
 *          (the page itself carries the big display title, so the bar does not repeat it)
 *   centre search-or-jump field (Ctrl K) on desktop
 *   right  Ask AI · year · theme | avatar — every control the same 32px, square-rounded, ghost
 */
const iconBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-parchment/60 transition-colors hover:bg-parchment/[0.06] hover:text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40'

export function Topbar() {
  const pathname = usePathname()
  const { title, group } = routeMeta(pathname)
  const { hidden, toggleHidden, drawerOpen, setDrawer } = useLayoutStore()
  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) toggleHidden()
    else setDrawer(!drawerOpen)
  }

  return (
    <header className="topbar-h sticky top-0 z-40 flex shrink-0 items-center gap-3 border-b border-parchment/[0.07] bg-ink px-3 pt-[env(safe-area-inset-top,0px)] sm:px-4 lg:px-5">
      {/* Left: toggle + breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button type="button" onClick={toggleSidebar} aria-label={hidden ? 'Open sidebar' : 'Toggle sidebar'} title="Toggle sidebar" className={`${iconBtn} hidden md:flex`}>
          {hidden ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.6} />}
        </button>
        {/* Phones have no sidebar: the mark doubles as the home link. */}
        <Link href="/dashboard" aria-label="Inchstone home" className="flex shrink-0 md:hidden">
          <WorkClock size={24} progress={100} />
        </Link>
        <span aria-hidden className="mx-1 hidden h-4 w-px bg-parchment/10 md:block" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px] leading-none">
          {group && (
            <>
              <span className="hidden shrink-0 text-parchment/45 sm:inline">{group}</span>
              <ChevronRight aria-hidden className="hidden h-3.5 w-3.5 shrink-0 text-parchment/25 sm:block" />
            </>
          )}
          <span aria-current="page" className="truncate text-[14px] font-semibold text-parchment">{title}</span>
        </nav>
      </div>

      {/* Centre: search */}
      <button
        type="button"
        onClick={openCommand}
        className="hidden h-8 w-full max-w-[340px] items-center gap-2 rounded-lg border border-parchment/10 bg-parchment/[0.03] px-2.5 text-[13px] text-parchment/45 transition-colors hover:border-parchment/20 hover:text-parchment/70 lg:flex"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="rounded border border-parchment/10 px-1.5 py-px font-sans text-[10px] font-medium text-parchment/40">Ctrl K</kbd>
      </button>

      {/* Right */}
      <div className="flex flex-1 items-center justify-end gap-1">
        <button type="button" onClick={openCommand} aria-label="Search" className={`${iconBtn} lg:hidden`}>
          <Search className="h-[18px] w-[18px]" strokeWidth={1.7} />
        </button>
        <button type="button" onClick={openAssistant} aria-label="Ask AI"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-parchment/70 transition-colors hover:bg-parchment/[0.06] hover:text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:px-2.5">
          <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.8} aria-hidden />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
        <YearPickerChip />
        <ThemeToggle />
        <span aria-hidden className="mx-1.5 h-5 w-px bg-parchment/10" />
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'size-7 rounded-full',
                userButtonTrigger: 'rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
              },
            }}
          />
        </span>
      </div>
    </header>
  )
}
