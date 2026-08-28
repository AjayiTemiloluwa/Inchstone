'use client'

import { create } from 'zustand'

/**
 * yearStore — the single source of truth for the ACTIVE year workspace.
 *
 * Why a store: `useActiveYear` used to keep the chosen year in per-component
 * state, so switching years from the Topbar wouldn't re-scope already-mounted
 * pages. Now every consumer (year hub, quarters, months, weeks, picker)
 * subscribes to the same value and re-filters instantly.
 *
 * The choice persists in localStorage ("inchstone-year") exactly as before.
 */

const STORAGE_KEY = 'inchstone-year'

function readStoredYear(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const n = raw ? Number(raw) : NaN
    if (Number.isInteger(n) && n > 1900 && n < 2200) return n
  } catch { /* ignore */ }
  return new Date().getFullYear()
}

type YearState = {
  /** Active year number; null until hydrated on the client. */
  year: number | null
  hydrate: () => void
  setYear: (year: number) => void
}

export const useYearStore = create<YearState>((set) => ({
  year: null,
  hydrate: () =>
    set(state => (state.year === null ? { year: readStoredYear() } : state)),
  setYear: (year) => {
    try { localStorage.setItem(STORAGE_KEY, String(year)) } catch { /* ignore */ }
    set({ year })
  },
}))