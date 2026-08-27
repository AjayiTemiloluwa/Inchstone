'use client'

import { useEffect } from 'react'

/**
 * TouchFx — mobile/coarse-pointer reactivity layer.
 *
 * Every tap detonates a layered shockwave: a soft radial halo, a hot core
 * flash, a gold ring with a delayed ember echo, and six sparks flung
 * outward. Dragging (scroll swipes) streams comet streaks aligned to the
 * swipe vector, the nearest text brightens, and the ambient sky fires a
 * glow burst ('inchstone:touch' → AmbientBackground).
 *
 * Fully disabled for prefers-reduced-motion.
 */
export function TouchFx() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: coarse)').matches) return

    const host = document.createElement('div')
    host.className = 'touchfx-layer'
    host.setAttribute('aria-hidden', 'true')
    document.body.appendChild(host)

    let lastStream = 0
    let lastX = 0
    let lastY = 0
    let activeTouchId: number | null = null

    const el = (cls: string, x: number, y: number, size: number) => {
      const n = document.createElement('div')
      n.className = cls
      n.style.left = `${x}px`
      n.style.top = `${y}px`
      if (size) {
        n.style.width = `${size}px`
        n.style.height = `${size}px`
      }
      return n
    }

    const kill = (n: HTMLElement) =>
      n.addEventListener('animationend', () => n.remove(), { once: true })

    /** Grand tap: halo + ring + echo ring + bloom + sparks. */
    const shockwave = (x: number, y: number) => {
      const size = 120
      const wrap = document.createElement('div')
      wrap.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;`

      const halo = el('touch-halo', x, y, 240)
      const ring = el('touch-ripple', x, y, size)
      const echo = el('touch-ripple touch-ripple--echo', x, y, Math.round(size * 1.25))
      const bloom = el('touch-ripple-bloom', x, y, Math.round(size * 0.7))
      ;[halo, ring, echo, bloom].forEach(n => {
        kill(n)
        wrap.appendChild(n)
      })

      // Six sparks in a fan — mixed gold/ember embers.
      const count = 6
      const base = Math.random() * Math.PI * 2
      for (let i = 0; i < count; i++) {
        const a = base + (i / count) * Math.PI * 2 + Math.random() * 0.5
        const d = 26 + Math.random() * 30
        const s = el(`touch-spark${i % 3 === 2 ? ' touch-spark--ember' : ''}`, x, y, 0)
        s.style.setProperty('--dx', `${Math.cos(a) * d}px`)
        s.style.setProperty('--dy', `${Math.sin(a) * d}px`)
        kill(s)
        wrap.appendChild(s)
      }

      host.appendChild(wrap)
      window.setTimeout(() => wrap.remove(), 1300)
    }

    /** Scroll/drag: comet streak pointing along the movement vector. */
    const streak = (x: number, y: number, ang: number, speed: number) => {
      const len = Math.min(30 + speed * 0.28, 90)
      const n = el('touch-streak', x, y, 0)
      n.style.width = `${len}px`
      n.style.setProperty('--ang', `${ang}rad`)
      kill(n)
      host.appendChild(n)
    }

    const pulseText = (x: number, y: number) => {
      const target = document.elementFromPoint(x, y) as HTMLElement | null
      const text = target?.closest?.(
        'h1,h2,h3,h4,h5,p,li,blockquote,figcaption,.scroll-text,[data-reveal-text],[data-touch-text]'
      ) as HTMLElement | null
      if (text && !text.closest('[data-noreveal]')) {
        text.classList.add('touch-pulse')
        window.setTimeout(() => text.classList.remove('touch-pulse'), 450)
      }
    }

    const onDown = (e: PointerEvent | TouchEvent) => {
      if ('touches' in e) {
        const t = e.touches[0]
        if (t) {
          activeTouchId = t.identifier
          lastX = t.clientX
          lastY = t.clientY
        }
        return
      }
      lastX = e.clientX
      lastY = e.clientY
      shockwave(e.clientX, e.clientY)
      pulseText(e.clientX, e.clientY)
      window.dispatchEvent(new CustomEvent('inchstone:touch', { detail: { x: e.clientX, y: e.clientY } }))
    }

    const onMove = (e: PointerEvent | TouchEvent) => {
      const t =
        'touches' in e
          ? Array.from(e.touches).find(t => t.identifier === activeTouchId)
          : (e as PointerEvent)
      if (!t) return
      const x = t.clientX
      const y = t.clientY
      const now = Date.now()
      if (now - lastStream < 70) return
      lastStream = now
      const dx = x - lastX
      const dy = y - lastY
      const speed = Math.hypot(dx, dy)
      if (speed < 2) return
      streak(x, y, Math.atan2(dy, dx), speed)
      if (speed > 34) {
        // Fast flicks also kiss the sky.
        window.dispatchEvent(new CustomEvent('inchstone:touch', { detail: { x, y } }))
      }
      lastX = x
      lastY = y
    }

    const onEnd = (e: PointerEvent | TouchEvent) => {
      if ('touches' in e) {
        const still = Array.from(e.touches).some(t => t.identifier === activeTouchId)
        if (!still) activeTouchId = null
      }
    }

    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    window.addEventListener('pointercancel', onEnd, { passive: true })
    window.addEventListener('pointerup', onEnd, { passive: true })

    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('touchstart', onDown)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('pointerup', onEnd)
      host.remove()
    }
  }, [])

  return null
}
