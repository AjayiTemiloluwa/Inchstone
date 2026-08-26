'use client'

/**
 * Lightweight canvas confetti burst — gold/moss/parchment palette.
 * Self-contained: creates an overlay canvas, animates once, removes itself.
 */

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number; rot: number; vr: number
  color: string; shape: 0 | 1
}

export function fireConfetti(x = window.innerWidth / 2, y = window.innerHeight / 2.4) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const COLORS = ['#b8935a', '#d4af37', '#cbaa6f', '#7fa871', '#f3efe6', '#8fa3bf']
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;'
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const W = window.innerWidth
  const H = window.innerHeight
  const parts: Particle[] = Array.from({ length: 90 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 5 + Math.random() * 8
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() > 0.4 ? 0 : 1,
    }
  })

  const t0 = performance.now()
  const DURATION = 1700

  const frame = (t: number) => {
    const p = (t - t0) / DURATION
    ctx.clearRect(0, 0, W, H)
    if (p >= 1) { canvas.remove(); return }

    ctx.globalAlpha = 1 - p * p
    for (const pt of parts) {
      pt.vy += 0.28            // gravity
      pt.vx *= 0.985           // drag
      pt.vy *= 0.985
      pt.x += pt.vx
      pt.y += pt.vy
      pt.rot += pt.vr

      ctx.save()
      ctx.translate(pt.x, pt.y)
      ctx.rotate(pt.rot)
      ctx.fillStyle = pt.color
      if (pt.shape === 0) {
        ctx.fillRect(-pt.size / 2, -pt.size / 4, pt.size, pt.size / 2)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, pt.size / 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}