'use client'

import { cx } from '@/components/ds'

interface SliderProps {
  label: string
  value: number
  accent: 'gold' | 'moss'
  onChange: (value: number) => void
}

/**
 * Labelled range slider. Spec D4: on phones the label and mono value sit on
 * their own line above the track (so the track never shrinks to 40px); from
 * `sm` up the label sits left and the value right of the track.
 */
export function Slider({ label, value, accent, onChange }: SliderProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between gap-2 sm:hidden">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-parchment/70">{Math.round(value)}%</span>
      </div>
      <div className="flex items-center gap-3">
        <span title={label} className="hidden w-24 shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45 sm:block">{label}</span>
        <input type="range" min="0" max="100" step={1} value={value} aria-label={label}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={cx('h-6 min-w-0 flex-1 cursor-pointer touch-manipulation', accent === 'gold' ? 'accent-gold' : 'accent-moss')} />
        <span className="hidden w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-parchment/70 sm:block">{Math.round(value)}%</span>
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

/** Weight and score range sliders, stacked. Clicks never bubble to the card. */
export function WeightScoreInputs({ weight, score, weightLabel = 'Weight', onWeightChange, onScoreChange }: WeightScoreInputsProps) {
  return (
    <div className="flex flex-col gap-3 animate-fadeIn" onClick={e => e.stopPropagation()}>
      <Slider label={weightLabel} value={weight} accent="gold" onChange={onWeightChange} />
      <Slider label="Score" value={Math.round(score)} accent="moss" onChange={onScoreChange} />
    </div>
  )
}
