'use client'

import { useEffect } from 'react'

/**
 * Global pointer-FX engine (delegated - no per-card JS):
 * - cursor spotlight -> radial gold highlight that follows the pointer over
 *   EVERY card/box (.spotlight-card, .card, .glass-gold, .glass, [data-fx])
 * - .tilt-card       -> subtle 3D tilt toward the pointer
 * - scroll ripple    -> soft ripples fan out while the main content scrolls
 *   (mirrors the mobile touch-scroll trail from TouchFx)
 * Respects prefers-reduced-motion by doing nothing at all.
 */
export function ScrollFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let raf = 0

    // Anything visually box-like gets a cursor-following spotlight sheen.
    const CARD_SELECTOR = '.spotlight-card, .card, .glass-gold, .glass, [data-fx]'
    // Text blocks that brighten as the cursor passes over them. `.font-display`
    // covers display divs (like the big year hero) that aren't a heading tag.
    const TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd,.font-display,[data-touch-text]'
    let litText: HTMLElement | null = null

    const update = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const target = e.target as HTMLElement | null
        if (!target) return

        const spot = target.closest?.(CARD_SELECTOR) as HTMLElement | null
        if (spot) {
          // Anchor the spotlight pseudo-element without disturbing fixed /
          // absolute hosts (modals, toasts) — only static hosts are changed.
          if (getComputedStyle(spot).position === 'static') {
            spot.style.position = 'relative'
          }
          const r = spot.getBoundingClientRect()
          spot.style.setProperty('--mx', `${e.clientX - r.left}px`)
          spot.style.setProperty('--my', `${e.clientY - r.top}px`)
        }

        // Light follows the words: brighten the nearest text block.
        const text = target.closest?.(TEXT_SELECTOR) as HTMLElement | null
        if (text !== litText) {
          litText?.classList.remove('text-lit')
          litText = text && !text.closest('[data-noreveal]') ? text : null
          litText?.classList.add('text-lit')
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

    const clearLitText = () => {
      litText?.classList.remove('text-lit')
      litText = null
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

    // -- Desktop scroll-ripple trail ------------------------------------
    // A fixed layer that scatters soft ripples around the CURSOR while the user
    // scrolls with the wheel/touch, so the page visibly ripples on actual
    // scrolling. We intentionally listen to wheel/touch (user intent) instead
    // of the generic `scroll` event — that event also fires for programmatic
    // scrolls like the scroll-to-top on every route mount, which sprayed
    // random ripples across the screen at load (the "load up anomaly").
    const fxLayer = document.createElement('div')
    fxLayer.className = 'scrollfx-layer'
    fxLayer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(fxLayer)

    let lastRipple = 0
    let scrollRippleRaf = 0
    const spawnScrollRipple = (cx: number, cy: number) => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const count = vw < 768 ? 1 : 2
      for (let i = 0; i < count; i++) {
        const r = document.createElement('div')
        r.className = 'scroll-ripple'
        const jx = (Math.random() - 0.5) * 160
        const jy = (Math.random() - 0.5) * 120
        r.style.left = `${Math.min(vw - 12, Math.max(12, cx + jx))}px`
        r.style.top = `${Math.min(vh - 12, Math.max(12, cy + jy))}px`
        const size = 34 + Math.random() * 40
        r.style.width = `${size}px`
        r.style.height = `${size}px`
        fxLayer.appendChild(r)
        r.addEventListener('animationend', () => r.remove())
      }
    }
    const scheduleScrollRipple = (cx: number, cy: number) => {
      const now = Date.now()
      if (now - lastRipple < 180) return
      lastRipple = now
      if (scrollRippleRaf) return
      scrollRippleRaf = requestAnimationFrame(() => {
        scrollRippleRaf = 0
        spawnScrollRipple(cx, cy)
      })
    }
    const onWheel = (e: WheelEvent) => {
      scheduleScrollRipple(e.clientX, e.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) scheduleScrollRipple(t.clientX, t.clientY)
    }

    // User-initiated scrolling only: wheel (desktop) + touch drag (mobile).
    // TouchFx already draws its own ripple rings; this just adds a faint
    // page-level trail so scroll "reads" as movement on desktop too.
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    window.addEventListener('pointermove', update, { passive: true })
    window.addEventListener('pointerdown', update, { passive: true })
    document.addEventListener('pointerleave', resetTilt)
    document.addEventListener('pointerleave', clearLitText)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(parallaxRaf)
      cancelAnimationFrame(scrollRippleRaf)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('pointermove', update)
      window.removeEventListener('pointerdown', update)
      document.removeEventListener('pointerleave', resetTilt)
      document.removeEventListener('pointerleave', clearLitText)
      window.removeEventListener('scroll', onScroll)
      clearLitText()
      fxLayer.remove()
    }
  }, [])

  return null
}