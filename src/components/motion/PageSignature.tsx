'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion, scroller } from '@/lib/gsap'

/**
 * PageSignature — each screen's own entrance, on top of MotionFx's shared
 * card motion. Selector-driven like MotionFx, so pages need no extra code.
 *
 * On every page
 *   · the page header (data-sig="head"): the eyebrow strip wipes in, the
 *     hairline under it sweeps across, the gold rule before the subline grows
 *   · section headers: the hairline beside each title draws across as the
 *     section scrolls into view
 *   · headings a page draws itself: letters flip up into place (SplitText),
 *     then the heading is handed back to React untouched
 *   · header glows drift with the scroll (parallax, scrubbed)
 *   · table rows stream in; primary buttons are magnetic (mouse only)
 *   · cards lean with scroll speed and spring back upright
 *
 * Per route (the family's signature)
 *   calendar · week · month · quarter · year   grid cells ripple out from the centre
 *   day                                         list rows slide in like a timeline
 *   finance · transactions                      table rows stream in from the right
 *   reports                                     chart bars grow, chart lines draw themselves
 *   dashboard · plans · goal                    progress rings sweep to their value
 *   everywhere else                             list rows pop in, one after another
 *
 * Cards themselves are MotionFx's job; `cardEntrance()` below tells it which
 * way each route's cards arrive (pop, drop, flip, slide…).
 */

type Family = 'grid' | 'day' | 'ledger' | 'charts' | 'rings' | 'notes' | 'flip' | 'default'

export function familyOf(pathname: string): Family {
  const seg = pathname.split('/')[1] ?? ''
  if (['calendar', 'week', 'month', 'quarter', 'year'].includes(seg)) return 'grid'
  if (seg === 'day') return 'day'
  if (seg === 'finance' || seg === 'transactions') return 'ledger'
  if (seg === 'reports') return 'charts'
  if (seg === 'dashboard' || seg === 'plans' || seg === 'goal') return 'rings'
  if (seg === 'notes') return 'notes'
  if (seg === 'challenge' || seg === 'reviews') return 'flip'
  return 'default'
}

/** How cards arrive on this route (used by MotionFx). Every one ends at rest. */
export function cardEntrance(pathname: string): { from: gsap.TweenVars; ease: string; stagger: number } {
  switch (familyOf(pathname)) {
    case 'notes':
      return { from: { y: -60, rotation: () => gsap.utils.random(-7, 7), scale: 0.9 }, ease: 'back.out(1.7)', stagger: 0.07 }
    case 'flip':
      return { from: { rotationY: -75, x: -20, transformOrigin: '0% 50%' }, ease: 'back.out(1.4)', stagger: 0.08 }
    case 'ledger':
      return { from: { x: 48, scale: 0.97 }, ease: 'power4.out', stagger: 0.05 }
    case 'day':
      return { from: { x: -40, scale: 0.97 }, ease: 'back.out(1.5)', stagger: 0.05 }
    case 'grid':
      return { from: { scale: 0.82, y: 10 }, ease: 'back.out(1.8)', stagger: 0.04 }
    case 'charts':
      return { from: { y: 60, rotationX: -28, transformOrigin: '50% 100%' }, ease: 'back.out(1.4)', stagger: 0.07 }
    default:
      // the pop: a little up, a little small, and a springy settle
      return { from: { y: 30, scale: 0.9 }, ease: 'back.out(1.9)', stagger: 0.06 }
  }
}

export function PageSignature() {
  const pathname = usePathname()

  useEffect(() => {
    if (prefersReducedMotion()) return
    const main = scroller()
    if (!main) return
    const family = familyOf(pathname)
    const seen = new WeakSet<Element>()
    const kills: (() => void)[] = []

    const onView = (el: Element, fn: () => void, start = 'top 94%') => {
      const st = ScrollTrigger.create({ trigger: el, scroller: main, start, once: true, onEnter: fn })
      kills.push(() => st.kill())
    }
    const fresh = (el: Element) => {
      if (seen.has(el)) return false
      seen.add(el)
      return true
    }
    const visible = (el: Element) => el.getClientRects().length > 0 && !el.closest('[role="dialog"], [data-noreveal-sig]')

    const scan = () => {
      // ── the page header ──
      main.querySelectorAll<HTMLElement>('[data-sig="head"]').forEach((head) => {
        if (!fresh(head)) return
        const strip = head.querySelector<HTMLElement>(':scope > div.border-b')
        const rule = head.querySelector<HTMLElement>('span.h-px')
        const orbs = head.querySelectorAll<HTMLElement>('.hero-orb')
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.fromTo(head, { clipPath: 'inset(0 0 100% 0 round 12px)' }, { clipPath: 'inset(0 0 0% 0 round 12px)', duration: 0.7, ease: 'power4.inOut', clearProps: 'clipPath' })
        if (orbs.length) tl.fromTo(orbs, { scale: 0.2, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.4, stagger: 0.15, ease: 'elastic.out(1, 0.6)' }, 0.2)
        if (strip) tl.fromTo(strip, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.8, clearProps: 'clipPath' }, 0.25)
        if (rule) tl.fromTo(rule, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.8, ease: 'back.out(2)', clearProps: 'transform' }, 0.6)
        kills.push(() => tl.kill())
      })

      // ── section hairlines draw across ──
      main.querySelectorAll<HTMLElement>('section > div > h2 + span.h-px').forEach((line) => {
        if (!fresh(line) || !visible(line)) return
        gsap.set(line, { scaleX: 0, transformOrigin: '0% 50%' })
        const title = line.previousElementSibling as HTMLElement | null
        onView(line, () => {
          gsap.to(line, { scaleX: 1, duration: 1, ease: 'power3.out', clearProps: 'transform' })
          if (title) gsap.fromTo(title, { x: -14, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(2)' })
        })
      })

      // ── grid family: cells ripple out from the centre ──
      if (family === 'grid') {
        main.querySelectorAll<HTMLElement>('.grid').forEach((g) => {
          const cells = [...g.children] as HTMLElement[]
          if (cells.length < 7 || !fresh(g) || !visible(g)) return
          if (cells.some((c) => c.getBoundingClientRect().height > 220)) return // a layout grid, not a calendar
          gsap.set(cells, { scale: 0.6, autoAlpha: 0 })
          onView(g, () =>
            gsap.to(cells, { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'back.out(2.2)', stagger: { grid: 'auto', from: 'center', amount: 0.6 }, clearProps: 'transform,opacity,visibility' }),
          )
        })
      }

      // ── headings a page draws itself (no shared PageHeader): letters flip up into place ──
      main.querySelectorAll<HTMLElement>('h1').forEach((h) => {
        if (!fresh(h) || !visible(h) || h.closest('[data-sig="head"]') || h.querySelector('[data-reveal], .reveal-line')) return
        if ((h.textContent ?? '').length > 80) return
        const split = SplitText.create(h, { type: 'words,chars', mask: 'words' })
        const tw = gsap.from(split.chars, {
          yPercent: 115,
          rotationX: -70,
          transformOrigin: '50% 100%',
          duration: 0.8,
          ease: 'back.out(1.8)',
          stagger: 0.022,
          // hand the heading back to React untouched once it has landed
          onComplete: () => split.revert(),
        })
        kills.push(() => {
          tw.kill()
          split.revert()
        })
      })

      // ── header orbs drift as the page scrolls (parallax) ──
      main.querySelectorAll<HTMLElement>('[data-sig="head"]').forEach((head) => {
        const orbs = head.querySelectorAll<HTMLElement>('.hero-orb')
        if (!orbs.length || head.dataset.parallax) return
        head.dataset.parallax = '1'
        const tw = gsap.to(orbs, {
          yPercent: (i) => (i % 2 ? -60 : 70),
          xPercent: (i) => (i % 2 ? 30 : -20),
          ease: 'none',
          scrollTrigger: { trigger: head, scroller: main, start: 'top top', end: 'bottom top', scrub: 0.6 },
        })
        kills.push(() => {
          tw.scrollTrigger?.kill()
          tw.kill()
          delete head.dataset.parallax
        })
      })

      // ── table rows stream in (from the right on money pages, from the left elsewhere) ──
      main.querySelectorAll<HTMLElement>('tbody').forEach((tb) => {
        if (!fresh(tb) || !visible(tb)) return
        const rows = [...tb.querySelectorAll<HTMLElement>(':scope > tr')].slice(0, 40)
        if (!rows.length) return
        gsap.set(rows, { x: family === 'ledger' ? 60 : -40, autoAlpha: 0 })
        onView(tb, () => gsap.to(rows, { x: 0, autoAlpha: 1, duration: 0.55, stagger: 0.035, ease: 'power4.out', clearProps: 'transform,opacity,visibility' }))
      })

      // ── primary buttons are magnetic: they lean toward a nearby pointer ──
      if (window.matchMedia('(pointer: fine)').matches) {
        main.querySelectorAll<HTMLElement>('button.bg-gold, a.bg-gold').forEach((btn) => {
          if (!fresh(btn)) return
          const x = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' })
          const y = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' })
          const move = (e: PointerEvent) => {
            const r = btn.getBoundingClientRect()
            x((e.clientX - (r.left + r.width / 2)) * 0.28)
            y((e.clientY - (r.top + r.height / 2)) * 0.4)
          }
          const leave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
          btn.addEventListener('pointermove', move)
          btn.addEventListener('pointerleave', leave)
          kills.push(() => {
            btn.removeEventListener('pointermove', move)
            btn.removeEventListener('pointerleave', leave)
            gsap.set(btn, { clearProps: 'transform' })
          })
        })
      }

      // cards to lean with scroll speed (see below)
      cards = [...main.querySelectorAll<HTMLElement>('[data-fx], .card')].filter((c) => c.getBoundingClientRect().height < 620)

      // ── lists: rows arrive one after another (timeline-style on the day page) ──
      main.querySelectorAll<HTMLElement>('ul, ol').forEach((list) => {
        const items = [...list.children].filter((c) => c.tagName === 'LI') as HTMLElement[]
        if (items.length < 2 || !fresh(list) || !visible(list) || list.closest('nav')) return
        const from = family === 'day' ? { x: -36, autoAlpha: 0 } : family === 'ledger' ? { x: 36, autoAlpha: 0 } : { y: 16, scale: 0.94, autoAlpha: 0 }
        const shown = items.slice(0, 30)
        gsap.set(shown, from)
        onView(list, () =>
          gsap.to(shown, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.045, ease: family === 'day' ? 'back.out(1.6)' : 'back.out(2)', clearProps: 'transform,opacity,visibility' }),
        )
      })

      // ── charts: bars grow from the baseline, lines draw themselves ──
      if (family === 'charts' || family === 'rings' || family === 'ledger') {
        main.querySelectorAll<SVGSVGElement>('svg:not(.lucide)').forEach((svg) => {
          if (!fresh(svg) || !visible(svg)) return
          const box = svg.getBoundingClientRect()
          if (box.width < 60 || box.height < 30) return
          const bars = [...svg.querySelectorAll<SVGRectElement>('rect')].filter((r) => r.getBBox().height > 3 && r.getBBox().width < box.width * 0.5)
          const strokes = [...svg.querySelectorAll<SVGGeometryElement>('path, polyline, line, circle')].filter((p) => {
            const stroke = getComputedStyle(p).stroke
            return stroke && stroke !== 'none' && p.getTotalLength?.() > 20
          })
          if (bars.length) gsap.set(bars, { scaleY: 0, transformOrigin: '50% 100%' })
          const prepared = strokes.map((p) => {
            const len = p.getTotalLength()
            const dash = p.getAttribute('stroke-dasharray')
            // a progress ring already uses its dasharray: sweep from empty to its value
            if (dash) {
              const target = parseFloat(getComputedStyle(p).strokeDashoffset) || 0
              const full = parseFloat(dash) || len
              gsap.set(p, { strokeDashoffset: full })
              return () => gsap.to(p, { strokeDashoffset: target, duration: 1.4, ease: 'elastic.out(1, 0.7)' })
            }
            gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
            return () => gsap.to(p, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' })
          })
          if (!bars.length && !prepared.length) return
          onView(svg, () => {
            if (bars.length) gsap.to(bars, { scaleY: 1, duration: 0.8, ease: 'back.out(1.8)', stagger: { each: 0.04, from: 'start' }, clearProps: 'transform' })
            prepared.forEach((play, i) => gsap.delayedCall(i * 0.05, play))
          })
        })
      }

      ScrollTrigger.refresh()
    }

    // ── scroll with energy: cards skew a touch with scroll speed and spring back ──
    let cards: HTMLElement[] = []
    const skew = { v: 0 }
    const clampSkew = gsap.utils.clamp(-5, 5)
    const speed = ScrollTrigger.create({
      scroller: main,
      onUpdate: (self) => {
        const target = clampSkew(self.getVelocity() / -450)
        if (Math.abs(target) <= Math.abs(skew.v) || !cards.length) return
        skew.v = target
        gsap.to(skew, {
          v: 0,
          duration: 0.8,
          ease: 'power3.out',
          overwrite: true,
          onUpdate: () => gsap.set(cards, { skewY: skew.v }),
        })
      },
    })
    kills.push(() => {
      speed.kill()
      gsap.set(cards, { skewY: 0 })
    })

    let pending = 0
    const mo = new MutationObserver(() => {
      window.clearTimeout(pending)
      pending = window.setTimeout(scan, 140)
    })
    mo.observe(main, { childList: true, subtree: true })
    const first = window.setTimeout(scan, 80)

    return () => {
      window.clearTimeout(first)
      window.clearTimeout(pending)
      mo.disconnect()
      kills.forEach((k) => k())
    }
  }, [pathname])

  return null
}
