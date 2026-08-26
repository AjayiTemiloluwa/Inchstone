'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'

/* ────────────────────────────────────────────────────────────
   Motion toolkit — small dependency-free primitives used across
   Inchstone for count-ups, reveals, marquees and magnetic hovers.
   All respect prefers-reduced-motion via CSS + early no-ops.
   ──────────────────────────────────────────────────────────── */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Fires once when the element first enters the viewport. */
export function useInViewOnce<T extends HTMLElement>(rootMargin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView, rootMargin])

  return { ref, inView }
}

/**
 * Tweened number display. Animates from the previous value to the new one,
 * and waits to be in view before its first run.
 */
export function CountUp({
  value,
  duration = 900,
  format = (n: number) => String(Math.round(n)),
  className = '',
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const { ref, inView } = useInViewOnce<HTMLSpanElement>()
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion()) { setDisplay(value); return }

    const from = fromRef.current
    const delta = value - from
    if (Math.abs(delta) < 0.005) { setDisplay(value); fromRef.current = value; return }

    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + delta * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, inView, duration])

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(display)}
    </span>
  )
}

/** Splits text into words that rise into place once in view. */
export function WordReveal({
  text,
  className = '',
  stagger = 55,
}: {
  text: string
  className?: string
  stagger?: number
}) {
  const { ref, inView } = useInViewOnce<HTMLSpanElement>()
  const words = text.split(/\s+/)

  return (
    <span ref={ref} className={`word-reveal ${inView ? 'in' : ''} ${className}`}>
      {words.map((w, i) => (
        <span key={i} aria-hidden={false}>
          <span className="w" style={{ transitionDelay: `${i * stagger}ms` }}>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}

/** Fades/rises children into place once in view. */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: React.ElementType
}) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>()
  const Component = Tag as React.ElementType
  return (
    <Component
      ref={ref}
      className={`reveal ${inView ? 'in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Component>
  )
}

/** Infinite horizontal ticker. Content is duplicated for a seamless loop. */
export function Marquee({
  children,
  duration = 28,
  reverse = false,
  className = '',
}: {
  children: React.ReactNode
  duration?: number
  reverse?: boolean
  className?: string
}) {
  return (
    <div className={`marquee ${className}`} aria-hidden="true">
      <div
        className="marquee-track"
        style={{
          ['--marquee-duration' as string]: `${duration}s`,
          animationDirection: reverse ? 'reverse' : undefined,
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center">{children}</div>
      </div>
    </div>
  )
}

/** Cycles through words with a vertical roll, like a split-flap display. */
export function WordRotator({
  words,
  interval = 2400,
  className = '',
}: {
  words: string[]
  interval?: number
  className?: string
}) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion() || words.length < 2) return
    const id = window.setInterval(() => setIdxSafe(), interval)
    const setIdxSafe = () => setI(v => (v + 1) % words.length)
    return () => window.clearInterval(id)
  }, [words.length, interval])

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '')

  return (
    <span
      className={`relative inline-block overflow-hidden align-bottom ${className}`}
      style={{ width: `${longest.length}ch` }}
    >
      {words.map((w, wi) => (
        <span
          key={w}
          aria-hidden={wi !== i}
          className="transition-all duration-500"
          style={{
            transform: `translateY(${(wi - i) * 100}%)`,
            opacity: wi === i ? 1 : 0,
            position: wi === i ? 'static' : 'absolute',
            left: 0,
          }}
        >
          {w}
        </span>
      ))}
    </span>
  )
}

/** Gently pulls its child toward the pointer (magnetic hover). */
export function Magnetic({
  children,
  strength = 0.25,
  maxShift = 8,
  className = '',
}: {
  children: React.ReactNode
  strength?: number
  maxShift?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const raf = useRef(0)

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const rect = el.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `translate3d(${clamp(dx * strength, maxShift)}px, ${clamp(dy * strength, maxShift)}px, 0)`
    })
  }, [strength, maxShift])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(raf.current)
    el.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
    el.style.transform = 'translate3d(0,0,0)'
    window.setTimeout(() => { if (el) el.style.transition = '' }, 420)
  }, [])

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`inline-block will-change-transform ${className}`}>
      {children}
    </div>
  )
}

function clamp(v: number, m: number) {
  return Math.max(-m, Math.min(m, v))
}

/** 3D tilt that follows the pointer, springing back on leave. */
export function Tilt({
  children,
  max = 7,
  scale = 1.02,
  className = '',
}: {
  children: React.ReactNode
  max?: number
  scale?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const raf = useRef(0)

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${clamp(-py * 2 * max, max)}deg) rotateY(${clamp(px * 2 * max, max)}deg) scale(${scale})`
    })
  }, [max, scale])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(raf.current)
    el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    window.setTimeout(() => { if (el) el.style.transition = '' }, 520)
  }, [])

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`will-change-transform ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  )
}

/** Decoding/scramble text effect — resolves left→right once in view. */
const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#________'
export function Scramble({
  text,
  speed = 28,
  className = '',
  mono = true,
}: {
  text: string
  speed?: number
  className?: string
  mono?: boolean
}) {
  const { ref, inView } = useInViewOnce<HTMLSpanElement>()
  const [out, setOut] = useState(text)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion()) { setOut(text); return }

    let frame = 0
    let raf = 0
    let last = 0
    const queue = text.split('').map((ch, i) => ({
      ch,
      start: i * 2,
      end: i * 2 + 8 + Math.floor(Math.random() * 12),
    }))

    const tick = (t: number) => {
      if (t - last < speed) { raf = requestAnimationFrame(tick); return }
      last = t
      frame++
      let done = 0
      const next = queue.map(q => {
        if (frame >= q.end) { done++; return q.ch }
        if (frame < q.start) return ''
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
      }).join('')
      setOut(next)
      if (done < queue.length) raf = requestAnimationFrame(tick)
      else setOut(text)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, text, speed])

  return (
    <span ref={ref} aria-label={text} className={`inline-block ${mono ? 'font-mono' : ''} ${className}`}>
      {out}
    </span>
  )
}

/** Standardized section header: emoji + decoding title + optional right-side actions. */
export function SectionHeading({
  icon,
  text,
  right,
  className = '',
}: {
  icon?: string
  text: string
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-end justify-between gap-3 flex-wrap ${className}`}>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <Scramble text={text} />
      </h2>
      {right}
    </div>
  )
}

/**
 * Parallax drift based on element's viewport progress.
 * speed > 0 moves up as you scroll down; negative moves with you.
 */
export function useScrollParallax<T extends HTMLElement>(speed = 0.15) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      if (rect.bottom < -200 || rect.top > vh + 200) return
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh // ~[-1, 1]
      el.style.transform = `translate3d(0, ${(-progress * speed * 100).toFixed(1)}px, 0)`
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [speed])

  return ref
}