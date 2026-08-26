'use client'

import { useEffect } from 'react'
import { useAmbient } from './atmosphere'

/* ────────────────────────────────────────────────────────────────
   ScrollText — global scroll-triggered text reveal ("load-up" text).
   Watches the <main> content and, the moment headings/paragraphs are
   scrolled to, reveals them with a small rise + de-blur pop that is
   tuned by the current atmosphere (morning = quick & crisp, night =
   slow & dreamy, rain = soft, etc.). Recomposes safely on every React
   re-render and respects prefers-reduced-motion (content stays visible).
   ──────────────────────────────────────────────────────────────── */

const SELECTOR = 'h1, h2, h3, h4, p'

export function ScrollText() {
  const amb = useAmbient()

  useEffect(() => {
    // Nothing to hide for reduced-motion users — keep everything visible.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Expose the atmosphere's "feel" to CSS for reaction variety.
    const root = document.documentElement
    root.style.setProperty('--reveal-y', `${amb.motion.revealY}px`)
    root.style.setProperty('--reveal-dur', `${amb.motion.revealDuration}s`)
    root.style.setProperty('--reveal-blur', `${amb.motion.blur}px`)

    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              const el = e.target as HTMLElement
              el.classList.add('scroll-in')
              io?.unobserve(el)
            }
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
      )
    }

    const mark = () => {
      const main = document.querySelector('main')
      if (!main) return
      main.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        // Skip interactive/defined-elsewhere content and already-visible text.
        if (el.closest('[data-noreveal]')) return
        if (el.dataset.revealed !== undefined) return
        if (!el.textContent || !el.textContent.trim()) return
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return
        el.dataset.revealed = '1'
        el.classList.add('scroll-text')
        if (!io) {
          el.classList.add('scroll-in')
        } else {
          io.observe(el)
        }
      })
    }

    mark()
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(mark) : null
    mo?.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo?.disconnect()
      io?.disconnect()
      root.style.removeProperty('--reveal-y')
      root.style.removeProperty('--reveal-dur')
      root.style.removeProperty('--reveal-blur')
    }
  }, [amb.motion.revealY, amb.motion.revealDuration, amb.motion.blur])

  return null
}