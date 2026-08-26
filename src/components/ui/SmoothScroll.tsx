'use client'

import { useEffect } from 'react'

/**
 * Lenis-powered smooth scrolling for pointer devices, tuned for a
 * more distinctive "drifting game" feel:
 *  · a long fluid glide (1.5s) with an airy easeOut
 *  · the content reacts subtly to scroll velocity (a soft pull/scale)
 *    the faster you scrob, the more it eases into the next section —
 *    the signature "alive while you scroll" feel.
 * Skipped for touch (native feel preserved) and reduced-motion users.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let lenis: any | null = null
    let raf = 0
    let cancelled = false
    let mainEl: HTMLElement | null = null
    let current = 0
    let target = 0

    import('lenis')
      .then(({ default: Lenis }) => {
        if (cancelled) return
        lenis = new Lenis({
          duration: 1.35,
          // ease-out-expo style: fast start, long luxurious settle
          easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          syncTouch: false,
        })
        document.documentElement.classList.add('lenis', 'lenis-smooth')

        mainEl = document.querySelector('main')

        // React to scroll velocity — gentle scaling/pull on the content.
        const velocityLoop = (time: number) => {
          const v = Math.abs(lenis?.velocity || 0)
          target = v > 4 ? Math.min(1 + v / 9000, 1.02) : current - (current - 1) * 0.08
          current += (target - current) * 0.12
          if (mainEl && Math.abs(current - 1) > 0.0015) {
            mainEl.style.transform = `scale(${current.toFixed(4)})`
            mainEl.style.filter = `blur(${(current - 1) * 26}px)`
          } else if (mainEl) {
            mainEl.style.transform = ''
            mainEl.style.filter = ''
          }
          return current
        }

        const loop = (time: number) => {
          lenis?.raf(time)
          velocityLoop(time)
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      lenis?.destroy()
      document.documentElement.classList.remove('lenis', 'lenis-smooth')
      const m = document.querySelector('main')
      if (m) {
        ;(m as HTMLElement).style.transform = ''
        ;(m as HTMLElement).style.filter = ''
      }
    }
  }, [])

  return null
}