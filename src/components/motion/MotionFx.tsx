'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { gsap, ScrollTrigger, prefersReducedMotion, isTouch, scroller } from '@/lib/gsap'
import { mirror, order, play, pose, showFor, type Entrance, type Flow } from '@/lib/motion/choreo'

/**
 * MotionFx — the shared motion layer, wired by selectors so screens need no
 * per-component code. Re-scans on every route and whenever new content
 * arrives (MutationObserver), and cleans up after itself.
 *
 *  · Cards in 3D — every card-like box (.card, .glass, .glass-gold,
 *    [data-fx]) leans toward the pointer, or toward a pressing finger on
 *    phones, and lifts slightly; the app's existing gold sheen (--mx/--my)
 *    follows the finger too. Very large panels and .tilt-card (which has its
 *    own tilt) are left alone.
 *  · Entrances — every card is dealt a different entrance from this visit's
 *    deck (lib/motion/choreo.ts: rise, drop, door, iris, swirl, focus…) and
 *    each group arrives in this visit's flow (cascade, centre-out, scatter…),
 *    so no two neighbours and no two visits move the same way.
 *  · Figures — numbers set in tabular figures (money, counts, points) count
 *    up from zero the first time they appear, keeping their own format
 *    (₦, commas, decimals, k). The text node is updated in place, so React
 *    keeps ownership of it.
 *  · Motion sensor — [data-gyro] (the work clock) tilts with the phone.
 */

const CARDS = '.card, .glass, .glass-gold, [data-fx]'
const NUMBER = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(\D*)$/

export function MotionFx() {
  const pathname = usePathname()

  useEffect(() => {
    if (prefersReducedMotion()) return
    const main = scroller()
    if (!main) return
    const cleanups: (() => void)[] = []
    const seen = new WeakSet<Element>()

    // ── cards: tilt toward pointer / finger ──
    const tiltable = (el: HTMLElement) => {
      if (el.classList.contains('tilt-card') || el.closest('[role="dialog"], [data-no-tilt]')) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.width < 760 && r.height < 620
    }
    const attachTilt = (el: HTMLElement) => {
      if (!tiltable(el)) return
      gsap.set(el, { transformPerspective: 900 })
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.45, ease: 'power3.out' })
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.45, ease: 'power3.out' })
      const lift = gsap.quickTo(el, 'z', { duration: 0.45, ease: 'power3.out' })
      const move = (e: PointerEvent) => {
        if (e.pointerType === 'touch' && e.buttons === 0 && e.type === 'pointermove') return
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        const k = r.width < 300 ? 1.4 : 1
        rx(-(py - 0.5) * 8 * k)
        ry((px - 0.5) * 10 * k)
        lift(14)
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
        if (e.pointerType === 'touch') el.classList.add('fx-pressed')
      }
      const leave = () => {
        rx(0)
        ry(0)
        lift(0)
        el.classList.remove('fx-pressed')
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerdown', move)
      el.addEventListener('pointerleave', leave)
      el.addEventListener('pointerup', leave)
      el.addEventListener('pointercancel', leave)
      cleanups.push(() => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerdown', move)
        el.removeEventListener('pointerleave', leave)
        el.removeEventListener('pointerup', leave)
        el.removeEventListener('pointercancel', leave)
      })
    }

    // ── figures: count up once ──
    const countUp = (el: HTMLElement) => {
      if (el.childNodes.length !== 1 || el.firstChild?.nodeType !== 3) return
      // only figures that are actually on the page (hidden ones keep their value)
      if (!el.getClientRects().length) return
      const node = el.firstChild as Text
      const raw = (node.nodeValue ?? '').trim()
      if (!raw || /[:/]/.test(raw)) return
      const m = raw.match(NUMBER)
      if (!m) return
      const [, pre, num, post] = m
      const target = Number(num.replace(/,/g, ''))
      if (!Number.isFinite(target) || target === 0) return
      const decimals = (num.split('.')[1] ?? '').length
      const commas = num.includes(',')
      const fmt = (v: number) =>
        commas
          ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : v.toFixed(decimals)
      const obj = { v: 0 }
      let done = false
      node.nodeValue = `${pre}${fmt(0)}${post}`
      const st = ScrollTrigger.create({
        trigger: el,
        scroller: main,
        start: 'top 95%',
        once: true,
        onEnter: () =>
          gsap.to(obj, {
            v: target,
            duration: Math.min(1.6, 0.6 + Math.log10(Math.abs(target) + 1) * 0.25),
            ease: 'power3.out',
            onUpdate: () => {
              // React may have re-rendered a new value meanwhile — stop if so
              if (!el.contains(node)) return
              node.nodeValue = `${pre}${fmt(obj.v)}${post}`
            },
            onComplete: () => {
              done = true
              if (el.contains(node)) node.nodeValue = raw
            },
          }),
      })
      cleanups.push(() => {
        st.kill()
        // never leave a figure at a half-counted value
        if (!done && el.contains(node) && node.nodeValue !== raw) node.nodeValue = raw
      })
    }

    // ── entrances: cascade up in 3D ──
    const entering: HTMLElement[] = []
    const queueEntrance = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      if (r.height > 900 || el.closest('[role="dialog"], [data-noreveal]')) return
      entering.push(el)
    }
    // Every card is dealt its own entrance from this visit's deck (lib/motion/choreo.ts), so
    // neighbours never move alike, and each group arrives in this visit's flow order.
    const show = showFor(pathname)
    const dealt = new WeakMap<Element, Entrance>()
    const flushEntrances = () => {
      if (!entering.length) return
      const batch = entering.splice(0)
      // Deal a fresh move and park the card in its starting pose (only ever while it is off screen).
      const ready = (el: Element, fromAbove: boolean) => {
        const e = fromAbove ? mirror(show.deal()) : show.deal()
        dealt.set(el, e)
        // a fast scroll can leave before the last entrance finished (the tilt's own tweens stay)
        gsap.killTweensOf(el, 'autoAlpha,opacity,visibility,x,y,scale,scaleX,scaleY,skewX,rotation,clipPath,filter')
        pose(el, e)
      }
      const enter = (els: Element[], flow: Flow) =>
        order(els as HTMLElement[], flow, show.rng).forEach((el, i) => {
          const e = dealt.get(el)
          // the entrance clears its transform at rest; give the 3D tilt its depth back
          if (e) play(el, e, { delay: i * 0.07, onComplete: () => gsap.set(el, { transformPerspective: 900 }) })
          dealt.delete(el)
        })
      batch.forEach((el) => ready(el, false))
      // Not once: every time a card scrolls fully out and back, it is dealt a new move. Scrolling
      // back up, the move is mirrored (it arrives from above) and the group runs in reverse.
      const sts = ScrollTrigger.batch(batch, {
        scroller: main,
        start: 'top 98%',
        end: 'bottom 2%',
        onEnter: (els) => enter(els, show.flow),
        onEnterBack: (els) => enter(els, show.flow === 'cascade' ? 'reverse' : show.flow === 'reverse' ? 'cascade' : show.flow),
        onLeave: (els) => els.forEach((el) => ready(el, true)),
        onLeaveBack: (els) => els.forEach((el) => ready(el, false)),
      })
      cleanups.push(() => sts.forEach((s) => s.kill()))
    }

    const scan = () => {
      main.querySelectorAll<HTMLElement>(CARDS).forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        attachTilt(el)
        queueEntrance(el)
      })
      main.querySelectorAll<HTMLElement>('.tabular-nums').forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        countUp(el)
      })
      // ── bars: meters sweep in from the left when they come into view ──
      main.querySelectorAll<HTMLElement>('[role="progressbar"] > div, [data-fill]').forEach((bar) => {
        if (seen.has(bar) || !bar.getClientRects().length) return
        seen.add(bar)
        gsap.set(bar, { scaleX: 0, transformOrigin: '0% 50%' })
        const st = ScrollTrigger.create({
          trigger: bar,
          scroller: main,
          start: 'top 96%',
          once: true,
          onEnter: () => gsap.to(bar, { scaleX: 1, duration: 1.1, ease: 'settle', delay: 0.15 }),
        })
        cleanups.push(() => {
          st.kill()
          gsap.set(bar, { clearProps: 'transform,transformOrigin' })
        })
      })
      flushEntrances()
      ScrollTrigger.refresh()
    }

    let pending = 0
    const mo = new MutationObserver(() => {
      window.clearTimeout(pending)
      pending = window.setTimeout(scan, 120)
    })
    mo.observe(main, { childList: true, subtree: true })
    const first = window.setTimeout(scan, 60)

    // ── the motion sensor: [data-gyro] tilts with the phone ──
    if (isTouch()) {
      const gyros = () => [...document.querySelectorAll<HTMLElement>('[data-gyro]')]
      const onTilt = (e: DeviceOrientationEvent) => {
        if (e.beta == null || e.gamma == null) return
        const x = gsap.utils.clamp(-14, 14, (e.beta - 45) * 0.35)
        const y = gsap.utils.clamp(-14, 14, e.gamma * 0.35)
        gyros().forEach((g) => gsap.to(g, { rotationX: -x, rotationY: y, transformPerspective: 800, duration: 0.6, ease: 'power2.out', overwrite: 'auto' }))
      }
      window.addEventListener('deviceorientation', onTilt)
      cleanups.push(() => window.removeEventListener('deviceorientation', onTilt))
    }

    return () => {
      window.clearTimeout(first)
      window.clearTimeout(pending)
      mo.disconnect()
      cleanups.forEach((fn) => fn())
    }
  }, [pathname])

  return null
}
