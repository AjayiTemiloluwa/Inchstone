'use client'

import { useRouter } from 'next/navigation'
import { Lock, Unlock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { DeleteItemButton } from './DeleteItemButton'
import { WeightScoreInputs } from './WeightScoreInputs'
import type { Item } from '@/stores/hierarchyStore'

interface ChildItemCardProps {
  item: Item
  href: string
  score: number
  weight: number
  locked: boolean
  /** e.g. "month" -> "Rename month" / "Delete Month". */
  noun: string
  onToggleLock: () => void
  onRename: (title: string) => void
  onWeightChange: (value: number) => void
  onScoreChange: (value: number) => void
  onDeleted: (id: string) => void | Promise<void>
}

/** Card for one child (month / week) with lock, rename, weight + score sliders and delete. */
export function ChildItemCard({
  item, href, score, weight, locked, noun, onToggleLock, onRename, onWeightChange, onScoreChange, onDeleted,
}: ChildItemCardProps) {
  const router = useRouter()
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  return (
    <Card className="p-4 hover:border-gold transition-colors group relative cursor-pointer" onClick={() => router.push(href)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center space-x-2 min-w-0">
          <button type="button" onClick={e => { e.stopPropagation(); onToggleLock() }}
            className="p-2 sm:p-1 hover:bg-mist rounded transition shrink-0" title={locked ? 'Unlock weight' : 'Lock weight'}
            aria-label={locked ? 'Unlock weight' : 'Lock weight'} aria-pressed={locked}>
            {locked ? <Lock className="w-3.5 h-3.5 text-gold" /> : <Unlock className="w-3.5 h-3.5 text-ink/30" />}
          </button>
          <h4 className="font-bold text-ink text-sm truncate pr-6">
            <InlineEdit value={item.title || ''} onSave={onRename} title={`Rename ${noun}`}
              inputClassName="w-full min-w-0 rounded-md border border-gold/40 bg-mist/20 px-2 py-1 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-gold/30" />
          </h4>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <ProgressRing progress={score} size={32} />
          <span className="text-base font-mono font-bold">{Math.round(score)}%</span>
        </div>
      </div>
      <WeightScoreInputs weight={weight} score={score} onWeightChange={onWeightChange} onScoreChange={onScoreChange} />
      <DeleteItemButton itemId={item.id} title={`Delete ${Noun}`} onDeleted={onDeleted} />
    </Card>
  )
}
