'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

/**
 * Shared row action menu (v2 C — replaces per-page "hover-reveal pencil/trash").
 *  - Pointer devices: actions hidden at rest, fade in on row hover (`row-group`).
 *  - Touch devices: a single always-visible ⋯ kebab (44×44) opens the same menu.
 *  - Swipe-to-delete is intentionally never used (conflicts with day/week swipe).
 */
export interface RowAction {
  label: string
  onSelect: () => void
  danger?: boolean
}

interface RowActionsProps {
  actions: RowAction[]
  ariaLabel?: string
}

export function RowActions({ actions, ariaLabel = 'Row actions' }: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="row-actions relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="flex h-11 w-11 items-center justify-center rounded-md text-gold-dim transition-colors hover:text-parchment focus-visible:outline-2 focus-visible:outline-gold"
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-gold-dim/25 bg-surface-solid p-1"
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                a.onSelect()
              }}
              className={[
                'flex w-full items-center rounded px-3 py-2 text-left text-sm transition-colors',
                a.danger
                  ? 'text-[#cf8f78] hover:bg-ember/20'
                  : 'text-parchment/80 hover:bg-mist hover:text-parchment',
              ].join(' ')}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
