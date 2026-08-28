'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { useYearStore } from '@/lib/yearStore'
import { yearOf } from '@/lib/useActiveYear'

/**
 * YearPicker — the global year workspace switcher.
 *
 * A small chip showing ONLY the active year; tapping it springs open an
 * animated dropdown listing every year workspace (with its optional name)
 * plus a one-tap "Open <next year>" action that scaffolds the new year via
 * POST /api/years. Selecting a year writes to the shared yearStore, so every
 * mounted page (categories, goals, quarters…) re-scopes instantly — no
 * navigation needed, no other year's data ever shown.
 */

/* Flatten the API's flat item list into the nested tree the store expects. */
function toTree(dataItems: any[]): Item[] {
  const itemMap = new Map<string, Item>()
  dataItems.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
  const tree: Item[] = []
  dataItems.forEach((item: any) => {
    const node = itemMap.get(item.id)
    if (!node) return
    if (item.parentId) {
      const parent = itemMap.get(item.parentId)
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(node)
      }
    } else {
      tree.push(node)
    }
  })
  return tree
}

/** Years list + hydrate-on-demand + scaffold-and-switch helper. */
export function useYearOptions() {
  const items = useHierarchyStore(s => s.items)
  const setItems = useHierarchyStore(s => s.setItems)
  const [creating, setCreating] = useState(false)

  // Pages like Settings never load items — hydrate the store so the picker
  // works from anywhere. Cheap no-op once any page has loaded items.
  useEffect(() => {
    if (items.length > 0) return
    let cancelled = false
    fetch('/api/items')
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.items) return
        setItems(toTree(data.items))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [items.length, setItems])

  const options = useMemo(
    () =>
      items
        .filter(i => i.layer === 0)
        .map(y => ({ id: y.id, year: yearOf(y), theme: y.theme || null }))
        .filter(o => o.year > 1900 && o.year < 2200)
        .sort((a, b) => b.year - a.year),
    [items]
  )

  const nextYear = (options[0]?.year ?? new Date().getFullYear()) + 1

  const createYear = async (): Promise<number | null> => {
    setCreating(true)
    try {
      const res = await fetch('/api/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: nextYear }),
      })
      if (!res.ok) return null
      // Pull the fresh workspace (year + category skeleton) into the store…
      const data = await fetch('/api/items').then(r => r.json()).catch(() => null)
      if (data?.items) setItems(toTree(data.items))
      // …and switch to it.
      useYearStore.getState().setYear(nextYear)
      return nextYear
    } catch {
      return null
    } finally {
      setCreating(false)
    }
  }

  return { options, nextYear, createYear, creating }
}

/* ── Menu contents shared by the inline + floating dropdowns ────────────── */

function YearMenuContents({ onClose }: { onClose: () => void }) {
  const { options, nextYear, createYear, creating } = useYearOptions()
  const activeYear = useYearStore(s => s.year)
  const setYear = useYearStore(s => s.setYear)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    const y = await createYear()
    if (y === null) {
      setError(`Could not open ${nextYear}.`)
      return
    }
    onClose()
  }

  return (
    <>
      <p className="px-4 pb-1 pt-3 font-mono text-[9px] uppercase tracking-[0.28em] text-parchment/35">
        Your year workspaces
      </p>

      {options.length === 0 && (
        <p className="px-4 py-3 text-sm text-parchment/45">No years yet — open your first one below.</p>
      )}

      <div className="max-h-[min(300px,40vh)] overflow-y-auto" data-lenis-prevent>
        {options.map(o => {
          const active = o.year === activeYear
          return (
            <button
              key={o.id}
              role="menuitem"
              onClick={() => { setYear(o.year); onClose() }}
              className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors ${
                active ? 'bg-gold/[0.08]' : 'hover:bg-white/[0.05]'
              }`}
            >
              <span
                className={`font-display text-lg font-bold tabular-nums leading-none ${
                  active ? 'text-gold' : 'text-parchment/80'
                }`}
              >
                {o.year}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {o.theme && (
                  <span className="max-w-[96px] truncate font-mono text-[10px] uppercase tracking-wider text-parchment/35">
                    {o.theme}
                  </span>
                )}
                {active && <Check className="h-4 w-4 shrink-0 text-gold" />}
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="border-t border-white/[0.06] px-4 py-2 text-xs text-ember">{error}</p>}

      <button
        role="menuitem"
        onClick={handleCreate}
        disabled={creating}
        className="flex min-h-[46px] w-full items-center gap-2 border-t border-white/[0.07] px-4 py-2.5 text-left text-sm font-semibold text-gold transition-colors hover:bg-gold/[0.08] disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {creating ? 'Scaffolding…' : `Open ${nextYear}`}
      </button>
    </>
  )
}

/* ── The animated dropdown menu (used inside the Topbar chip) ───────────── */

export function YearDropdown({ onClose, align = 'right' }: { onClose: () => void; align?: 'right' | 'center' }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      role="menu"
      aria-label="Switch year workspace"
      initial={{ opacity: 0, y: -8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }}
      style={{ transformOrigin: align === 'center' ? 'top center' : 'top right' }}
      className={`absolute top-full z-[80] mt-2 w-60 overflow-hidden rounded-xl border border-gold/25 bg-[#14110e]/95 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
        align === 'center' ? 'left-1/2 -ml-[120px]' : 'right-0'
      }`}
    >
      <YearMenuContents onClose={onClose} />
    </motion.div>
  )
}

/* ── Floating (portal) variant — escapes overflow-hidden parents ────────── */

export function YearDropdownFloating({
  anchor,
  onClose,
}: {
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Track the anchor so the menu follows the year number on scroll/resize.
  useEffect(() => {
    const update = () => {
      const el = anchor.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({ left: r.left + r.width / 2, top: r.bottom + 10 })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div aria-hidden className="fixed inset-0 z-[85]" onPointerDown={onClose} />
      {pos && (
        <motion.div
          role="menu"
          aria-label="Switch year workspace"
          initial={{ opacity: 0, y: -10, scale: 0.92, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: -8, scale: 0.95, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }}
          style={{ left: pos.left, top: pos.top, transformOrigin: 'top center' }}
          className="fixed z-[86] w-60 overflow-hidden rounded-xl border border-gold/25 bg-[#14110e]/95 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <YearMenuContents onClose={onClose} />
        </motion.div>
      )}
    </>,
    document.body
  )
}

/* ── The Topbar chip: shows only the active year ────────────────────────── */

export function YearPickerChip() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const storedYear = useYearStore(s => s.year)
  const hydrate = useYearStore(s => s.hydrate)
  const activeYear = storedYear ?? new Date().getFullYear()

  useEffect(() => { hydrate() }, [hydrate])

  // Close on any outside tap / click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-cursor="Switch year"
        className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-gold-dim/30 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-parchment/85 transition-colors hover:border-gold/50 hover:text-gold"
      >
        <span className="tabular-nums leading-none">{activeYear}</span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="inline-flex"
        >
          <ChevronDown className="h-3.5 w-3.5 text-gold-dim" />
        </motion.span>
      </button>

      <AnimatePresence>{open && <YearDropdown onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  )
}