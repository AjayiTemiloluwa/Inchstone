'use client'

import {
  useEffect,
  useRef,
  useState,
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

   Both are pointer-fine only and fully disabled for reduced-motion.
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
  const [, setReady] = useState(false)

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
    setReady(true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [text])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    springs.current = Array.from({ length: text.length }, () => ({ x: 0, y: 0, r: 0 }))

    const onMove = (e: PointerEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0
    const tick = () => {
      const wrap = wrapRef.current
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
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      charRefs.current.forEach(el => { if (el) el.style.transform = '' })
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