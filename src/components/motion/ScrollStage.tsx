'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { prefersReducedMotion, scroller } from '@/lib/gsap'
import { showFor } from '@/lib/motion/choreo'

/**
 * ScrollStage — cards keep moving while you scroll, and the way they move keeps changing.
 *
 * Every card on screen rides one of six scroll motions, driven by where it sits in the viewport:
 *
 *   depth    parallax: cards float at three different depths
 *   lens     the card at the centre of the screen is full size, cards at the edges shrink back
 *   wave     cards sway side to side along a sine wave as they pass
 *   swing    cards tip like pendulums, neighbours in opposite directions
 *   zipper   alternate cards slide in from left and right and meet in the middle
 *   orbit    cards circle gently around their place
 *
 * A card takes the NEXT motion every time it comes back into view, starting from a different motion
 * each visit, so neighbours differ and nothing scrolls the same way twice. Motion springs toward its
 * target (smoothed per frame), so fast flicks feel elastic.
 *
 * It writes only the CSS individual transform properties (translate / rotate / scale), which
 * compose with — never fight — the GSAP `transform` used by entrances, tilt and press effects.
 * Off when prefers-reduced-motion is set.
 */

const CARDS = '.card, .glass, .glass-gold, [data-fx]'
const MODES = ['depth', 'lens', 'wave', 'swing', 'zipper', 'orbit'] as const
type Mode = (typeof MODES)[number]

interface Rider { el: HTMLElement; i: number; mode: Mode; on: boolean; tx: number; ty: number; rot: number; sc: number }

const target = (r: Rider, d: number): [number, number, number, number] => {
  // d: where the card's centre sits, -1 (top edge) … 0 (middle) … 1 (bottom edge)
  const alt = r.i % 2 ? 1 : -1
  switch (r.mode) {
    case 'depth': return [0, -d * [18, 36, 56][r.i % 3], 0, 1]
    case 'lens': return [0, 0, 0, 1 - Math.min(1, Math.abs(d)) * 0.08]
    case 'wave': return [Math.sin(d * Math.PI + r.i * 0.9) * 22, 0, 0, 1]
    case 'swing': return [0, 0, d * 3.2 * alt, 1]
    case 'zipper': return [d * 46 * alt, 0, 0, 1]
    case 'orbit': return [Math.cos(d * Math.PI * 1.6 + r.i) * 14, Math.sin(d * Math.PI * 1.6 + r.i) * 14, 0, 1]
  }
}

export function ScrollStage() {
  const pathname = usePathname()

  useEffect(() => {
    if (prefersReducedMotion()) return
    const main = scroller()
    if (!main) return
    const show = showFor(pathname)
    let next = show.visit // the first motion rotates visit by visit
    const riders = new Map<HTMLElement, Rider>()
    let raf = 0
    let idle = 0

    const clear = (r: Rider) => {
      r.el.style.translate = ''
      r.el.style.rotate = ''
      r.el.style.scale = ''
      r.tx = r.ty = r.rot = 0
      r.sc = 1
    }

    const frame = () => {
      raf = 0
      const vh = window.innerHeight
      let moving = false
      riders.forEach((r) => {
        if (!r.on) return
        const b = r.el.getBoundingClientRect()
        const d = Math.max(-1.2, Math.min(1.2, (b.top + b.height / 2 - vh / 2) / (vh / 2)))
        const [tx, ty, rot, sc] = target(r, d)
        const k = 0.14 // spring toward the target: elastic on fast flicks, calm at rest
        r.tx += (tx - r.tx) * k
        r.ty += (ty - r.ty) * k
        r.rot += (rot - r.rot) * k
        r.sc += (sc - r.sc) * k
        if (Math.abs(tx - r.tx) + Math.abs(ty - r.ty) + Math.abs(rot - r.rot) * 4 + Math.abs(sc - r.sc) * 100 > 0.15) moving = true
        r.el.style.translate = `${r.tx.toFixed(2)}px ${r.ty.toFixed(2)}px`
        r.el.style.rotate = `${r.rot.toFixed(3)}deg`
        r.el.style.scale = r.sc.toFixed(4)
      })
      // keep running while things are still settling, then sleep until the next scroll
      idle = moving ? 0 : idle + 1
      if (idle < 8) raf = requestAnimationFrame(frame)
    }
    const wake = () => { idle = 0; if (!raf) raf = requestAnimationFrame(frame) }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const r = riders.get(en.target as HTMLElement)
        if (!r) return
        if (en.isIntersecting && !r.on) {
          r.mode = MODES[next++ % MODES.length] // a new motion every time it comes back
          r.on = true
        } else if (!en.isIntersecting && r.on) {
          r.on = false
          clear(r)
        }
      })
      wake()
    }, { root: main, rootMargin: '10% 0px' })

    const ridable = (el: HTMLElement) => {
      if (el.closest('[role="dialog"], [data-no-scroll-fx]')) return false
      const b = el.getBoundingClientRect()
      if (!b.width || b.height > 620 || b.width > 900) return false
      const pos = getComputedStyle(el).position
      if (pos === 'fixed' || pos === 'sticky') return false
      // ride the outermost card only (a card inside a moving card would double up)
      const outer = el.parentElement?.closest(CARDS) as HTMLElement | null
      return !(outer && riders.has(outer))
    }

    const scan = () => {
      main.querySelectorAll<HTMLElement>(CARDS).forEach((el) => {
        if (riders.has(el) || !ridable(el)) return
        const r: Rider = { el, i: riders.size, mode: MODES[0], on: false, tx: 0, ty: 0, rot: 0, sc: 1 }
        riders.set(el, r)
        io.observe(el)
      })
      // cards that left the page
      riders.forEach((r, el) => { if (!el.isConnected) { io.unobserve(el); riders.delete(el) } })
      wake()
    }

    let pending = 0
    const mo = new MutationObserver(() => { window.clearTimeout(pending); pending = window.setTimeout(scan, 160) })
    mo.observe(main, { childList: true, subtree: true })
    const first = window.setTimeout(scan, 120)
    main.addEventListener('scroll', wake, { passive: true })
    window.addEventListener('resize', wake)

    return () => {
      window.clearTimeout(first)
      window.clearTimeout(pending)
      cancelAnimationFrame(raf)
      mo.disconnect()
      io.disconnect()
      main.removeEventListener('scroll', wake)
      window.removeEventListener('resize', wake)
      riders.forEach(clear)
    }
  }, [pathname])

  return null
}
