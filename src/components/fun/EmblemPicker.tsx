'use client'

import { Play } from 'lucide-react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { EMBLEMS, setEmblem, useEmblem } from '@/lib/emblem'
import { WELCOME_OPEN } from '@/components/fun/Welcome'

/** Settings → Appearance: your emblem (the icon in your level ring), and a replay of the Welcome. */
export function EmblemPicker() {
  const current = useEmblem()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-body font-medium text-parchment">Your emblem</p>
          <p className="text-caption text-parchment/50">The icon in your level ring. It leads every level-up.</p>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(WELCOME_OPEN))}
          className="flex items-center gap-1.5 rounded-lg border border-gold/25 px-3 py-1.5 text-[12px] font-medium text-gold hover:bg-gold/10"
        >
          <Play className="h-3.5 w-3.5" /> Replay welcome
        </button>
      </div>
      <div role="radiogroup" aria-label="Emblem" className="grid grid-cols-8 gap-2">
        {EMBLEMS.map(({ id, label, Icon }) => {
          const on = current.id === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              title={label}
              onClick={(e) => {
                setEmblem(id)
                if (!prefersReducedMotion()) gsap.fromTo(e.currentTarget, { scale: 0.7, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.7, ease: 'elastic.out(1.2, 0.45)' })
              }}
              className={`grid aspect-square place-items-center rounded-lg border transition-colors ${on ? 'border-gold bg-gold text-ink' : 'border-gold/15 text-parchment/60 hover:border-gold/50 hover:text-gold'}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
