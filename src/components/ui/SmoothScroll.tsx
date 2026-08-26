'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Lenis-powered smooth scrolling for pointer devices.
 *
 * CRITICAL: this app scrolls inside <main> (the shell is h-screen
 * overflow-hidden), NOT the window. Lenis must be attached to that exact
 * container — attaching it to the window swallows two-finger/wheel events
 * and scrolls nothing (the "only the arrow button scrolls" bug).
 *
 * Inner scrollers (panels, modals, timelines, chat) opt out natively via
 * the data-lenis-prevent attribute. Touch stays native (syncTouch: false),
 * so phones keep their usual momentum feel.
 */
export function SmoothScroll() {
  const pathname = usePathname()

  // The <main> container persists across client-side navigations, so every
  // route change — including Back/Forward without a reload — starts at top.
  useEffect(() => {
    document.querySelector<HTMLElement>('main')?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let lenis: any | null = null
    let raf = 0
    let cancelled = false

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

        const loop = (time: number) => {
          lenis?.raf(time)
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
    }
  }, [])

  return null
}