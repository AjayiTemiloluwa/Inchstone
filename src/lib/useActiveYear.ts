'use client'

import { useEffect, useMemo } from 'react'
import type { Item } from '@/stores/hierarchyStore'
import { useYearStore } from '@/lib/yearStore'

/**
 * Year helpers + a tiny hook for multi-year workspaces.
 * The app lets you keep several year tracks side by side (2026, 2027 …) and
 * switch between them. The active choice lives in the shared yearStore
 * (persisted to localStorage as "inchstone-year") so the Topbar picker and
 * every mounted page stay in sync instantly.
 */

/** Extract the calendar year a layer-0 (or any dated) item belongs to. */
export function yearOf(item: Item | null | undefined): number {
  if (!item) return new Date().getFullYear()
  if (item.startDate) {
    const y = new Date(item.startDate).getFullYear()
    if (!Number.isNaN(y) && y > 1000 && y < 2100) return y
  }
  const m = (item.title || '').match(/\b(1[89]\d{2}|20\d{2})\b/)
  if (m) return Number(m[1])
  return new Date().getFullYear()
}

/** All id's of `item` plus every descendant — used to scope a page to a year. */
export function buildSubtree(item: Item | null | undefined): Set<string> {
  const set = new Set<string>()
  const walk = (n?: Item | null) => {
    if (!n) return
    set.add(n.id)
    ;(n.children || []).forEach(walk)
  }
  walk(item)
  return set
}

/** How many nodes live in `item`'s subtree (including itself). */
export function subtreeSize(item: Item | null | undefined): number {
  if (!item) return 0
  let n = 1
  ;(item.children || []).forEach(c => { n += subtreeSize(c) })
  return n
}

/**
 * When several layer-0 items resolve to the same calendar year (e.g. an old
 * "2026 Identity" workspace plus a bare scaffold), the one with the most
 * content is the real workspace — pick it and collapse the rest.
 */
export function pickYearItem(candidates: Item[]): Item | null {
  if (candidates.length === 0) return null
  return candidates.reduce((best, c) => (subtreeSize(c) > subtreeSize(best) ? c : best))
}

/**
 * Resolves the "active" year from the store's layer-0 items.
 * Options:
 *  - the global year store (synced with localStorage, shared with the Topbar
 *    picker) wins if that year still exists;
 *  - otherwise the first/oldest year;
 *  - otherwise the current calendar year (returns null item when nothing is set).
 */
export function useActiveYear(items: Item[]) {
  const allYears = useMemo(() => items.filter(i => i.layer === 0), [items])
  const year = useYearStore(s => s.year)
  const hydrate = useYearStore(s => s.hydrate)
  const setStoredYear = useYearStore(s => s.setYear)

  // Client-only read of the persisted choice — shared across the whole app.
  useEffect(() => {
    hydrate()
  }, [hydrate])

  const fallback = allYears.length ? yearOf(allYears[0]) : new Date().getFullYear()
  const activeNum = year ?? fallback
  // Among duplicates of the same year, the subtree with the most content wins.
  const yearItem = useMemo(() => {
    const matches = allYears.filter(i => yearOf(i) === activeNum)
    return pickYearItem(matches) || pickYearItem(allYears)
  }, [allYears, activeNum])

  const setYear = (year: number) => {
    setStoredYear(year)
  }

  const subtreeIds = useMemo(() => buildSubtree(yearItem), [yearItem])

  return { activeYear: yearItem ? yearOf(yearItem) : activeNum, yearItem, allYears, setYear, subtreeIds }
}