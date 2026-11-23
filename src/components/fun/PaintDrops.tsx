'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Dices, X } from 'lucide-react'
import { gsap, Draggable, prefersReducedMotion } from '@/lib/gsap'
import { applyAccent, mixAccent } from '@/lib/accent'
import { ACCENT_CHANGE_EVENT, PAINTS, currentPaintIndex, paintChoice, type Paint } from '@/lib/paints'

/**
 * PaintDrops — choose Inchstone's colour by throwing paint at it (same idea as the portfolio).
 *
 * The paint-drop button in the top bar opens a wheel of eight paint drops. Three ways to choose:
 *   · tap a drop         the new colour floods the whole app outward from that drop
 *   · drag a drop out    fling it anywhere on the screen: it splats there and floods from the splat
 *   · spin the wheel     flick it (it keeps spinning, then settles); the drop under the ▼ wins.
 *                        The dice spins it for you.
 * A paint is an accent (lib/paints.ts → applyAccent), so it is remembered, works in light and
 * dark, and Settings → Accent shows it. The flood is a View Transition; browsers without one get
 * the splash only. Keyboard: arrows move round the wheel, Enter/Space throws, Esc closes.
 * Reduced motion: the colour changes instantly, no splash.
 *
 * Phones (touch or small screens) take the "lite" path so nothing ever freezes: no View
 * Transition (it snapshots the whole app and blocks input until the circle finishes), no blurred
 * glass, no per-frame React renders while the wheel spins, and the splash + flood are Web
 * Animations on transform/opacity, which the GPU compositor keeps running even while the main
 * thread restyles the app for the new colour.
 */

const RING = 248 // wheel diameter
const R = 96 // radius the drops sit on
const STEP = 360 / PAINTS.length

/** Touch or small screen: take the cheap, compositor-only path. */
const isLite = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)

const isDark = () => document.documentElement.classList.contains('dark')
/** The colour a paint shows in the current theme (paper gets the readable, deeper shade). */
const shade = (p: Paint) => (isDark() ? p.hex : mixAccent(p.hex, false).accent)
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`
const farCorner = (x: number, y: number) => Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))

/** Paint splats at a point: a blot, a ring and a burst of droplets under gravity (desktop). */
function splat(x: number, y: number, color: string) {
  if (prefersReducedMotion()) return
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '9998', overflow: 'hidden' })
  document.body.appendChild(layer)
  const blob = (size: number, extra: Partial<CSSStyleDeclaration> = {}) => {
    const d = document.createElement('div')
    Object.assign(d.style, { position: 'absolute', left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: color }, extra)
    layer.appendChild(d)
    return d
  }
  const blot = blob(70)
  const ring = blob(40, { background: 'transparent', border: `3px solid ${color}` })
  const drops = Array.from({ length: 22 }, () => blob(gsap.utils.random(6, 16)))
  gsap.timeline({ onComplete: () => layer.remove() })
    .fromTo(blot, { scale: 0 }, { scale: 1.4, duration: 0.25, ease: 'back.out(3)' }, 0)
    .to(blot, { scale: 0.2, autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, 0.35)
    .fromTo(ring, { scale: 0.4 }, { scale: 9, autoAlpha: 0, borderWidth: 0.5, duration: 0.8, ease: 'expo.out' }, 0)
    .to(drops, {
      physics2D: { velocity: () => gsap.utils.random(260, 620), angle: () => gsap.utils.random(-170, -10), gravity: 1400 },
      scale: () => gsap.utils.random(0.3, 1.1),
      autoAlpha: 0,
      duration: 1.1,
      ease: 'none',
    }, 0)
}

/**
 * The phone splash: a flood circle, a ring and a few droplets — Web Animations on transform and
 * opacity only, so the compositor plays them smoothly while the app restyles underneath.
 */
function liteSplat(x: number, y: number, color: string) {
  if (prefersReducedMotion()) return
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '9998', overflow: 'hidden', contain: 'strict' })
  document.body.appendChild(layer)
  const dot = (size: number, extra: Partial<CSSStyleDeclaration> = {}) => {
    const d = document.createElement('div')
    Object.assign(d.style, { position: 'absolute', left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: color, willChange: 'transform, opacity' }, extra)
    layer.appendChild(d)
    return d
  }
  const anims: Animation[] = []
  anims.push(dot(100).animate(
    [{ transform: 'scale(0)', opacity: 0.45 }, { transform: `scale(${(farCorner(x, y) * 2) / 100})`, opacity: 0 }],
    { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
  ))
  anims.push(dot(40, { background: 'transparent', border: `3px solid ${color}` }).animate(
    [{ transform: 'scale(0.4)', opacity: 1 }, { transform: 'scale(7)', opacity: 0 }],
    { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
  ))
  for (let k = 0; k < 8; k++) {
    const a = (-170 + (160 * k) / 7 + gsap.utils.random(-8, 8)) * (Math.PI / 180)
    const v = gsap.utils.random(70, 150)
    const dx = Math.cos(a) * v
    const dy = Math.sin(a) * v
    anims.push(dot(gsap.utils.random(7, 13)).animate(
      [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.9)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.4}px, ${dy + 140}px) scale(0.4)`, opacity: 0 },
      ],
      { duration: 800, easing: 'cubic-bezier(0.25, 0.6, 0.5, 1)', fill: 'forwards' },
    ))
  }
  Promise.all(anims.map((an) => an.finished)).finally(() => layer.remove())
}

/** Apply a paint, flooding outward from (x, y) where the browser can. */
function throwPaint(p: Paint, x: number, y: number) {
  const set = () => {
    applyAccent(paintChoice(p))
    window.dispatchEvent(new CustomEvent(ACCENT_CHANGE_EVENT, { detail: p.id }))
  }
  const color = shade(p)
  if (isLite()) {
    // Splash first (it runs on the compositor), the app-wide restyle two frames later so the
    // splash is already moving when the main thread gets busy.
    liteSplat(x, y, color)
    requestAnimationFrame(() => requestAnimationFrame(set))
    return
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
  if (prefersReducedMotion() || !doc.startViewTransition) {
    set()
    splat(x, y, color)
    return
  }
  const root = document.documentElement
  const far = farCorner(x, y)
  // Switches off the browser's default cross-fade for this one transition (globals.css).
  root.dataset.paintFlood = ''
  const t = doc.startViewTransition(set)
  t.ready
    .then(() => {
      splat(x, y, color)
      const anim = root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`] },
        { duration: 950, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      )
      anim.finished.finally(() => delete root.dataset.paintFlood)
    })
    .catch(() => delete root.dataset.paintFlood)
}

export function PaintDrops({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [focus, setFocus] = useState(0)
  const [theme, setTheme] = useState(0) // bumps on a theme flip (drops show that theme's shade)
  const [lite, setLite] = useState(false)
  const focusRef = useRef(0)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const wheel = useRef<HTMLDivElement>(null)
  const drag = useRef<Draggable | null>(null)
  const dropRefs = useRef<(HTMLButtonElement | null)[]>([])
  const suppressClick = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const sync = () => setActive(currentPaintIndex())
    const raf = requestAnimationFrame(() => { sync(); setLite(isLite()) })
    window.addEventListener(ACCENT_CHANGE_EVENT, sync)
    let dark: boolean | null = null
    const mo = new MutationObserver(() => {
      // the class list changes for many reasons; only a real theme flip re-colours the drops
      const d = isDark()
      if (d !== dark) { dark = d; setTheme((n) => n + 1) }
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => { cancelAnimationFrame(raf); window.removeEventListener(ACCENT_CHANGE_EVENT, sync); mo.disconnect() }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    button.current?.focus()
  }, [])

  /** Only re-render when the colour under the ▼ really changes, not on every spin frame. */
  const showFocus = useCallback((i: number) => {
    if (focusRef.current === i) return
    focusRef.current = i
    setFocus(i)
  }, [])

  // The drops' colours: the colour maths runs once per opening / theme flip, not on every render.
  const shades = useMemo(
    () => (open && theme >= 0 ? PAINTS.map(shade) : PAINTS.map((p) => p.hex)),
    [open, theme],
  )
  const conic = useMemo(() => `conic-gradient(${shades.map((c, i) => `${alpha(c, 0.18)} ${i * STEP}deg ${(i + 1) * STEP}deg`).join(', ')})`, [shades])

  const dropX = (i: number) => Math.sin((i * STEP * Math.PI) / 180) * R
  const dropY = (i: number) => -Math.cos((i * STEP * Math.PI) / 180) * R

  /** Which drop sits under the ▼ for a wheel rotation. */
  const atTop = (rotation: number) => {
    const i = Math.round(-rotation / STEP)
    return ((i % PAINTS.length) + PAINTS.length) % PAINTS.length
  }

  const throwFrom = (i: number, el?: Element | null) => {
    const b = (el ?? button.current)?.getBoundingClientRect()
    throwPaint(PAINTS[i], b ? b.left + b.width / 2 : innerWidth / 2, b ? b.top + b.height / 2 : innerHeight / 2)
    setActive(i)
  }
  const pointer = () => wheel.current?.parentElement?.querySelector('[data-pointer]')

  // Open: pop the drops out of the centre, make the wheel spinnable, close on Esc / outside tap.
  useEffect(() => {
    if (!open || !wheel.current) return
    const start = Math.max(0, currentPaintIndex())
    focusRef.current = -1
    showFocus(start)
    gsap.set(wheel.current, { rotation: -start * STEP })
    if (!prefersReducedMotion()) {
      if (isLite()) {
        // one short compositor animation for the whole panel; the drops are already in place
        panel.current?.animate(
          [{ transform: 'translateY(-8px) scale(0.96)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        )
      } else {
        gsap.fromTo(panel.current, { scale: 0.6, autoAlpha: 0, transformOrigin: '90% 0%' }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.8)' })
        gsap.fromTo(dropRefs.current, { x: 0, y: 0, scale: 0 }, { x: (i) => dropX(i), y: (i) => dropY(i), scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.55)', stagger: 0.04, delay: 0.08 })
      }
    }
    drag.current = Draggable.create(wheel.current, {
      type: 'rotation',
      inertia: true,
      trigger: wheel.current.querySelector('[data-spin]') as Element,
      snap: (v: number) => Math.round(v / STEP) * STEP,
      // the hub names whatever is passing under the ▼ while it spins
      onDrag() { showFocus(atTop(this.rotation)) },
      onThrowUpdate() { showFocus(atTop(this.rotation)) },
      onThrowComplete() {
        const i = atTop(this.rotation)
        showFocus(i)
        throwFrom(i, pointer())
      },
    })[0]
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || button.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => dropRefs.current[start]?.focus({ preventScroll: true }))
    return () => {
      drag.current?.kill()
      drag.current = null
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close, showFocus])

  /** Roll the dice: the wheel spins hard and lands on a random other colour. */
  const roll = () => {
    if (!wheel.current) return
    const others = PAINTS.map((_, i) => i).filter((i) => i !== active)
    const pick = others[Math.floor(Math.random() * others.length)]
    const from = gsap.getProperty(wheel.current, 'rotation') as number
    const to = Math.round(from / 360) * 360 - 360 * (3 + Math.floor(Math.random() * 2)) - pick * STEP
    const land = () => { showFocus(pick); throwFrom(pick, pointer()) }
    if (prefersReducedMotion()) { gsap.set(wheel.current, { rotation: -pick * STEP }); land(); return }
    gsap.to(wheel.current, { rotation: to, duration: 2.2, ease: 'power4.out', onComplete: land })
  }

  /** Dragging a drop off the wheel: a glob of paint follows the finger; let go on the page to splat. */
  const startGlob = (e: RPointerEvent<HTMLButtonElement>, i: number) => {
    if (e.button !== 0) return
    const color = shades[i]
    const sx = e.clientX
    const sy = e.clientY
    let glob: HTMLDivElement | null = null
    let lx = sx
    let ly = sy
    const move = (ev: PointerEvent) => {
      if (!glob && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        glob = document.createElement('div')
        Object.assign(glob.style, {
          position: 'fixed', left: '0', top: '0', width: '44px', height: '44px', margin: '-22px 0 0 -22px', borderRadius: '50%',
          background: color, boxShadow: lite ? 'none' : `0 10px 30px ${alpha(color, 0.5)}`, pointerEvents: 'none', zIndex: '9999', willChange: 'transform',
        })
        document.body.appendChild(glob)
      }
      if (glob) {
        const vx = ev.clientX - lx
        const vy = ev.clientY - ly
        const speed = Math.min(1, Math.hypot(vx, vy) / 40)
        gsap.set(glob, { x: ev.clientX, y: ev.clientY, rotation: (Math.atan2(vy, vx) * 180) / Math.PI, scaleX: 1 + speed * 0.6, scaleY: 1 - speed * 0.3 })
      }
      lx = ev.clientX
      ly = ev.clientY
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!glob) return // a plain tap: onClick throws it
      const g = glob
      suppressClick.current = true
      if (ev.type === 'pointercancel' || panel.current?.contains(document.elementFromPoint(ev.clientX, ev.clientY))) {
        gsap.to(g, { scale: 0, duration: 0.3, ease: 'back.in(2)', onComplete: () => g.remove() })
        return
      }
      g.remove()
      setActive(i)
      setOpen(false)
      throwPaint(PAINTS[i], ev.clientX, ev.clientY)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const onDropKey = (e: RKeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const n = (i + step + PAINTS.length) % PAINTS.length
    showFocus(n)
    dropRefs.current[n]?.focus()
    if (wheel.current) gsap.to(wheel.current, { rotation: -n * STEP, duration: prefersReducedMotion() ? 0 : 0.45, ease: 'back.out(1.6)' })
  }

  const me = active >= 0 ? PAINTS[active] : null
  const shown = PAINTS[focus] ?? PAINTS[0]

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Colour: ${me ? me.name : 'your own'}. Throw some paint`}
        title="Throw some paint"
        className={`group ${className}`}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true">
          <path d="M12 2.5c3.6 4.3 6.5 7.8 6.5 11.2A6.5 6.5 0 0 1 5.5 13.7C5.5 10.3 8.4 6.8 12 2.5Z" fill="rgb(var(--gold-rgb))" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="9.6" cy="14.2" r="1.4" fill="rgb(var(--ink-rgb) / 0.7)" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={`fixed right-3 z-[9990] w-[min(320px,calc(100vw-24px))] rounded-[28px] border border-parchment/15 p-5 text-parchment sm:right-6 ${
            lite ? 'bg-dialog shadow-[0_16px_40px_rgb(0_0_0/0.35)]' : 'bg-dialog/95 shadow-[0_30px_80px_rgb(0_0_0/0.35)] backdrop-blur-xl'
          }`}
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)', contain: 'layout paint' }}
        >
          <div className="mb-1 flex items-start justify-between gap-3">
            <div>
              <p id={titleId} className="font-display text-xl leading-tight">Throw some paint</p>
              <p className="mt-1 text-[12px] leading-snug text-parchment/65">Tap a drop, drag one onto the page, or spin the wheel.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-parchment/15 text-parchment/70 transition-colors hover:text-parchment">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mx-auto my-3" style={{ width: RING, height: RING }}>
            {/* the pointer: whatever lands under it wins */}
            <span data-pointer aria-hidden="true" className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2 text-lg leading-none text-parchment">▼</span>
            <div ref={wheel} className="absolute inset-0" style={{ touchAction: 'none', willChange: 'transform' }}>
              {/* the spin surface */}
              <div
                data-spin
                aria-hidden="true"
                className="absolute inset-0 cursor-grab rounded-full border border-dashed border-parchment/20 active:cursor-grabbing"
                style={{ background: conic }}
              />
              <div role="radiogroup" aria-label="Paint colours">
                {PAINTS.map((p, i) => {
                  const on = i === active
                  const c = shades[i]
                  return (
                    <button
                      key={p.id}
                      ref={(el) => { dropRefs.current[i] = el }}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${p.name}: ${p.vibe}`}
                      title={`${p.name} · ${p.vibe}`}
                      tabIndex={i === focus ? 0 : -1}
                      onPointerDown={(e) => startGlob(e, i)}
                      onClick={(e) => {
                        if (suppressClick.current) { suppressClick.current = false; return }
                        showFocus(i)
                        throwFrom(i, e.currentTarget)
                      }}
                      onKeyDown={(e) => onDropKey(e, i)}
                      className="absolute left-1/2 top-1/2 z-10 -ml-[22px] -mt-[22px] h-11 w-11 outline-none focus-visible:ring-4 focus-visible:ring-parchment/40"
                      style={{
                        transform: `translate(${dropX(i)}px, ${dropY(i)}px)`,
                        background: `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.55), transparent 42%), ${c}`,
                        boxShadow: on
                          ? `0 0 0 3px rgb(var(--dialog-rgb)), 0 0 0 6px ${c}${lite ? '' : `, 0 8px 24px ${alpha(c, 0.5)}`}`
                          : lite ? 'none' : `0 6px 16px ${alpha(c, 0.35)}`,
                        borderRadius: '50% 50% 50% 50% / 58% 58% 42% 42%',
                        touchAction: 'none',
                      }}
                    />
                  )
                })}
              </div>
            </div>
            {/* the hub: the colour under the pointer, and the dice */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-parchment/10 bg-dialog text-center shadow-inner">
              <span className="font-display text-[15px] leading-tight" style={{ color: shades[focus] ?? shown.hex }}>{shown.name}</span>
              <span className="mt-0.5 px-2 text-[10px] leading-tight text-parchment/65">{shown.vibe}</span>
              <button type="button" onClick={roll} className="pointer-events-auto mt-1.5 inline-flex items-center gap-1 rounded-full border border-parchment/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-parchment/75 transition hover:border-parchment hover:text-parchment" aria-label="Surprise me: spin the wheel">
                <Dices className="h-3 w-3" aria-hidden="true" /> Spin
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-parchment/65">Light or dark? The theme switch keeps working with every colour. Fine-tune in Settings → Accent.</p>
        </div>,
        document.body,
      )}
    </>
  )
}
