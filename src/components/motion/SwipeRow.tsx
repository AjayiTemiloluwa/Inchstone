'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Check, PanelRightOpen, RotateCcw } from 'lucide-react'
import { gsap, Draggable, prefersReducedMotion } from '@/lib/gsap'

/**
 * SwipeRow — a list row you can swipe (touch or mouse drag).
 *
 *   swipe right → mark done (or undo, if it is already done): a gold check
 *                 slides in from the left as you drag, and past the line the
 *                 row snaps back with a ring of gold
 *   swipe left  → open its details
 *
 * Short drags spring back; vertical movement stays native scrolling, and a
 * plain tap still reaches the row's own buttons. When `done` turns true
 * (from a swipe or a tap on the checkbox), the row pulses once.
 */
export function SwipeRow({
  children,
  done,
  onComplete,
  onOpen,
  className = '',
}: {
  children: ReactNode
  done: boolean
  onComplete: () => void
  onOpen?: () => void
  className?: string
}) {
  const wrap = useRef<HTMLDivElement | null>(null)
  const card = useRef<HTMLDivElement | null>(null)
  const left = useRef<HTMLDivElement | null>(null)
  const right = useRef<HTMLDivElement | null>(null)
  const was = useRef(done)
  const handlers = useRef({ onComplete, onOpen })
  useEffect(() => {
    handlers.current = { onComplete, onOpen }
  }, [onComplete, onOpen])

  useEffect(() => {
    const el = card.current
    if (!el || prefersReducedMotion()) return
    const width = () => el.offsetWidth || 1
    const d = Draggable.create(el, {
      type: 'x',
      lockAxis: true,
      allowNativeTouchScrolling: true,
      minimumMovement: 8,
      edgeResistance: 0.85,
      bounds: { minX: -width() * 0.5, maxX: width() * 0.5 },
      onDrag() {
        const p = this.x / width()
        gsap.set(left.current, { opacity: Math.min(1, Math.max(0, p * 3.2)) })
        gsap.set(right.current, { opacity: Math.min(1, Math.max(0, -p * 3.2)) })
        gsap.set(left.current?.firstElementChild ?? null, { scale: 0.6 + Math.min(1, p * 3) * 0.5, rotation: -30 + Math.min(1, p * 3) * 30 })
      },
      onRelease() {
        const p = this.x / width()
        if (p > 0.28) handlers.current.onComplete()
        else if (p < -0.28) handlers.current.onOpen?.()
        gsap.to(el, { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.55)' })
        gsap.to([left.current, right.current], { opacity: 0, duration: 0.3 })
      },
    })[0]
    return () => {
      d.kill()
    }
  }, [])

  // the moment it becomes done: one gold ring and a little bounce
  useEffect(() => {
    if (done && !was.current && !prefersReducedMotion() && wrap.current && card.current) {
      const ring = document.createElement('span')
      ring.className = 'swipe-ring'
      wrap.current.appendChild(ring)
      window.setTimeout(() => ring.remove(), 900)
      gsap.fromTo(card.current, { scale: 0.97 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' })
    }
    was.current = done
  }, [done])

  return (
    <div ref={wrap} className={`relative rounded-2xl ${className}`}>
      <div ref={left} className="swipe-under justify-start bg-gold/15 pl-5 opacity-0" aria-hidden="true">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink">
          {done ? <RotateCcw className="h-4 w-4" /> : <Check className="h-5 w-5" />}
        </span>
      </div>
      <div ref={right} className="swipe-under justify-end bg-white/5 pr-5 opacity-0" aria-hidden="true">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-parchment/70">
          Details <PanelRightOpen className="h-4 w-4" />
        </span>
      </div>
      <div ref={card} className="relative touch-pan-y">
        {children}
      </div>
    </div>
  )
}
