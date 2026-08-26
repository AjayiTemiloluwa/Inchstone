'use client'

import { useEffect } from 'react'

/**
 * Global pointer-FX engine (delegated — no per-card JS):
 * - .spotlight-card  → radial gold highlight following the pointer (--mx/--my)
 * - .tilt-card       → subtle 3D tilt toward the pointer
 * Respects prefers-reduced-motion by doing nothing at all.
 */
export function ScrollFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let raf = 0

    const update = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const target = e.target as HTMLElement | null
        if (!target) return

        const spot = target.closest?.('.spotlight-card') as HTMLElement | null
        if (spot) {
          const r = spot.getBoundingClientRect()
          spot.style.setProperty('--mx', `${e.clientX - r.left}px`)
          spot.style.setProperty('--my', `${e.clientY - r.top}px`)
        }

        const tiltEl = target.closest?.('.tilt-card') as HTMLElement | null
        if (tiltEl) {
          const r = tiltEl.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          tiltEl.style.transform = `perspective(800px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`
        }
      })
    }

    const resetTilt = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      const tiltEl = target?.closest?.('.tilt-card') as HTMLElement | null
      if (tiltEl) {
        tiltEl.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
        tiltEl.style.transform = 'perspective(800px)'
        window.setTimeout(() => { if (tiltEl) tiltEl.style.transition = '' }, 470)
      }
    }

    // Parallax elements
    let parallaxRaf = 0
    const parallaxEls = () => Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'))
    const onScroll = () => {
      if (parallaxRaf) return
      parallaxRaf = requestAnimationFrame(() => {
        parallaxRaf = 0
        const vh = window.innerHeight
        for (const el of parallaxEls()) {
          const rect = el.parentElement?.getBoundingClientRect() || el.getBoundingClientRect()
          if (rect.bottom < -160 || rect.top > vh + 160) continue
          const speed = parseFloat(el.dataset.parallax || '0.15')
          const progress = (rect.top + rect.height / 2 - vh / 2) / vh
          el.style.transform = `translate3d(0, ${(-progress * speed * 100).toFixed(1)}px, 0)`
        }
      })
    }

    window.addEventListener('pointermove', update, { passive: true })
    window.addEventListener('pointerdown', update, { passive: true })
    document.addEventListener('pointerleave', resetTilt)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(parallaxRaf)
      window.removeEventListener('pointermove', update)
      window.removeEventListener('pointerdown', update)
      document.removeEventListener('pointerleave', resetTilt)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return null
}