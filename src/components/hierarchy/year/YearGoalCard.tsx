'use client'

import { useState } from 'react'
import { ChevronDown, Edit3 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { DeleteItemButton } from '../DeleteItemButton'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'

interface YearGoalCardProps {
  goal: Item
  score: number
  open: boolean
  onToggle: () => void
  onDeleted: (id: string) => void | Promise<void>
}

/** One yearly goal: inline rename, expandable weight / score sliders, delete. */
export function YearGoalCard({ goal, score, open, onToggle, onDeleted }: YearGoalCardProps) {
  const updateItem = useHierarchyStore(s => s.updateItem)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  return (
    <Card className="p-3 sm:p-4 hover:border-gold active:opacity-70 transition-all group relative">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center space-x-1 min-w-0 flex-1">
          <button type="button" onClick={onToggle} aria-expanded={open}
            title={open ? 'Hide sliders' : 'Edit weight & score'} aria-label={open ? 'Hide sliders' : 'Edit weight and score'}
            className="p-1.5 rounded-lg hover:bg-mist transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180 text-gold' : 'text-ink/40'}`} />
          </button>
          {editing ? (
            <input type="text" value={titleDraft} onChange={e => setTitleDraft(e.target.value)} autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') { updateItem(goal.id, { title: titleDraft }); setEditing(false) }
                if (e.key === 'Escape') setEditing(false)
              }}
              onBlur={() => { if (titleDraft.trim()) updateItem(goal.id, { title: titleDraft }); setEditing(false) }}
              className="font-bold text-ink text-sm bg-white/[0.08] border border-gold/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-gold/30 min-w-0 w-full" />
          ) : (
            <h4 className="font-bold text-ink text-sm truncate">{goal.title}</h4>
          )}
          <button type="button" aria-label="Edit goal name" title="Edit goal name"
            onClick={e => { e.stopPropagation(); setTitleDraft(goal.title); setEditing(true) }}
            className="p-1 hover:bg-mist rounded transition text-ink/30 hover:text-gold sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center">
            <Edit3 className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center space-x-2 shrink-0 pr-9">
          <ProgressRing progress={score} size={32} />
          <span className="text-base font-mono font-bold">{Math.round(score)}%</span>
        </div>
      </div>
      {open && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-3 animate-fadeIn">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-ink/50 uppercase tracking-wider">Weight</span>
              <span className="text-[9px] font-mono text-ink/50">{Math.round(goal.weight)}%</span>
            </div>
            <input type="range" min="0" max="100" step={1} value={goal.weight} aria-label="Weight"
              onChange={e => updateItem(goal.id, { weight: parseFloat(e.target.value) || 0 })}
              className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold touch-manipulation" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-ink/50 uppercase tracking-wider">Score</span>
              <span className="text-[9px] font-mono text-ink/50">{Math.round(score)}%</span>
            </div>
            <input type="range" min="0" max={100} step={1} value={Math.round(score)} aria-label="Score"
              onChange={e => updateItem(goal.id, { progress: parseFloat(e.target.value) || 0 })}
              className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-sage touch-manipulation" />
          </div>
        </div>
      )}
      <DeleteItemButton itemId={goal.id} title="Delete Goal" onDeleted={onDeleted} />
    </Card>
  )
}
