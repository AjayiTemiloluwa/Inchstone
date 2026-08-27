'use client'

import { useEffect } from 'react'

/**
 * TouchFx — mobile/coarse-pointer reactivity layer.
 *
 * Where ScrollFx handles desktop (hover/tilt/spotlight/parallax), this
 * handles touch devices: every tap spawns a soft gold ripple ring, dragging
 * (including the scroll drag) streams a light trail of ripples, the text
 * nearest the touch briefly brightens, and the ambient sky fires a glow
 * burst at that point (see AmbientBackground's 'inchstone:touch' listener).
 *
 * Fully disabled for prefers-reduced-motion.
 */
export function TouchFx() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    // Touch-only. Desktop keeps ScrollFx (spotlight/tilt/parallax).
    if (!window.matchMedia('(pointer: coarse)').matches) return

    const host = document.createElement('div')
    host.className = 'touchfx-layer'
    host.setAttribute('aria-hidden', 'true')
    document.body.appendChild(host)

    let lastStream = 0
    let activeTouchId: number | null = null

    // Spawn a layered ripple: a soft filled bloom + an expanding ring. The
    // bloom tints the surface beneath the finger so the effect reads over the
    // dark UI, while the ring gives it the familiar "touch" shape.
    const spawn = (x: number, y: number, size: number, stream = false) => {
      const layer = document.createElement('div')
      layer.className = 'touch-ripple'
      layer.style.left = `${x}px`
      layer.style.top = `${y}px`
      layer.style.width = `${size}px`
      layer.style.height = `${size}px`
      if (stream) layer.classList.add('touch-ripple--stream')
      host.appendChild(layer)

      const bloom = document.createElement('div')
      bloom.className = 'touch-ripple-bloom'
      bloom.style.left = `${x}px`
      bloom.style.top = `${y}px`
      const bloomSize = Math.round(size * 0.66)
      bloom.style.width = `${bloomSize}px`
      bloom.style.height = `${bloomSize}px`
      if (stream) bloom.classList.add('touch-ripple-bloom--stream')
      layer.appendChild(bloom)

      const done = () => {
        layer.remove()
        layer.removeEventListener('animationend', done)
        bloom.removeEventListener('animationend', done)
      }
      layer.addEventListener('animationend', done)
      bloom.addEventListener('animationend', done)

      // Ambient sky glow burst at this point.
      window.dispatchEvent(new CustomEvent('inchstone:touch', { detail: { x, y } }))

      // Briefly brighten the nearest text block.
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      const text = el?.closest?.(
        'h1,h2,h3,h4,h5,p,li,blockquote,figcaption,.scroll-text,[data-reveal-text],[data-touch-text]'
      ) as HTMLElement | null
      if (text && !text.closest('[data-noreveal]')) {
        text.classList.add('touch-pulse')
        window.setTimeout(() => text.classList.remove('touch-pulse'), 450)
      }
    }

    // Tap → single, slightly larger ripple. Drag / scroll → trail of smaller
    // ripples. This layer only mounts on coarse (touch) pointers, where a
    // native scroll fires pointercancel and stops pointermove — so we drive
    // the scroll trail from touchstart/touchmove, and keep pointerdown for
    // crisp tap ripples (pointerdown always fires on touch taps).
    const onDown = (e: PointerEvent | TouchEvent) => {
      if ('touches' in e) {
        if (e.touches[0]) activeTouchId = e.touches[0].identifier
        return // touchstart only tracks the finger; the tap ripple comes from pointerdown
      }
      lastStream = Date.now()
      spawn(e.clientX, e.clientY, 88)
    }
    const onMove = (e: PointerEvent | TouchEvent) => {
      const touch = 'touches' in e ? Array.from(e.touches).find(t => t.identifier === activeTouchId) : null
      const x = touch ? touch.clientX : (e as PointerEvent).clientX
      const y = touch ? touch.clientY : (e as PointerEvent).clientY
      const now = Date.now()
      if (now - lastStream < 90) return
      lastStream = now
      spawn(x, y, 40, true)
    }
    const onEnd = (e: PointerEvent | TouchEvent) => {
      if ('touches' in e) {
        const stillActive = Array.from(e.touches).some(t => t.identifier === activeTouchId)
        if (!stillActive) activeTouchId = null
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