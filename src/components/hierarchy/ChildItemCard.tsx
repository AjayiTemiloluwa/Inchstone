'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { RowActions } from '@/components/ds'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { useDeleteItem } from './DeleteItemButton'
import { WeightScoreInputs } from './WeightScoreInputs'
import { LockToggle, Meter, NavPanel, Percent } from './primitives'
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

/** One child (month / week): lock, rename, weight + score sliders, delete in the row menu. */
export function ChildItemCard({
  item, href, score, weight, locked, noun, onToggleLock, onRename, onWeightChange, onScoreChange, onDeleted,
}: ChildItemCardProps) {
  const router = useRouter()
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  const remove = useDeleteItem({ itemId: item.id, onDeleted })
  return (
    <NavPanel onOpen={() => router.push(href)} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <LockToggle locked={locked} onToggle={onToggleLock} />
          <h4 className="min-w-0 truncate text-sm font-semibold text-parchment">
            <InlineEdit value={item.title || ''} onSave={onRename} title={`Rename ${noun}`}
              inputClassName="w-full min-w-0 rounded-lg border border-gold/40 bg-ink/40 px-2 py-1 text-sm font-semibold text-parchment outline-none focus:ring-2 focus:ring-gold/30" />
          </h4>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Percent value={score} className="text-heading text-parchment" />
          <RowActions label={`${Noun} actions`} actions={[{ label: `Delete ${Noun}`, icon: Trash2, destructive: true, onSelect: () => { void remove() } }]} />
        </div>
      </div>
      <Meter value={score} />
      <WeightScoreInputs weight={weight} score={score} onWeightChange={onWeightChange} onScoreChange={onScoreChange} />
    </NavPanel>
  )
}
