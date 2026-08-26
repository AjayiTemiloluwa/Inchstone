'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAmbient } from './atmosphere'

/* ────────────────────────────────────────────────────────────────
   ScrollText — global scroll-triggered text reveal ("load-up" text).

   · Applies to every important static text node: headings, paragraphs,
     list items, blockquotes, captions, and anything tagged
     [data-reveal-text].
   · REPLAYS on every visit: the whole cycle resets on each route change
     (including Back/Forward inside the SPA — no reload required), so text
     loads up again every time you return to a page.
   · Tuned by the atmosphere (morning = quick & crisp, night = slow &
     dreamy) and respects prefers-reduced-motion (text simply stays put).
   ──────────────────────────────────────────────────────────────── */

const SELECTOR =
  'h1, h2, h3, h4, h5, p, li, blockquote, figcaption, [data-reveal-text]'

export function ScrollText() {
  const amb = useAmbient()
  const pathname = usePathname()

  // Atmosphere → CSS variables only; never resets the reveal cycle.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--reveal-y', `${amb.motion.revealY}px`)
    root.style.setProperty('--reveal-dur', `${amb.motion.revealDuration}s`)
    root.style.setProperty('--reveal-blur', `${amb.motion.blur}px`)
    return () => {
      root.style.removeProperty('--reveal-y')
      root.style.removeProperty('--reveal-dur')
      root.style.removeProperty('--reveal-blur')
    }
  }, [amb.motion.revealY, amb.motion.revealDuration, amb.motion.blur])

  // One full reveal cycle per visit.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
      )
    }

    // Wipe the previous visit's state so everything plays again.
    document.querySelectorAll<HTMLElement>('.scroll-text').forEach((el) => {
      el.classList.remove('scroll-in')
      delete el.dataset.revealed
    })

    const mark = () => {
      const main = document.querySelector('main')
      if (!main) return
      main.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (el.closest('[data-noreveal]')) return
        if (el.closest('[aria-hidden="true"]')) return
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
    const mo =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(mark) : null
    mo?.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo?.disconnect()
      io?.disconnect()
    }
  }, [pathname])

  return null
}