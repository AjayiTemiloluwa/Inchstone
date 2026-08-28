'use client'

import { useEffect } from 'react'
import { resolveHintLabel, INTERACTIVE_SELECTOR } from '@/lib/hintLabel'

/**
 * TouchHint — the mobile equivalent of the desktop cursor hint.
 *
 * On touch devices there is no hover, so the "small card that pops up" (the
 * data-cursor / aria-label hint pill) is unreachable. This layer restores it:
 * press-and-hold any interactive element for ~380ms and the same label floats
 * up near your finger. Let go to act normally, or drag away to dismiss —
 * long-press never blocks the control's own tap.
 *
 * Coarse-pointer devices only; skipped for reduced motion.
 */

const HOLD_MS = 380
const MOVE_TOLERANCE = 14 // px — beyond this it's a scroll, not a hold

export function TouchHint() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: coarse)').matches) return

    const host = document.createElement('div')
    host.className = 'touch-hint'
    host.setAttribute('aria-hidden', 'true')
    document.body.appendChild(host)

    const pill = document.createElement('div')
    pill.className = 'touch-hint-pill'
    host.appendChild(pill)

    let holdTimer = 0
    let active = false
    let startX = 0
    let startY = 0
    let shown = false

    const hide = () => {
      shown = false
      pill.style.opacity = '0'
    }

    const showAt = (x: number, y: number) => {
      if (!pill.textContent) return
      pill.style.left = `${x}px`
      pill.style.top = `${y}px`
      pill.style.opacity = '1'
      shown = true
    }

    const beginHold = (target: Element | null, x: number, y: number) => {
      // Resolve the nearest interactive ancestor of the touched element.
      const hit = target?.closest?.(INTERACTIVE_SELECTOR) as HTMLElement | null
      const label = resolveHintLabel(hit)
      if (!label) return
      pill.textContent = label
      active = true
      holdTimer = window.setTimeout(() => {
        if (active) showAt(x, y + 12)
      }, HOLD_MS)
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      startX = e.clientX
      startY = e.clientY
      beginHold(e.target as Element | null, e.clientX, e.clientY)
    }

    const onMove = (e: PointerEvent) => {
      if (!active || shown) return
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) {
        // Started scrolling — cancel the pending hint.
        active = false
        window.clearTimeout(holdTimer)
        hide()
      }
    }

    const onEnd = () => {
      active = false
      window.clearTimeout(holdTimer)
      window.setTimeout(hide, 200)
    }

    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onEnd, { passive: true })
    window.addEventListener('pointercancel', onEnd, { passive: true })

    return () => {
      window.clearTimeout(holdTimer)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      host.remove()
    }
  }, [])

  return null
}
