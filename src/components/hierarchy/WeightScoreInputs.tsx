'use client'

interface SliderProps {
  label: string
  value: number
  accent: 'gold' | 'sage'
  onChange: (value: number) => void
}

function Slider({ label, value, accent, onChange }: SliderProps) {
  return (
    <div className="flex-1 min-w-0">
      <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">{label}</span>
      <input type="range" min="0" max="100" step={1} value={value} aria-label={label}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer ${accent === 'gold' ? 'accent-gold' : 'accent-sage'}`} />
      <span className="text-[9px] font-mono text-ink/50">{Math.round(value)}%</span>
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

/** Side-by-side weight and score range sliders. Clicks never bubble to the card. */
export function WeightScoreInputs({ weight, score, weightLabel = 'Weight', onWeightChange, onScoreChange }: WeightScoreInputsProps) {
  return (
    <div className="flex items-center gap-4 animate-fadeIn" onClick={e => e.stopPropagation()}>
      <Slider label={weightLabel} value={weight} accent="gold" onChange={onWeightChange} />
      <Slider label="Score" value={Math.round(score)} accent="sage" onChange={onScoreChange} />
    </div>
  )
}
