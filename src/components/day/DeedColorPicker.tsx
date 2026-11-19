'use client'

import { useId, useRef, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { DEED_HUES, deedHue, hueVar, type DeedHue } from '@/lib/deedColors'

/**
 * Pick a deed's colour from the mood-aware palette (lib/deedColors.ts). Every swatch is drawn
 * from CSS variables, so it shows the colour exactly as the schedule will in the current mood
 * and theme. A radio group: arrow keys move, the chosen hue is ticked; the first swatch (no colour) follows the mood's accent.
 */
export function DeedColorPicker({
  value,
  onChange,
  label = 'Colour',
  size = 'md',
}: {
  /** The stored colour (a hue name, a legacy hex, or '' for none). */
  value: string | null | undefined
  onChange: (color: string) => void
  label?: string
  size?: 'sm' | 'md'
}) {
  const current = deedHue(value)
  const options: (DeedHue | '')[] = ['', ...DEED_HUES.map((h) => h.id)]
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const labelId = useId()
  const at = Math.max(0, options.indexOf(value ? current ?? '' : ''))
  const dot = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    onChange(options[next])
    refs.current[next]?.focus()
  }

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="text-[9px] font-bold uppercase tracking-wider text-ink/40">{label}</span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5">
        {options.map((id, i) => {
          const selected = i === at
          const name = id ? DEED_HUES.find((h) => h.id === id)!.name : 'Mood accent (default)'
          const fill = id ? `rgb(${hueVar(id)})` : undefined
          return (
            <button
              key={id || 'none'}
              ref={(el) => { refs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`relative flex ${dot} shrink-0 items-center justify-center rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--dialog-rgb))] ${
                selected ? 'scale-110' : 'hover:scale-110'
              } ${id ? '' : 'border-2 border-gold/70'}`}
              style={fill ? { background: fill, boxShadow: selected ? `0 0 0 2px rgb(var(--dialog-rgb)), 0 0 0 4px ${fill}` : undefined } : selected ? { boxShadow: '0 0 0 2px rgb(var(--dialog-rgb)), 0 0 0 4px rgb(var(--gold-rgb))' } : undefined}
            >
              {selected && (id
                ? <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: 'rgb(var(--dialog-rgb))' }} aria-hidden />
                : null)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
