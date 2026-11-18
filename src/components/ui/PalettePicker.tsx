'use client'

import { useEffect, useState } from 'react'
import { Check, Zap } from 'lucide-react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { applyAccent } from '@/lib/accent'
import { PALETTES, applyPalette, readPalette, type PaletteId } from '@/lib/palette'

/**
 * PalettePicker — Settings "Colour mood": keep Classic ink & brass, or switch
 * the whole app to an electric mix. Choosing a mood also resets a custom
 * accent, so the mood's own neon shows; the accent picker below can still
 * override it afterwards.
 *
 * The switch plays a short light-sweep over the screen so the change feels
 * like flipping a power switch rather than a flicker.
 */
export function PalettePicker() {
  const [active, setActive] = useState<PaletteId | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setActive(readPalette()))
    return () => cancelAnimationFrame(raf)
  }, [])

  const choose = (id: PaletteId, from: HTMLElement) => {
    if (id === active) return
    setActive(id)
    const swap = () => {
      applyAccent({ kind: 'default' })
      applyPalette(id)
    }
    if (prefersReducedMotion()) return swap()

    // A circle of light grows from the tapped swatch; the colours swap under it.
    const r = from.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const flash = document.createElement('div')
    const tint = PALETTES.find((p) => p.id === id)?.swatch[1] ?? '#ffffff'
    flash.setAttribute('aria-hidden', 'true')
    Object.assign(flash.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      pointerEvents: 'none',
      background: `radial-gradient(circle at ${x}px ${y}px, ${tint} 0%, ${tint}55 40%, transparent 70%)`,
      clipPath: `circle(0px at ${x}px ${y}px)`,
      mixBlendMode: 'screen',
    })
    document.body.appendChild(flash)
    gsap
      .timeline({ onComplete: () => flash.remove() })
      .to(flash, { clipPath: `circle(${radius}px at ${x}px ${y}px)`, duration: 0.45, ease: 'power3.in' })
      .add(swap)
      .to(flash, { opacity: 0, duration: 0.55, ease: 'power2.out' })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-body font-medium text-parchment">
            <Zap className="h-4 w-4 text-gold" strokeWidth={1.75} aria-hidden="true" />
            Colour mood
          </p>
          <p className="text-caption text-parchment/50">Keep the classic ink and brass, or switch the whole app to an electric mix.</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Colour mood" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PALETTES.map((p) => {
          const on = active === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={(e) => choose(p.id, e.currentTarget)}
              className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-[border-color,transform] duration-200 active:scale-[0.97] ${
                on ? 'border-gold/70' : 'border-gold/15 hover:border-gold/40'
              }`}
              style={{ background: p.swatch[0] }}
            >
              {/* the mood in miniature: its three neons as glowing stripes */}
              <span aria-hidden="true" className="flex h-12 items-end gap-1.5">
                {p.swatch.slice(1).map((c, i) => (
                  <span
                    key={c}
                    className="w-full rounded-full transition-[height] duration-500 ease-out group-hover:h-full"
                    style={{ background: c, height: `${[100, 66, 40][i]}%`, boxShadow: p.id === 'classic' ? undefined : `0 0 14px ${c}99` }}
                  />
                ))}
              </span>
              <span className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold" style={{ color: p.id === 'classic' ? '#f3efe6' : p.swatch[1] }}>{p.name}</span>
                {on && (
                  <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: p.swatch[1], color: p.swatch[0] }}>
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-white/55">{p.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
