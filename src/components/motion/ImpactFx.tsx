'use client'

import { useEffect } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

/**
 * ImpactFx — every click detonates, and never the same way twice in a row.
 *
 * Mouse / trackpad only (phones already get TouchFx's tap shockwave). A click on anything you can
 * press — buttons, links, cards, checkboxes — fires one of six bursts in the mood's own colours,
 * taken in turn so consecutive clicks always differ:
 *
 *   nova       sparks fly out in a ring and fade
 *   shards     glass-like triangles spin away under gravity
 *   shockwave  two rings race outward, the second a beat behind
 *   stars      ✦ stars scatter and twinkle out
 *   confetti   small ribbons pop up and tumble down
 *   vortex     dots spiral out from the point of the click
 *
 * Pure decoration: drawn in a fixed, pointer-transparent layer, removed when done.
 * Disabled for prefers-reduced-motion.
 */

const PRESSABLE = 'button, a[href], [role="button"], [role="checkbox"], [role="radio"], [role="tab"], .card, .glass, .glass-gold, [data-fx], label'
const SKIP = 'input, textarea, select, [contenteditable="true"], [data-no-impact]'

const COLOR_VARS = ['--gold-rgb', '--gold-glow-rgb', '--volt-rgb', '--ember-rgb', '--moss-rgb', '--hue-sky-rgb', '--hue-rose-rgb', '--hue-amber-rgb']

type Burst = (layer: HTMLElement, x: number, y: number, colors: string[]) => void

const dot = (layer: HTMLElement, x: number, y: number, size: number, color: string, extra: Partial<CSSStyleDeclaration> = {}) => {
  const d = document.createElement('div')
  Object.assign(d.style, {
    position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`,
    marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`, borderRadius: '999px', background: color,
    boxShadow: `0 0 ${size * 2}px ${color}`, pointerEvents: 'none', willChange: 'transform, opacity',
  }, extra)
  layer.appendChild(d)
  return d
}
const done = (nodes: Element[]) => () => nodes.forEach((n) => n.remove())
const R = gsap.utils.random
const pickColor = (colors: string[]) => colors[Math.floor(Math.random() * colors.length)]

const BURSTS: Burst[] = [
  // nova
  (layer, x, y, colors) => {
    const n = 14
    const parts = Array.from({ length: n }, () => dot(layer, x, y, R(4, 7), pickColor(colors)))
    gsap.to(parts, {
      x: (i) => Math.cos((i / n) * Math.PI * 2) * R(60, 110),
      y: (i) => Math.sin((i / n) * Math.PI * 2) * R(60, 110),
      scale: 0, opacity: 0, duration: R(0.6, 0.9), ease: 'expo.out', onComplete: done(parts),
    })
    const flash = dot(layer, x, y, 26, colors[0], { opacity: '0.9' })
    gsap.to(flash, { scale: 2.6, opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: done([flash]) })
  },
  // shards
  (layer, x, y, colors) => {
    const parts = Array.from({ length: 10 }, () => {
      const s = dot(layer, x, y, R(8, 14), pickColor(colors), { borderRadius: '0', clipPath: 'polygon(50% 0, 100% 100%, 0 100%)', boxShadow: 'none' })
      return s
    })
    gsap.to(parts, {
      x: () => R(-130, 130), y: () => R(-150, -40), rotation: () => R(-540, 540), duration: 0.5, ease: 'power3.out',
    })
    gsap.to(parts, { y: '+=180', opacity: 0, duration: 0.7, delay: 0.35, ease: 'power2.in', onComplete: done(parts) })
  },
  // shockwave
  (layer, x, y, colors) => {
    const rings = [0, 1].map((i) => dot(layer, x, y, 20, 'transparent', { border: `2px solid ${colors[i] ?? colors[0]}`, boxShadow: `0 0 18px ${colors[i] ?? colors[0]}` }))
    gsap.to(rings, { scale: (i) => (i ? 9 : 6), opacity: 0, borderWidth: 0.5, duration: (i) => (i ? 0.9 : 0.7), delay: (i) => i * 0.1, ease: 'expo.out', onComplete: done(rings) })
  },
  // stars
  (layer, x, y, colors) => {
    const parts = Array.from({ length: 9 }, () => {
      const s = dot(layer, x, y, 16, 'transparent', { boxShadow: 'none', color: pickColor(colors), fontSize: `${R(12, 22)}px`, lineHeight: '16px', textAlign: 'center', textShadow: '0 0 10px currentColor' })
      s.textContent = '✦'
      return s
    })
    gsap.fromTo(parts, { scale: 0, rotation: 0 }, {
      x: () => R(-110, 110), y: () => R(-110, 110), scale: () => R(0.8, 1.6), rotation: () => R(-200, 200), duration: 0.55, ease: 'back.out(2)',
    })
    gsap.to(parts, { scale: 0, opacity: 0, duration: 0.4, delay: 0.5, stagger: 0.03, ease: 'power2.in', onComplete: done(parts) })
  },
  // confetti
  (layer, x, y, colors) => {
    const parts = Array.from({ length: 18 }, () => dot(layer, x, y, 8, pickColor(colors), { width: '6px', height: '11px', borderRadius: '2px', boxShadow: 'none' }))
    gsap.to(parts, { x: () => R(-120, 120), y: () => R(-170, -70), rotation: () => R(-360, 360), rotationX: () => R(-360, 360), duration: 0.55, ease: 'power3.out' })
    gsap.to(parts, { y: '+=220', x: () => `+=${R(-40, 40)}`, opacity: 0, duration: 0.9, delay: 0.45, ease: 'power1.in', onComplete: done(parts) })
  },
  // vortex
  (layer, x, y, colors) => {
    const n = 16
    const parts = Array.from({ length: n }, () => dot(layer, x, y, R(3, 6), pickColor(colors)))
    const state = parts.map(() => ({ a: R(0, Math.PI * 2), r: 0 }))
    gsap.to(state, {
      a: (i: number) => state[i].a + Math.PI * R(1.5, 2.5), r: () => R(70, 120), duration: 0.9, ease: 'power3.out',
      onUpdate: () => parts.forEach((p, i) => gsap.set(p, { x: Math.cos(state[i].a) * state[i].r, y: Math.sin(state[i].a) * state[i].r })),
    })
    gsap.to(parts, { opacity: 0, scale: 0.2, duration: 0.5, delay: 0.5, onComplete: done(parts) })
  },
]

export function ImpactFx() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const layer = document.createElement('div')
    layer.setAttribute('aria-hidden', 'true')
    Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '130', overflow: 'hidden' })
    document.body.appendChild(layer)

    let turn = Math.floor(Math.random() * BURSTS.length)
    const css = () => getComputedStyle(document.documentElement)
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType === 'touch') return
      const t = e.target as Element | null
      if (!t?.closest || t.closest(SKIP) || !t.closest(PRESSABLE)) return
      if (layer.childElementCount > 160) return // a frantic clicker never floods the page
      const s = css()
      const colors = COLOR_VARS.map((v) => s.getPropertyValue(v).trim()).filter(Boolean).map((v) => `rgb(${v})`)
      if (!colors.length) return
      BURSTS[turn % BURSTS.length](layer, e.clientX, e.clientY, colors)
      turn++
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown)
      layer.remove()
    }
  }, [])
  return null
}
