'use client'

import { useEffect } from 'react'
import { animate } from 'motion'

/**
 * FluidPress — the global "liquid plastic" press engine (motion.dev mini).
 *
 * Delegated, so every box in the app gets it without any per-component code:
 *  · pointer down  → the box squishes like soft plastic (stiff spring)
 *  · pointer up    → a jelly wobble brings it back past its natural shape
 *                    and settles it home — "fluid, then returns to shape"
 *  · internal link taps also sink the whole page slightly, so navigating
 *    reads as one fluid gesture into the next screen
 *
 * Works with mouse AND touch; disabled for prefers-reduced-motion.
 */

const PRESS_SELECTOR =
  'button, a, [role="button"], .card, .glass, .glass-gold, .spotlight-card, .task-block, [data-press]'
const SKIP_SELECTOR =
  'input, textarea, select, option, [contenteditable], [data-press-ignore], .no-press'

type Controls = ReturnType<typeof animate>

export function FluidPress() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let pressed: HTMLElement | null = null
    let active: Controls | null = null

    const find = (e: Event): HTMLElement | null => {
      const t = e.target as HTMLElement | null
      if (!t || typeof t.closest !== 'function') return null
      if (t.closest(SKIP_SELECTOR)) return null
      const el = t.closest(PRESS_SELECTOR) as HTMLElement | null
      if (!el) return null
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return null
      return el
    }

    const stopActive = () => {
      active?.stop()
      active = null
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      const el = find(e)
      if (!el) return
      pressed = el
      stopActive()
      // Squish — quick, weighty, like pressing soft plastic.
      active = animate(el, { scale: 0.955 }, { type: 'spring', stiffness: 1100, damping: 42 })
    }

    const release = () => {
      const el = pressed
      pressed = null
      if (!el) return
      stopActive()
      // Jelly return: overshoot past natural shape, then settle home.
      active = animate(
        el,
        { scale: [0.955, 1.045, 0.99, 1] },
        { duration: 0.55, times: [0, 0.38, 0.72, 1], ease: ['easeOut', 'easeInOut', 'easeOut'] }
      )
    }

    // Sinking the current page as a nav gesture begins — the incoming page
    // springs back in (see PageTransition), so the whole hop feels fluid.
    const onNavClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const a = t?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || href.startsWith('//')) return
      const page = document.querySelector<HTMLElement>('[data-page-content]')
      if (!page || page.dataset.leaving === '1') return
      page.dataset.leaving = '1'
      animate(page, { opacity: 0.55, scale: 0.98, y: 8 }, { type: 'spring', stiffness: 700, damping: 60 })
    }

    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', release, { passive: true })
    window.addEventListener('pointercancel', release, { passive: true })
    window.addEventListener('blur', release)
    document.addEventListener('click', onNavClick, true)

    return () => {
      stopActive()
      pressed = null
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
      document.removeEventListener('click', onNavClick)
    }
  }, [])

  return null
}