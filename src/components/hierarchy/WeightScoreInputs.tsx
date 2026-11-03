'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cx } from '@/components/ds'

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

interface PercentFieldProps {
  value: number
  /** Called once with the final value: on Enter, on leaving the box, or on a − / + press. */
  onCommit: (value: number) => void
  label: string
  className?: string
}

/**
 * A 0–100 number you can actually type: the box keeps its own draft while you edit (so "75" is not
 * saved as "7" then "75"), − / + step by 1 (hold Shift or tap-hold the box's arrows for 5), Enter saves,
 * Escape puts the old value back, and nothing is sent to the server until you are done.
 */
export function PercentField({ value, onCommit, label, className }: PercentFieldProps) {
  const [draft, setDraft] = useState<string | null>(null) // null = not editing, show the real value
  const shown = draft ?? String(clamp(value))

  const commit = (raw: string | number) => {
    const n = typeof raw === 'number' ? raw : parseFloat(raw)
    setDraft(null)
    if (Number.isFinite(n) && clamp(n) !== clamp(value)) onCommit(clamp(n))
  }
  const step = (d: number) => commit(clamp(value) + d)

  const btn = 'flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-gold/20 text-parchment/70 transition-colors hover:border-gold/50 hover:text-parchment active:scale-95 disabled:opacity-30 sm:h-9 sm:w-9'
  return (
    <div className={cx('flex shrink-0 items-center gap-1.5', className)} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={`Decrease ${label}`} className={btn} disabled={clamp(value) <= 0} onClick={(e) => step(e.shiftKey ? -5 : -1)}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="relative">
        <input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={`${label} percent`} value={shown}
          onFocus={(e) => { setDraft(String(clamp(value))); e.currentTarget.select() }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
          onBlur={(e) => { if (draft !== null) commit(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            else if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
            else if (e.key === 'ArrowUp') { e.preventDefault(); step(e.shiftKey ? 5 : 1) }
            else if (e.key === 'ArrowDown') { e.preventDefault(); step(e.shiftKey ? -5 : -1) }
          }}
          className="h-10 w-16 rounded-lg border border-gold/25 bg-ink/40 pl-2 pr-6 text-right font-mono text-sm tabular-nums text-parchment focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25 sm:h-9" />
        <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-parchment/45">%</span>
      </span>
      <button type="button" aria-label={`Increase ${label}`} className={btn} disabled={clamp(value) >= 100} onClick={(e) => step(e.shiftKey ? 5 : 1)}>
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  accent: 'gold' | 'moss'
  /** Called once when the value is final (slider released, number typed, − / + pressed). */
  onChange: (value: number) => void
}

/**
 * Labelled control for one 0–100 value: a slider for broad strokes and a number box with − / + for
 * exact ones. While you drag, only the slider moves; the change is saved when you let go, so a drag
 * is one save instead of one per pixel.
 */
export function Slider({ label, value, accent, onChange }: SliderProps) {
  const [drag, setDrag] = useState<number | null>(null)
  const dragging = useRef(false)
  useEffect(() => { if (!dragging.current) setDrag(null) }, [value])
  const shown = drag ?? clamp(value)

  const finish = () => {
    if (!dragging.current) return // pointerup, touchend and blur can all fire for one drag
    dragging.current = false
    if (drag !== null && clamp(drag) !== clamp(value)) onChange(clamp(drag))
    else setDrag(null)
  }

  return (
    <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/55 sm:hidden">{label}</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        <span title={label} className="hidden w-24 shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/55 sm:block">{label}</span>
        <input type="range" min="0" max="100" step={1} value={shown} aria-label={label}
          onChange={(e) => { dragging.current = true; setDrag(parseFloat(e.target.value) || 0) }}
          onPointerUp={finish} onTouchEnd={finish} onKeyUp={finish} onBlur={finish}
          className={cx('h-8 min-w-[8rem] flex-1 cursor-pointer touch-manipulation', accent === 'gold' ? 'accent-gold' : 'accent-moss')} />
        <PercentField label={label} value={shown} onCommit={(v) => { setDrag(null); onChange(v) }} />
      </div>
    </div>
  )
}

export function WeightSlider({ label = 'Weight', value, onChange }: { label?: string; value: number; onChange: (v: number) => void }) {
  return <Slider label={label} value={value} accent="gold" onChange={onChange} />
}

interface WeightScoreInputsProps {
  weight: number
  score: number
  weightLabel?: string
  onWeightChange: (value: number) => void
  onScoreChange: (value: number) => void
}

/** Weight and score controls, stacked. Clicks never bubble to the card. */
export function WeightScoreInputs({ weight, score, weightLabel = 'Weight', onWeightChange, onScoreChange }: WeightScoreInputsProps) {
  return (
    <div className="flex flex-col gap-4 animate-fadeIn" onClick={e => e.stopPropagation()}>
      <Slider label={weightLabel} value={weight} accent="gold" onChange={onWeightChange} />
      <Slider label="Score" value={Math.round(score)} accent="moss" onChange={onScoreChange} />
    </div>
  )
}
