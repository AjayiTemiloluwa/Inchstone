'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Thin gold progress bar pinned to the top of the viewport.
 * Runs on every route change: quick fill → complete → fade out.
 */
export function RouteProgress() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle')

  useEffect(() => {
    setPhase('run')
    const done = window.setTimeout(() => setPhase('done'), 420)
    const idle = window.setTimeout(() => setPhase('idle'), 900)
    return () => { window.clearTimeout(done); window.clearTimeout(idle) }
  }, [pathname])

  const width = phase === 'run' ? '82%' : phase === 'done' ? '100%' : '0%'
  const opacity = phase === 'idle' ? 0 : 1

  return (
    <div className="fixed top-0 left-0 right-0 z-[80] pointer-events-none" aria-hidden="true">
      <div
        className="h-[2px] bg-gradient-to-r from-gold-dim via-gold to-gold-glow"
        style={{ width, opacity, transition: 'width 0.42s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease' }}
      />
    </div>
  )
}