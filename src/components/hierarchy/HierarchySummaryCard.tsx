'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { InlineEdit } from '@/components/ui/InlineEdit'

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

/** Gold-outlined card: the item's own score / weight controls, then its children. */
export function HierarchySummaryCard({
  title, renameLabel, score, weight, weightLabel, childrenLabel, childrenTotal,
  onRename, onScoreChange, onWeightChange, children,
}: HierarchySummaryCardProps) {
  return (
    <Card className="p-5 space-y-4 border-gold">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-ink min-w-0">
            <InlineEdit value={title} onSave={onRename} title={renameLabel}
              inputClassName="w-full min-w-0 rounded-md border border-gold/40 bg-mist/20 px-2 py-1 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-gold/30" />
          </h3>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-1">
              <span className="text-[9px] text-ink/50 uppercase tracking-wider">Score:</span>
              <input type="number" min="0" max="100" value={Math.round(score)}
                onChange={e => onScoreChange(parseFloat(e.target.value) || 0)}
                className="w-14 px-1 py-1.5 sm:py-0.5 text-[9px] bg-mist/30 rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none" />
              <span className="text-[9px] text-ink/50">%</span>
            </label>
            <span className="text-sm font-mono font-bold text-gold w-14 text-right">{Math.round(weight)}%</span>
          </div>
        </div>
        <div className="flex-1">
          <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">{weightLabel}</span>
          <input type="range" min={0} max={100} step={1} value={weight} aria-label={weightLabel}
            onChange={e => onWeightChange(parseFloat(e.target.value) || 0)}
            className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
        </div>
        <ProgressBar progress={score} colorClass="bg-sage" />
      </div>

      <div className="space-y-3 pt-2 border-t border-mist">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase text-ink/50">{childrenLabel}</span>
          <span className={`text-[10px] font-mono ${Math.round(childrenTotal) === 100 ? 'text-sage' : 'text-[#cf8f78]'}`}>
            Total: {Math.round(childrenTotal)}%
          </span>
        </div>
        {children}
      </div>
    </Card>
  )
}
