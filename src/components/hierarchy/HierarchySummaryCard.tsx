'use client'

import type { ReactNode } from 'react'
import { Badge, Panel } from '@/components/ds'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { Meter, Percent } from './primitives'
import { WeightSlider } from './WeightScoreInputs'

interface HierarchySummaryCardProps {
  title: string
  renameLabel: string
  score: number
  weight: number
  /** e.g. "Quarter Weight (Relative to Year)". */
  weightLabel: string
  /** e.g. "Months". */
  childrenLabel: string
  childrenTotal: number
  onRename: (title: string) => void
  onScoreChange: (value: number) => void
  onWeightChange: (value: number) => void
  /** The child grid / empty state. */
  children: ReactNode
}

/** The item's own score / weight controls, then its children with their weight total. */
export function HierarchySummaryCard({
  title, renameLabel, score, weight, weightLabel, childrenLabel, childrenTotal,
  onRename, onScoreChange, onWeightChange, children,
}: HierarchySummaryCardProps) {
  const balanced = Math.round(childrenTotal) === 100
  return (
    <div className="space-y-6">
      <Panel className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="min-w-0 text-heading text-parchment">
            <InlineEdit value={title} onSave={onRename} title={renameLabel}
              inputClassName="w-full min-w-0 rounded-lg border border-gold/40 bg-ink/40 px-2 py-1 text-heading text-parchment outline-none focus:ring-2 focus:ring-gold/30" />
          </h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45">Score</span>
              <input type="number" min="0" max="100" value={Math.round(score)}
                onChange={e => onScoreChange(parseFloat(e.target.value) || 0)}
                className="h-9 w-16 rounded-lg border border-gold/20 bg-ink/40 px-2 text-right font-mono text-sm tabular-nums text-parchment focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20" />
              <span className="font-mono text-[11px] text-parchment/45">%</span>
            </label>
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45">Weight</span>
              <Percent value={weight} className="text-sm text-gold" />
            </span>
          </div>
        </div>
        <Meter value={score} />
        <WeightSlider label={weightLabel} value={weight} onChange={onWeightChange} />
      </Panel>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">{childrenLabel}</span>
          <Badge tone={balanced ? 'moss' : 'ember'}>Total {Math.round(childrenTotal)}%</Badge>
        </div>
        {children}
      </div>
    </div>
  )
}
