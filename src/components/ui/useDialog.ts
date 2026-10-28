'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessibility behaviour shared by every modal / sheet:
 *  - Escape closes it
 *  - Tab / Shift+Tab stay inside it (focus trap)
 *  - focus moves in on open and returns to the opener on close
 *
 * Usage:
 *   const ref = useDialog<HTMLDivElement>(open, onClose)
 *   <div role="dialog" aria-modal="true" ref={ref} tabIndex={-1}> … </div>
 *
 * Attach `ref` to the dialog panel (not the backdrop). Pass `open = true`
 * always when the component is only mounted while open.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const panel = ref.current
    const opener = document.activeElement as HTMLElement | null

    // Move focus into the dialog unless something inside already has it
    // (e.g. an autoFocus input).
    if (panel && !panel.contains(document.activeElement)) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus({ preventScroll: true })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus?.({ preventScroll: true })
    }
  }, [open])

  return ref
}
