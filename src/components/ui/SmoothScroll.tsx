'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import type Lenis from 'lenis'

/**
 * Lenis-powered smooth scrolling for pointer devices — plus the
 * dionpieters-style "page dip": while you scroll, the content tips like a
 * section of a cylinder (perspective + rotateX driven by scroll velocity)
 * and eases flat the moment you stop. Applied to the shared
 * [data-scroll-content] wrapper, so every page in the app gets it.
 *
 * CRITICAL: this app scrolls inside <main> (the shell is h-screen
 * overflow-hidden), NOT the window. Lenis must be attached to that exact
 * container — attaching it to the window swallows two-finger/wheel events
 * and scrolls nothing (the "only the arrow button scrolls" bug).
 *
 * Inner scrollers (panels, modals, timelines, chat) opt out natively via
 * the data-lenis-prevent attribute. Touch stays native (syncTouch: false),
 * so phones keep their usual momentum feel — there, a gentler dip is driven
 * by raw scroll deltas instead of Lenis.
 */

/* ── The dip tuning ──────────────────────────────────────────────────── */
const BEND_MAX_DEG = 7 // hardest the page ever tips
const BEND_GAIN = 0.32 // deg per unit of Lenis velocity
const BEND_EASE = 0.14 // how quickly the tilt follows its target (lerp)
const BEND_SETTLE = 0.02 // deg — below this the page counts as flat
const BEND_SCALE = 0.015 // extra depth: shrinks up to 1.5% at full tilt
const TOUCH_BEND_MAX_DEG = 4

function applyBend(content: HTMLElement | null, bend: number, maxDeg: number) {
  if (!content) return
  if (Math.abs(bend) < BEND_SETTLE) {
    // Flat again: drop the transform entirely so the browser can drop the
    // GPU layer (bending is the exception, flat is the resting state).
    if (content.style.transform) {
      content.style.transform = ''
      content.style.willChange = ''
    }
    return
  }
    const depth = Math.min(Math.abs(bend) / maxDeg, 1)
  const scale = 1 - depth * BEND_SCALE
  content.style.willChange = 'transform'
  // Always concave (page dips INTO the screen): the sign of scroll velocity
  // only modulates the MAGNITUDE of the dip, never flips it to a convex
  // bulge. rotateX must stay positive so the top edge tilts away from you
  // on both up- and down-scroll.
  content.style.transform = `perspective(1600px) rotateX(${Math.abs(bend).toFixed(3)}deg) scale(${scale.toFixed(4)})`
}

export function SmoothScroll() {
  const pathname = usePathname()

  // The <main> container persists across client-side navigations, so every
  // route change — including Back/Forward without a reload — starts at top.
  useEffect(() => {
    document.querySelector<HTMLElement>('main')?.scrollTo(0, 0)
    // New page rises flat — clear any leftover dip from the old one.
    const content = document.querySelector<HTMLElement>('[data-scroll-content]')
    if (content) {
      content.style.transform = ''
      content.style.willChange = ''
    }
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let lenis: Lenis | null = null
    let raf = 0
    let cancelled = false
    let bend = 0

    import('lenis')
      .then(({ default: Lenis }) => {
        if (cancelled) return
        const wrapper = document.querySelector<HTMLElement>('main')
        if (!wrapper) return
        const content =
          wrapper.querySelector<HTMLElement>('[data-scroll-content]') ??
          (wrapper.firstElementChild as HTMLElement | null) ??
          wrapper

        lenis = new Lenis({
          wrapper,
          content,
          duration: 1.15,
          // ease-out-expo: quick pickup, long luxurious settle
          easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          syncTouch: false,
          touchMultiplier: 1.6,
        })
        document.documentElement.classList.add('lenis', 'lenis-smooth')
        content.style.transformOrigin = '50% 50%'

        const loop = (time: number) => {
          lenis?.raf(time)

          // The dip: tilt follows scroll velocity, eases flat when it stops.
          const bendContent = wrapper.querySelector<HTMLElement>('[data-scroll-content]')
          if (bendContent) {
            const v = typeof lenis?.velocity === 'number' ? lenis.velocity : 0
            const target = Math.max(-BEND_MAX_DEG, Math.min(BEND_MAX_DEG, v * BEND_GAIN))
            bend += (target - bend) * BEND_EASE
            applyBend(bendContent, bend, BEND_MAX_DEG)
          }

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
      const content = document.querySelector<HTMLElement>('[data-scroll-content]')
      if (content) {
        content.style.transform = ''
        content.style.willChange = ''
      }
    }
  }, [])

  // ── Touch: native scroll drives a gentler dip (Lenis isn't running) ─────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Only where Lenis isn't running (coarse pointers / no hover).
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const wrapper = document.querySelector<HTMLElement>('main')
    if (!wrapper) return

    let raf = 0
    let running = false
    let lastTop = wrapper.scrollTop
    let lastTime = performance.now()
    let velocity = 0 // smoothed, frame-equivalent px
    let bend = 0

    // For the touch dip we transform the content wrapper too (not `main`).
    // Note: a solid pill (the hint) sits in body and must not be clipped.
    const tick = () => {
      const content = wrapper.querySelector<HTMLElement>('[data-scroll-content]')
      if (!content) {
        running = false
        return
      }
      if (content.style.transformOrigin !== '50% 0%') {
        content.style.transformOrigin = '50% 0%'
      }
      velocity *= 0.9 // momentum decay between scroll events
      const target = Math.max(-TOUCH_BEND_MAX_DEG, Math.min(TOUCH_BEND_MAX_DEG, velocity * BEND_GAIN))
      bend += (target - bend) * BEND_EASE

      if (Math.abs(bend) < BEND_SETTLE && Math.abs(velocity) < 0.05) {
        applyBend(content, 0, TOUCH_BEND_MAX_DEG)
        bend = 0
        running = false
        return
      }
      applyBend(content, bend, TOUCH_BEND_MAX_DEG)
      raf = requestAnimationFrame(tick)
    }

    const wake = () => {
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    const onScroll = () => {
      const now = performance.now()
      const dt = Math.max(16, now - lastTime)
      const delta = wrapper.scrollTop - lastTop
      lastTop = wrapper.scrollTop
      lastTime = now
      velocity = velocity * 0.75 + (delta / dt) * 16 * 0.25
      wake()
    }

    wrapper.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      wrapper.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
      const content = wrapper.querySelector<HTMLElement>('[data-scroll-content]')
      if (content) {
        content.style.transform = ''
        content.style.willChange = ''
      }
    }
  }, [])

  return null
}