'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Item } from '@/stores/hierarchyStore'

/**
 * Year helpers + a tiny hook for multi-year workspaces.
 * The app now lets you keep several year tracks side by side (2026, 2027 …)
 * and switch between them. Your current choice is remembered in localStorage
 * so every year-nested page resolves to the right workspace.
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

const STORAGE_KEY = 'inchstone-year'

/**
 * Resolves the "active" year from the store's layer-0 items.
 * Options:
 *  - saved choice (localStorage) wins if that year still exists;
 *  - otherwise the first/oldest year;
 *  - otherwise the current calendar year (returns null item when nothing is set).
 */
export function useActiveYear(items: Item[]) {
  const allYears = useMemo(() => items.filter(i => i.layer === 0), [items])
  const [stored, setStored] = useState<string | null>(null)

  useEffect(() => {
    // Adopt the persisted year only once on mount (client-only read).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setStored(localStorage.getItem(STORAGE_KEY)) } catch { /* ignore */ }
  }, [])

  const fallback = allYears.length ? yearOf(allYears[0]) : new Date().getFullYear()
  const activeNum = stored ? Number(stored) : fallback
  const yearItem = allYears.find(i => yearOf(i) === activeNum) || allYears[0] || null

  const setYear = (year: number) => {
    try { localStorage.setItem(STORAGE_KEY, String(year)) } catch { /* ignore */ }
    setStored(String(year))
  }

  const subtreeIds = useMemo(() => buildSubtree(yearItem), [yearItem])

  return { activeYear: yearItem ? yearOf(yearItem) : activeNum, yearItem, allYears, setYear, subtreeIds }
}