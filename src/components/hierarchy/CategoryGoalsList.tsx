'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { DeleteItemButton } from './DeleteItemButton'
import { WeightScoreInputs } from './WeightScoreInputs'
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

  const submit = async (categoryId: string) => {
    if (!newGoalTitle.trim()) return
    if (await onAddGoal(categoryId, newGoalTitle.trim())) {
      setNewGoalTitle('')
      setAddingGoal(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink">{heading}</h2>
      </div>

      <div className="space-y-6">
        {rows.map(({ category, goals }) => {
          const catScore = completionMap[category.id] || 0
          const isOpen = openCategoryId === category.id
          const weightSum = goals.reduce((s, g) => s + (g.item.weight || 0), 0)

          return (
            <Card key={category.id} className="p-4 sm:p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" aria-expanded={isOpen}
                    onClick={() => { setOpenCategoryId(isOpen ? null : category.id); setOpenItemId(null) }}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left min-h-[44px] rounded-lg px-1 hover:bg-mist/50 transition">
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gold' : 'text-ink/40'}`} />
                    <span className="text-lg font-bold text-ink truncate">{category.title}</span>
                  </button>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Score:</span>
                      {quarterMode ? (
                        <>
                          <input type="number" min="0" max="100" value={Math.round(catScore)} aria-label={`${category.title} score`}
                            onChange={e => updateItem(category.id, { progress: parseFloat(e.target.value) || 0 })}
                            className="w-14 px-1 py-1.5 sm:py-0.5 text-[10px] font-mono bg-white/[0.06] rounded border border-transparent hover:border-white/20 focus:bg-white/[0.1] focus:border-gold outline-none transition-colors" />
                          <span className="text-[9px] text-ink/50">%</span>
                        </>
                      ) : (
                        <span className="text-sm font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-ink/80">{Math.round(catScore)}%</span>
                      )}
                    </div>
                  </div>
                </div>
                <ProgressBar progress={catScore} colorClass="bg-sage" />
              </div>

              {isOpen && (
                <div className="space-y-3 pt-2 border-t border-mist animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-ink/50">{goalsLabel}</span>
                    <div className="flex items-center space-x-2">
                      {quarterMode && (
                        <span className={`text-[10px] font-mono ${Math.round(weightSum) === 100 ? 'text-sage' : 'text-[#cf8f78]'}`}>
                          Total Q-Weight: {Math.round(weightSum)}%
                        </span>
                      )}
                      <button type="button" onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)}
                        aria-label={addingGoal === category.id ? 'Cancel adding goal' : 'Add goal'}
                        className="p-2 sm:p-1 hover:bg-mist rounded-lg transition text-ink/50 hover:text-gold">
                        {addingGoal === category.id ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {addingGoal === category.id && (
                    <div className="flex items-center space-x-2 animate-fadeIn mb-3">
                      <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submit(category.id)}
                        placeholder={`New annual goal in ${category.title}...`}
                        className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all" autoFocus />
                      <button type="button" onClick={() => submit(category.id)}
                        className="px-4 py-2.5 bg-gold text-ink text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:opacity-70">Add</button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {goals.map(({ item, label }) => {
                      const score = completionMap[item.id] || 0
                      const itemOpen = openItemId === item.id
                      return (
                        <Card key={item.id} className="p-4 hover:border-gold transition-colors group relative cursor-pointer" onClick={() => router.push(hrefFor(item))}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1 min-w-0">
                              <button type="button" aria-expanded={itemOpen}
                                onClick={e => { e.stopPropagation(); setOpenItemId(itemOpen ? null : item.id) }}
                                title={itemOpen ? 'Hide sliders' : 'Edit weight & score'}
                                aria-label={itemOpen ? 'Hide sliders' : 'Edit weight and score'}
                                className="p-1.5 rounded-lg hover:bg-mist transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center">
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${itemOpen ? 'rotate-180 text-gold' : 'text-ink/40'}`} />
                              </button>
                              <h4 className="font-bold text-ink text-sm truncate pr-6">{label}</h4>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <ProgressRing progress={score} size={32} />
                              <span className="text-base font-mono font-bold">{Math.round(score)}%</span>
                            </div>
                          </div>
                          {itemOpen && (
                            <WeightScoreInputs weight={item.weight || 0} score={score} weightLabel={weightLabel}
                              onWeightChange={v => updateItem(item.id, { weight: v })}
                              onScoreChange={v => updateItem(item.id, { progress: v })} />
                          )}
                          <DeleteItemButton itemId={item.id} title="Delete goal" confirmMessage="Are you sure you want to delete this?" onDeleted={onDeleted} />
                        </Card>
                      )
                    })}
                  </div>
                  {goals.length === 0 && !addingGoal && (
                    <p className="text-xs text-ink/40 italic">{emptyText}</p>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
