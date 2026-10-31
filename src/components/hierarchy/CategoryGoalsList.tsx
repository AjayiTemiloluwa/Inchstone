'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { Badge, Button, EmptyState, IconButton, Panel, RowActions, Section, cx, inputClass } from '@/components/ds'
import { useDeleteItem } from './DeleteItemButton'
import { WeightScoreInputs } from './WeightScoreInputs'
import { Meter, NavPanel, Percent } from './primitives'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'

export interface GoalRow {
  item: Item
  /** Title shown on the card (the yearly goal the item belongs to). */
  label: string | undefined
}

export interface CategoryRow {
  category: Item
  goals: GoalRow[]
}

interface CategoryGoalsListProps {
  rows: CategoryRow[]
  completionMap: Record<string, number>
  heading: string
  goalsLabel: string
  /** Where tapping a goal card navigates. */
  hrefFor: (item: Item) => string
  /** Quarter page: editable category score and a Q-weight total. */
  quarterMode?: boolean
  weightLabel: string
  emptyText: string
  /** Create a goal in a category; resolve true on success so the form closes. */
  onAddGoal: (categoryId: string, title: string) => Promise<boolean>
  onDeleted: () => void | Promise<void>
}

interface GoalCardProps {
  item: Item
  label: string | undefined
  score: number
  open: boolean
  weightLabel: string
  onToggle: () => void
  onOpen: () => void
  onDeleted: () => void | Promise<void>
}

function GoalCard({ item, label, score, open, weightLabel, onToggle, onOpen, onDeleted }: GoalCardProps) {
  const updateItem = useHierarchyStore(s => s.updateItem)
  const remove = useDeleteItem({ itemId: item.id, confirmMessage: 'Are you sure you want to delete this?', onDeleted })
  return (
    <NavPanel onOpen={onOpen} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <IconButton icon={ChevronDown} aria-expanded={open}
            label={open ? 'Hide sliders' : 'Edit weight and score'}
            onClick={e => { e.stopPropagation(); onToggle() }}
            className={cx('[&>svg]:transition-transform [&>svg]:duration-200', open && '[&>svg]:rotate-180')} />
          <h4 className="min-w-0 truncate text-sm font-semibold text-parchment">{label}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Percent value={score} className="text-heading text-parchment" />
          <RowActions label="Goal actions" actions={[{ label: 'Delete goal', icon: Trash2, destructive: true, onSelect: () => { void remove() } }]} />
        </div>
      </div>
      <Meter value={score} />
      {open && (
        <WeightScoreInputs weight={item.weight || 0} score={score} weightLabel={weightLabel}
          onWeightChange={v => updateItem(item.id, { weight: v })}
          onScoreChange={v => updateItem(item.id, { progress: v })} />
      )}
    </NavPanel>
  )
}

/** Accordion of categories, each listing its goal cards with weight / score sliders. */
export function CategoryGoalsList({
  rows, completionMap, heading, goalsLabel, hrefFor, quarterMode = false, weightLabel, emptyText, onAddGoal, onDeleted,
}: CategoryGoalsListProps) {
  const router = useRouter()
  const updateItem = useHierarchyStore(s => s.updateItem)
  const [addingGoal, setAddingGoal] = useState<string | null>(null)
  // Accordion: closed by default, one category and one card open at a time.
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  // A real <label> only when it wraps the editable score input.
  const ScoreTag = quarterMode ? 'label' : 'div'

  const submit = async (categoryId: string) => {
    if (!newGoalTitle.trim()) return
    if (await onAddGoal(categoryId, newGoalTitle.trim())) {
      setNewGoalTitle('')
      setAddingGoal(null)
    }
  }

  return (
    <Section title={heading} action={<Badge>{rows.length}</Badge>}>
      <div className="space-y-3">
        {rows.map(({ category, goals }) => {
          const catScore = completionMap[category.id] || 0
          const isOpen = openCategoryId === category.id
          const weightSum = goals.reduce((s, g) => s + (g.item.weight || 0), 0)

          return (
            <Panel key={category.id} padded={false}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-6">
                <button type="button" aria-expanded={isOpen}
                  onClick={() => { setOpenCategoryId(isOpen ? null : category.id); setOpenItemId(null) }}
                  className="-mx-2 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-gold/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
                  <ChevronDown aria-hidden="true" strokeWidth={1.75}
                    className={cx('h-4 w-4 shrink-0 transition-transform duration-200', isOpen ? 'rotate-180 text-gold' : 'text-parchment/40')} />
                  <span className="truncate text-heading text-parchment">{category.title}</span>
                </button>
                <ScoreTag className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45">Score</span>
                  {quarterMode ? (
                    <>
                      <input type="number" min="0" max="100" value={Math.round(catScore)} aria-label={`${category.title} score`}
                        onChange={e => updateItem(category.id, { progress: parseFloat(e.target.value) || 0 })}
                        className="h-9 w-16 rounded-lg border border-gold/20 bg-ink/40 px-2 text-right font-mono text-sm tabular-nums text-parchment focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20" />
                      <span className="font-mono text-[11px] text-parchment/45">%</span>
                    </>
                  ) : (
                    <Percent value={catScore} className="text-heading text-parchment" />
                  )}
                </ScoreTag>
                <Meter value={catScore} className="basis-full" />
              </div>

              {isOpen && (
                <div className="space-y-4 border-t border-gold/10 p-4 animate-fadeIn sm:px-6 sm:pb-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">{goalsLabel}</span>
                    <div className="flex items-center gap-2">
                      {quarterMode && (
                        <Badge tone={Math.round(weightSum) === 100 ? 'moss' : 'ember'}>Total Q-Weight {Math.round(weightSum)}%</Badge>
                      )}
                      <IconButton icon={addingGoal === category.id ? X : Plus}
                        label={addingGoal === category.id ? 'Cancel adding goal' : 'Add goal'}
                        onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)} />
                    </div>
                  </div>

                  {addingGoal === category.id && (
                    <div className="flex items-center gap-2 animate-fadeIn">
                      <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submit(category.id)}
                        placeholder={`New annual goal in ${category.title}...`} aria-label="New goal title"
                        className={cx(inputClass, 'flex-1 min-w-0')} autoFocus />
                      <Button variant="primary" onClick={() => submit(category.id)}>Add</Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {goals.map(({ item, label }) => (
                      <GoalCard key={item.id} item={item} label={label} score={completionMap[item.id] || 0}
                        open={openItemId === item.id} weightLabel={weightLabel}
                        onToggle={() => setOpenItemId(openItemId === item.id ? null : item.id)}
                        onOpen={() => router.push(hrefFor(item))} onDeleted={onDeleted} />
                    ))}
                  </div>
                  {goals.length === 0 && !addingGoal && (
                    <p className="text-caption text-parchment/45">{emptyText}</p>
                  )}
                </div>
              )}
            </Panel>
          )
        })}
        {rows.length === 0 && <EmptyState title="No categories yet" body="Seed the framework first." />}
      </div>
    </Section>
  )
}
