'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ALL_LINKS, SETTINGS_LINK } from '@/components/ds/nav'
import { gsap, prefersReducedMotion, scroller } from '@/lib/gsap'

/**
 * RouteCurtain — the cut between screens, in Inchstone's ink and gold.
 *
 * Every navigation (sidebar links, the phone dock, the command palette — any
 * code that calls `navigateWithCurtain`, plus every internal <a>) plays one
 * of six covers, chosen at random and never twice in a row:
 *
 *   iris     an ink circle opens from the exact point you tapped or
 *            clicked, edged with a gold ring (the phone default feels like
 *            the screen "opening" from your finger)
 *   shutter  ink leaves close from top and bottom with a gold seam
 *   sweep    three ink panels sweep across, each with a gold leading edge
 *   fold     the screen folds away in 3D like a page being turned
 *   mosaic   tiles flip shut outward from your click, then shatter away
 *   slash    a slanted gold-edged band cuts across the screen and slides off
 *
 * The destination's name is set in Playfair over the cover while a fine
 * gold line draws under it; then the route swaps and the cover lifts.
 * Reduced motion: an instant cut.
 */

type Origin = { x: number; y: number }
type Go = (href: string, origin?: Origin) => void
let goImpl: Go | null = null

/** navigate with the curtain (falls back to a plain push if not mounted) */
export function navigateWithCurtain(href: string, origin?: Origin, fallback?: (href: string) => void) {
  if (goImpl) goImpl(href, origin)
  else fallback?.(href)
}

const LABELS: Record<string, string> = Object.fromEntries([...ALL_LINKS, SETTINGS_LINK].map((l) => [l.href, l.name]))
const labelFor = (path: string) => {
  const hit = Object.keys(LABELS).filter((h) => path === h || path.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0]
  return hit ? LABELS[hit] : path.replace(/^\//, '').split('/')[0].replace(/-/g, ' ') || 'Home'
}

const INK = 'rgb(var(--ink-rgb))'
const GOLD = 'rgb(var(--gold-rgb))'
const rand = gsap.utils.random

type Cover = { cover: (tl: gsap.core.Timeline) => void; reveal: (tl: gsap.core.Timeline) => void }
type Make = (stage: HTMLElement, o: Origin) => Cover

const el = (stage: HTMLElement, css: Partial<CSSStyleDeclaration>) => {
  const d = document.createElement('div')
  Object.assign(d.style, { position: 'absolute', inset: '0', willChange: 'transform, clip-path' }, css)
  stage.appendChild(d)
  return d
}

const VARIANTS: Record<string, Make> = {
  iris(stage, o) {
    const at = `${o.x}px ${o.y}px`
    const ring = el(stage, { background: GOLD, clipPath: `circle(0px at ${at})` })
    const fill = el(stage, { background: INK, clipPath: `circle(0px at ${at})` })
    const R = Math.hypot(Math.max(o.x, window.innerWidth - o.x), Math.max(o.y, window.innerHeight - o.y)) + 20
    return {
      cover: (tl) =>
        tl
          .to(ring, { clipPath: `circle(${R}px at ${at})`, duration: 0.6, ease: 'power3.inOut' }, 0)
          .to(fill, { clipPath: `circle(${R}px at ${at})`, duration: 0.6, ease: 'power3.inOut' }, 0.07),
      reveal: (tl) => {
        // the cover closes back down to a point at the centre of the screen
        const c = `${window.innerWidth / 2}px ${window.innerHeight / 2}px`
        gsap.set([fill, ring], { clipPath: `circle(${R}px at ${c})` })
        tl.to(fill, { clipPath: `circle(0px at ${c})`, duration: 0.6, ease: 'power3.inOut' }, 0).to(
          ring,
          { clipPath: `circle(0px at ${c})`, duration: 0.6, ease: 'power3.inOut' },
          0.07,
        )
      },
    }
  },

  shutter(stage) {
    const top = el(stage, { bottom: '50%', background: INK, borderBottom: `2px solid ${GOLD}` })
    const bot = el(stage, { top: '50%', background: INK, borderTop: `2px solid ${GOLD}` })
    gsap.set(top, { yPercent: -101 })
    gsap.set(bot, { yPercent: 101 })
    return {
      cover: (tl) => tl.to(top, { yPercent: 0, duration: 0.55, ease: 'expo.inOut' }, 0).to(bot, { yPercent: 0, duration: 0.55, ease: 'expo.inOut' }, 0),
      reveal: (tl) => tl.to(top, { yPercent: -101, duration: 0.6, ease: 'expo.inOut' }, 0).to(bot, { yPercent: 101, duration: 0.6, ease: 'expo.inOut' }, 0),
    }
  },

  sweep(stage) {
    const fromLeft = Math.random() < 0.5
    const panels = [0, 1, 2].map((i) =>
      el(stage, {
        background: INK,
        boxShadow: `${fromLeft ? '' : '-'}6px 0 0 0 ${GOLD}`,
        zIndex: String(i),
      }),
    )
    gsap.set(panels, { xPercent: fromLeft ? -105 : 105, skewX: fromLeft ? -8 : 8 })
    return {
      cover: (tl) => tl.to(panels, { xPercent: 0, skewX: 0, duration: 0.6, ease: 'power4.inOut', stagger: 0.07 }, 0),
      reveal: (tl) =>
        tl.to([...panels].reverse(), { xPercent: fromLeft ? 105 : -105, skewX: fromLeft ? 8 : -8, duration: 0.65, ease: 'power4.inOut', stagger: 0.06 }, 0),
    }
  },

  fold(stage) {
    stage.style.perspective = '1400px'
    const leaf = el(stage, { background: INK, borderLeft: `2px solid ${GOLD}`, transformOrigin: '0% 50%' })
    const shade = el(stage, { background: 'black', opacity: '0', pointerEvents: 'none' })
    gsap.set(leaf, { rotationY: 95 })
    return {
      cover: (tl) => tl.to(shade, { opacity: 0.35, duration: 0.5 }, 0).to(leaf, { rotationY: 0, duration: 0.7, ease: 'power3.inOut' }, 0),
      reveal: (tl) => {
        gsap.set(leaf, { transformOrigin: '100% 50%', borderLeft: 'none', borderRight: `2px solid ${GOLD}` })
        tl.to(leaf, { rotationY: -95, duration: 0.7, ease: 'power3.inOut' }, 0).to(shade, { opacity: 0, duration: 0.5 }, 0.2)
      },
    }
  },

  // tiles flip shut from where you clicked, then shatter away from the centre
  mosaic(stage, o) {
    stage.style.perspective = '1200px'
    const cols = window.innerWidth < 640 ? 4 : 7
    const rows = window.innerWidth < 640 ? 7 : 5
    const w = 100 / cols
    const h = 100 / rows
    const tiles: HTMLElement[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        tiles.push(el(stage, { inset: 'auto', left: `${c * w}%`, top: `${r * h}%`, width: `${w + 0.2}%`, height: `${h + 0.2}%`, background: INK, boxShadow: `inset 0 0 0 1px rgb(var(--gold-rgb) / 0.35)` }))
    gsap.set(tiles, { rotationY: 90, scale: 0.6, autoAlpha: 0 })
    const fx = o.x / window.innerWidth
    const fy = o.y / window.innerHeight
    const near = [Math.min(cols - 1, Math.floor(fx * cols)), Math.min(rows - 1, Math.floor(fy * rows))]
    return {
      cover: (tl) =>
        tl.to(tiles, { rotationY: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(1.6)', stagger: { grid: [rows, cols], from: near as [number, number], amount: 0.35 } }, 0),
      reveal: (tl) =>
        tl.to(tiles, {
          rotationX: () => rand(-120, 120), rotationY: () => rand(-120, 120), x: () => rand(-80, 80), y: () => rand(60, 220), scale: 0.3, autoAlpha: 0,
          duration: 0.7, ease: 'power3.in', stagger: { grid: [rows, cols], from: 'center', amount: 0.3 },
        }, 0),
    }
  },

  // a diagonal slash of ink with a gold blade cuts across, then slides off the other way
  slash(stage) {
    // A slanted band: its leading edge sweeps across to cover, its trailing edge follows to reveal.
    const ltr = Math.random() < 0.5
    const blade = el(stage, { background: GOLD })
    const fill = el(stage, { background: INK })
    const P = (a: number, b: number, c: number, d: number) =>
      ltr ? `polygon(${a}% 0%, ${b}% 0%, ${c}% 100%, ${d}% 100%)` : `polygon(${100 - b}% 0%, ${100 - a}% 0%, ${100 - d}% 100%, ${100 - c}% 100%)`
    const startA = P(-60, -60, -100, -100)
    const shut = P(-60, 160, 120, -100)
    const endA = P(160, 160, 120, 120)
    gsap.set([blade, fill], { clipPath: startA })
    return {
      cover: (tl) =>
        tl.to(blade, { clipPath: shut, duration: 0.55, ease: 'power4.inOut' }, 0).to(fill, { clipPath: shut, duration: 0.55, ease: 'power4.inOut' }, 0.06),
      reveal: (tl) =>
        tl.to(fill, { clipPath: endA, duration: 0.6, ease: 'power4.inOut' }, 0).to(blade, { clipPath: endA, duration: 0.6, ease: 'power4.inOut' }, 0.06),
    }
  },
}
const NAMES = Object.keys(VARIANTS)

export function RouteCurtain() {
  const root = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const covering = useRef(false)
  const first = useRef(true)
  const active = useRef<Cover | null>(null)
  const last = useRef('')
  const lastTap = useRef<Origin>({ x: 0, y: 0 })

  const build = (o: Origin) => {
    const host = root.current!
    const stage = host.querySelector<HTMLElement>('[data-stage]')!
    stage.innerHTML = ''
    stage.style.perspective = ''
    const forced = (window as unknown as { __curtain?: string }).__curtain
    const pool = NAMES.filter((n) => n !== last.current)
    const name = forced && VARIANTS[forced] ? forced : (rand(pool) as string)
    last.current = name
    host.dataset.variant = name
    active.current = VARIANTS[name](stage, o)
    return active.current
  }

  // leave
  useEffect(() => {
    const reduce = prefersReducedMotion()
    const host = root.current!
    const word = host.querySelector<HTMLElement>('[data-word]')!
    const line = host.querySelector<HTMLElement>('[data-line]')!

    const go: Go = (href, origin) => {
      const url = new URL(href, window.location.href)
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (reduce) return router.push(href)
      if (covering.current) return
      covering.current = true
      const o = origin ?? lastTap.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const cover = build(o)
      host.style.visibility = 'visible'
      const tl = gsap.timeline({
        onComplete: () => {
          router.push(href)
          // safety: if the route never changes (same page, error), lift anyway
          window.setTimeout(() => covering.current && lift(), 2500)
        },
      })
      cover.cover(tl)
      tl.set(word, { textContent: labelFor(url.pathname), autoAlpha: 0 }, 0)
        .fromTo(word, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'settle' }, 0.3)
        .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, 0.35)
    }
    goImpl = go

    const onPointer = (e: PointerEvent) => {
      lastTap.current = { x: e.clientX, y: e.clientY }
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.noCurtain !== undefined) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api')) return
      if (url.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      go(url.pathname + url.search + url.hash, { x: e.clientX, y: e.clientY })
    }
    window.addEventListener('pointerdown', onPointer, { capture: true, passive: true })
    document.addEventListener('click', onClick, true)
    return () => {
      goImpl = null
      window.removeEventListener('pointerdown', onPointer, { capture: true })
      document.removeEventListener('click', onClick, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // enter
  function lift() {
    const host = root.current
    if (!host) return
    const word = host.querySelector<HTMLElement>('[data-word]')!
    const line = host.querySelector<HTMLElement>('[data-line]')!
    const was = covering.current
    covering.current = false
    let cover = active.current
    if (!was || !cover) {
      // back/forward: snap a cover shut, then reveal — still a cut
      cover = build({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      const snap = gsap.timeline()
      cover.cover(snap)
      snap.progress(1).kill()
      word.textContent = labelFor(window.location.pathname)
      gsap.set(word, { autoAlpha: 1, yPercent: 0 })
      gsap.set(line, { scaleX: 1 })
    }
    scroller()?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    host.style.visibility = 'visible'
    const tl = gsap.timeline({
      delay: was ? 0.08 : 0,
      onComplete: () => {
        host.style.visibility = 'hidden'
        host.querySelector('[data-stage]')!.innerHTML = ''
        active.current = null
      },
    })
    tl.to([word, line], { autoAlpha: 0, yPercent: -40, duration: 0.35, ease: 'power2.in' }, 0)
    const r = gsap.timeline()
    cover.reveal(r)
    tl.add(r, 0.12)
  }

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (prefersReducedMotion()) return
    lift()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[120] overflow-hidden" style={{ visibility: 'hidden' }}>
      <div data-stage className="absolute inset-0" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
        <p data-word className="text-center font-display text-[clamp(2.4rem,9vw,6rem)] italic leading-none text-[rgb(var(--parchment-rgb))]" />
        <div data-line className="h-px w-32 origin-left bg-[rgb(var(--gold-rgb))]" />
      </div>
    </div>
  )
}
