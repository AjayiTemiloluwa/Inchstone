'use client'

import { useState } from 'react'
import { ChevronDown, FileText, Pencil, Trash2 } from 'lucide-react'
import { IconButton, Panel, RowActions, cx } from '@/components/ds'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { useDeleteItem } from '../DeleteItemButton'
import { WeightScoreInputs } from '../WeightScoreInputs'
import { Meter, Percent } from '../primitives'
import { ItemEditDialog } from '../ItemEditDialog'

interface YearGoalCardProps {
  goal: Item
  score: number
  open: boolean
  onToggle: () => void
  onDeleted: (id: string) => void | Promise<void>
  /** Categories the goal can be moved between. */
  categories?: Item[]
  onSaved?: () => unknown
}

/** One yearly goal: inline rename, expandable weight / score sliders, delete. */
export function YearGoalCard({ goal, score, open, onToggle, onDeleted, categories, onSaved }: YearGoalCardProps) {
  const [details, setDetails] = useState(false)
  const updateItem = useHierarchyStore(s => s.updateItem)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const remove = useDeleteItem({ itemId: goal.id, onDeleted })
  const startRename = () => { setTitleDraft(goal.title); setEditing(true) }

  return (
    <Panel className="group space-y-3 p-4" padded={false}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <IconButton icon={ChevronDown} onClick={onToggle} aria-expanded={open}
              label={open ? 'Hide sliders' : 'Edit weight and score'}
              className={cx('[&>svg]:transition-transform [&>svg]:duration-200', open && '[&>svg]:rotate-180')} />
            {editing ? (
              <input type="text" value={titleDraft} onChange={e => setTitleDraft(e.target.value)} autoFocus aria-label="Goal name"
                onKeyDown={e => {
                  if (e.key === 'Enter') { updateItem(goal.id, { title: titleDraft }); setEditing(false) }
                  if (e.key === 'Escape') setEditing(false)
                }}
                onBlur={() => { if (titleDraft.trim()) updateItem(goal.id, { title: titleDraft }); setEditing(false) }}
                className="h-9 w-full min-w-0 rounded-lg border border-gold/40 bg-ink/40 px-2 text-sm font-semibold text-parchment outline-none focus:ring-2 focus:ring-gold/30" />
            ) : (
              <h4 className="min-w-0 truncate text-sm font-semibold text-parchment">{goal.title}</h4>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Percent value={score} className="text-heading text-parchment" />
            <RowActions label="Goal actions" actions={[
              { label: 'Edit details', icon: FileText, onSelect: () => setDetails(true) },
              { label: 'Rename', icon: Pencil, onSelect: startRename },
              { label: 'Delete Goal', icon: Trash2, destructive: true, onSelect: () => { void remove() } },
            ]} />
          </div>
        </div>
        <Meter value={score} />
        {open && (
          <WeightScoreInputs weight={goal.weight} score={score}
            onWeightChange={v => updateItem(goal.id, { weight: v })}
            onScoreChange={v => updateItem(goal.id, { progress: v })} />
        )}
      {details && (
        <ItemEditDialog item={goal} heading={goal.title} fields={['title', 'description', 'parent', 'dates']}
          parentOptions={categories?.map(c => ({ id: c.id, title: c.title }))} onClose={() => setDetails(false)} onSaved={onSaved} />
      )}
    </Panel>
  )
}
