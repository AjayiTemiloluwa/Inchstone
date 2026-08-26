'use client'

import { useEffect, useRef } from 'react'

/**
 * CursorGlow — casts a soft pool of warm light that follows the pointer.
 *
 * UX design notes:
 * - Two layers: a wide ambient halo (slow, weighty trail) and a small hot core
 *   (snappy follow) so the light feels physical rather than glued to the cursor.
 * - `mix-blend-mode: screen` brightens the surface beneath it, so it reads as
 *   light cast onto the dark UI while text stays fully legible.
 * - `pointer-events: none` + `aria-hidden` — purely decorative, never intercepts
 *   clicks, hover states or text selection.
 * - Disabled on touch-only devices (`hover: none` / `pointer: coarse`) and when
 *   the user prefers reduced motion.
 * - The rAF loop goes to sleep once the light settles on its target (battery/CPU
 *   friendly) and wakes on the next pointer event.
 * - Fades out when the pointer leaves the window or the tab loses focus.
 */
export function CursorGlow() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const haloRef = useRef<HTMLDivElement | null>(null)
  const coreRef = useRef<HTMLDivElement | null>(null)
  const labelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const halo = haloRef.current
    const core = coreRef.current
    if (!root || !halo || !core) return

    // Only enable where a fine, hover-capable pointer exists (mouse / trackpad).
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const HALO_EASE = 0.09 // slow trail — the "cast" feeling
    const CORE_EASE = 0.26 // snappier follow for responsiveness
    const REST_EPSILON = 0.15 // px distance at which the loop may sleep
    const PRESS_SCALE = 0.92

    let raf = 0
    let running = false
    let active = false
    let pressing = false
    let scale = 1
    let hovering = false
    let hoverScale = 1

    // Start off-screen; snapped onto the cursor on first movement.
    const target = { x: -2000, y: -2000 }
    const haloPos = { x: -2000, y: -2000 }
    const corePos = { x: -2000, y: -2000 }

    const tick = () => {
      haloPos.x += (target.x - haloPos.x) * HALO_EASE
      haloPos.y += (target.y - haloPos.y) * HALO_EASE
      corePos.x += (target.x - corePos.x) * CORE_EASE
      corePos.y += (target.y - corePos.y) * CORE_EASE

      scale += ((pressing ? PRESS_SCALE : 1) - scale) * 0.18
      hoverScale += ((hovering ? 1.55 : 1) - hoverScale) * 0.16

      halo.style.transform = `translate3d(${haloPos.x}px, ${haloPos.y}px, 0) translate(-50%, -50%) scale(${scale})`
      core.style.transform = `translate3d(${corePos.x}px, ${corePos.y}px, 0) translate(-50%, -50%) scale(${scale * hoverScale})`
      if (labelRef.current) {
        labelRef.current.style.transform = `translate3d(${corePos.x}px, ${corePos.y + 26}px, 0) translate(-50%, 0)`
      }

      const settled =
        Math.abs(target.x - haloPos.x) < REST_EPSILON &&
        Math.abs(target.y - haloPos.y) < REST_EPSILON &&
        Math.abs(target.x - corePos.x) < REST_EPSILON &&
        Math.abs(target.y - corePos.y) < REST_EPSILON &&
        Math.abs(scale - (pressing ? PRESS_SCALE : 1)) < 0.004

      if (settled && !pressing) {
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

    const show = () => {
      if (!active) {
        active = true
        root.classList.add('is-active')
      }
    }

    const hide = () => {
      active = false
      root.classList.remove('is-active')
    }

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      // First appearance: place the light under the cursor instead of gliding in
      if (haloPos.x < -1000) {
        haloPos.x = target.x
        haloPos.y = target.y
        corePos.x = target.x
        corePos.y = target.y
      }
      show()
      wake()
    }

    const onDown = () => { pressing = true; wake() }
    const onUp = () => { pressing = false; wake() }
    const onLeaveWindow = () => hide()

    // Interactive-element awareness: grow the core over anything clickable,
    // and surface an optional data-cursor="…" label beneath it.
    const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, summary, [data-cursor]'
    const onOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      const hit = target?.closest?.(INTERACTIVE) as HTMLElement | null
      hovering = !!hit
      const label = hit?.getAttribute('data-cursor') || ''
      if (labelRef.current) {
        labelRef.current.textContent = label
        labelRef.current.style.opacity = label ? '1' : '0'
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeaveWindow)
    window.addEventListener('blur', onLeaveWindow)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointerover', onOver)
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow)
      window.removeEventListener('blur', onLeaveWindow)
    }
  }, [])

  return (
    <div ref={rootRef} className="cursor-glow" aria-hidden="true">
      <div ref={haloRef} className="cursor-glow-halo" />
      <div ref={coreRef} className="cursor-glow-core" />
      <div ref={labelRef} className="cursor-glow-label" />
    </div>
  )
}
