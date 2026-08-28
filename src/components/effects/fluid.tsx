'use client'

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'

/* ────────────────────────────────────────────────────────────────
   Fluid & float motion kit — the dion-style "everything levitates
   and text ripples away from your cursor" layer.

   · <Float>     wraps any block in a slow, staggered levitation loop
   · <FluidText> splits text into characters that are pushed away
                 from the pointer by a springy, lagging force — the
                 ripple reads across neighbours because the falloff
                 is spatial, so nearby glyphs move more than far ones

   Follows the mouse on pointer-fine devices AND the finger on touch
   devices — touch-dragging (which is how mobile scrolls) parts the
   glyphs exactly like the cursor does, and they spring back on lift.
   ──────────────────────────────────────────────────────────────── */

export function Float({
  children,
  className = '',
  delay = 0,
  duration = 8,
  amp = 6,
  rotate = 0,
}: {
  children: ReactNode
  className?: string
  /** s before the bob starts */
  delay?: number
  /** s per full up-down cycle */
  duration?: number
  /** total px of vertical travel */
  amp?: number
  /** deg of tilt at the extremes */
  rotate?: number
}) {
  const style: CSSProperties = {
    ['--float-delay' as never]: `${delay}s`,
    ['--float-dur' as never]: `${duration}s`,
    ['--float-amp' as never]: `${amp}px`,
    ['--float-rot' as never]: `${rotate}deg`,
  }
  return (
    <div className={`floaty ${className}`} style={style}>
      {children}
    </div>
  )
}

export function FluidText({
  text,
  className = '',
  strength = 18,
  radius = 140,
}: {
  text: string
  className?: string
  /** max px a glyph can be pushed */
  strength?: number
  /** px falloff around the cursor */
  radius?: number
}) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const charRefs = useRef<(HTMLSpanElement | null)[]>([])
  const offsets = useRef<{ cx: number; cy: number }[]>([])
  const springs = useRef<{ x: number; y: number; r: number }[]>([])
  const mouse = useRef({ x: -9999, y: -9999 })

  // Glyph centers relative to the wrapper — stable across scroll, so we
  // measure once (and on resize/fonts) instead of every frame.
  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current
      if (!wrap) return
      const wr = wrap.getBoundingClientRect()
      offsets.current = charRefs.current.map(el => {
        if (!el) return { cx: 0, cy: 0 }
        const r = el.getBoundingClientRect()
        return { cx: r.left - wr.left + r.width / 2, cy: r.top - wr.top + r.height / 2 }
      })
    }
    measure()
    const t = window.setTimeout(measure, 400) // after webfonts settle
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [text])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    springs.current = Array.from({ length: text.length }, () => ({ x: 0, y: 0, r: 0 }))

    const REST_EPSILON = 0.05 // px — springs closer than this to target are "at rest"

    let raf = 0
    let running = false

    const tick = () => {
      const wrap = wrapRef.current
      let settled = true
      if (wrap && springs.current.length === text.length) {
        const wr = wrap.getBoundingClientRect()
        for (let i = 0; i < text.length; i++) {
          const st = springs.current[i]
          const off = offsets.current[i]
          const el = charRefs.current[i]
          if (!st || !off || !el) continue
          const dx = wr.left + off.cx - mouse.current.x
          const dy = wr.top + off.cy - mouse.current.y
          const dist = Math.hypot(dx, dy)
          const f = Math.max(0, 1 - dist / radius)
          const inv = dist === 0 ? 0 : 1 / dist
          // push away from cursor, lift slightly, tilt with direction
          const tx = dx * inv * f * strength
          const ty = dy * inv * f * strength - f * strength * 0.3
          const tr = dx * inv * f * 9
          st.x += (tx - st.x) * 0.13
          st.y += (ty - st.y) * 0.13
          st.r += (tr - st.r) * 0.13
          el.style.transform = `translate(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px) rotate(${st.r.toFixed(2)}deg)`
          if (
            Math.abs(st.x - tx) > REST_EPSILON ||
            Math.abs(st.y - ty) > REST_EPSILON ||
            Math.abs(st.r - tr) > REST_EPSILON
          ) {
            settled = false
          }
        }
      }
      // Sleep once every spring caught up with its target — the next
      // pointer/touch/scroll event wakes it (battery & CPU friendly).
      if (settled) {
        running = false
        return
      }
      raf = requestAnimationFrame(tick)
    }

    const wake = () => {
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    const onMove = (e: PointerEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
      wake()
    }

    // Touch: the finger replaces the cursor. While dragging (how mobile
    // scrolls) the glyphs part around the touch point exactly as they do
    // around the mouse; on lift the pointer is parked far away so the
    // glyphs relax back into place.
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      mouse.current.x = t.clientX
      mouse.current.y = t.clientY
      wake()
    }
    const onTouchEnd = () => {
      mouse.current.x = -9999
      mouse.current.y = -9999
      wake()
    }

    // Scrolling slides the page under a stationary cursor/finger — wake so
    // the ripple tracks the viewport shift (glyph centers move, the stored
    // pointer doesn't).
    const onScroll = () => {
      if (mouse.current.x > -1000) wake()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    const chars = charRefs.current
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('scroll', onScroll)
      chars.forEach(el => { if (el) el.style.transform = '' })
    }
  }, [text, radius, strength])

  return (
    <span ref={wrapRef} className={className} aria-label={text} role="text">
      {text.split('').map((ch, i) =>
        ch === ' ' ? (
          <span key={i}> </span>
        ) : (
          <span
            key={`${i}-${ch}`}
            ref={el => { charRefs.current[i] = el }}
            aria-hidden="true"
            className="inline-block will-change-transform"
          >
            {ch}
          </span>
        ),
      )}
    </span>
  )
}