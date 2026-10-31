'use client'

import { useState } from 'react'
import { ChevronDown, Edit3, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { Badge, Button, EmptyState, IconButton, Panel, RowActions, Section, cx, inputClass } from '@/components/ds'
import { CategoryEditModal } from '@/components/ui/CategoryEditModal'
import { useToast } from '@/components/ui/ToastProvider'
import { useVoiceLine } from '@/lib/voice/use-voice-line'
import { yearOf } from '@/lib/useActiveYear'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { useDeleteItem } from '../DeleteItemButton'
import { createYearlyGoalWithQuarters } from '../createGoal'
import { equalWeight } from '../itemTree'
import { LockToggle, Meter, Percent } from '../primitives'
import { useWeightBalancer } from '../useWeightBalancer'
import { WeightSlider } from '../WeightScoreInputs'
import { YearGoalCard } from './YearGoalCard'

interface YearCategoriesProps {
  yearItem: Item
  /** Categories in display order. */
  categories: Item[]
  yearlyGoals: Item[]
  completionMap: Record<string, number>
  fetchItems: () => Promise<unknown>
}

/** Categories accordion for the year: weights, scores, goals, add / edit / delete. */
export function YearCategories({ yearItem, categories, yearlyGoals, completionMap, fetchItems }: YearCategoriesProps) {
  const { updateItem, updateItemScoreMode } = useHierarchyStore()
  const { showToast } = useToast()
  const emptyGoals = useVoiceLine('empty.goals')
  const balancer = useWeightBalancer(categories)

  // Accordion: closed by default, one category and one goal open at a time.
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [addingGoal, setAddingGoal] = useState<string | null>(null)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryTitle, setNewCategoryTitle] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  // Canonical year window comes from the year NUMBER, never from "today".
  const yearWindow = () => {
    const y = yearOf(yearItem)
    return {
      start: new Date(Date.UTC(y, 0, 1)).toISOString(),
      end: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)).toISOString(),
      year: y,
    }
  }

  const handleAddGoal = async (categoryId: string) => {
    if (!newGoalTitle.trim()) return
    try {
      const w = yearWindow()
      const existing = yearlyGoals.filter(g => g.parentId === categoryId)
      const goal = await createYearlyGoalWithQuarters({
        categoryId, title: newGoalTitle.trim(), weight: equalWeight(existing.length + 1),
        yearItem, fallbackStart: w.start, fallbackEnd: w.end, year: w.year,
      })
      const all = goal ? [...existing, goal] : existing
      const per = equalWeight(all.length)
      all.forEach(g => updateItem(g.id, { weight: per }))
      await fetchItems()
      setNewGoalTitle('')
      setAddingGoal(null)
    } catch (e) { console.error(e); showToast('Failed to add goal', 'error') }
  }

  const handleAddCategory = async () => {
    if (!newCategoryTitle.trim()) return
    try {
      const w = yearWindow()
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 1, parentId: yearItem.id, title: newCategoryTitle.trim(), weight: 0,
          startDate: yearItem.startDate || w.start, endDate: yearItem.endDate || w.end,
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json()
      if (!res.ok || !data.success) {
        showToast('Failed to add category: ' + (data.error || 'Unknown error'), 'error')
        return
      }
      await fetchItems()
      setNewCategoryTitle('')
      setAddingCategory(false)
    } catch (e) { console.error(e); showToast('Error adding category.', 'error') }
  }

  /** After a delete: refresh, and re-spread weights over the goals left in that category. */
  const handleDeleted = async (id: string) => {
    const parentCategoryId = yearlyGoals.find(g => g.id === id)?.parentId
    await fetchItems()
    if (!parentCategoryId) return
    const remaining = yearlyGoals.filter(g => g.parentId === parentCategoryId && g.id !== id)
    if (remaining.length > 0) {
      const per = equalWeight(remaining.length)
      remaining.forEach(g => updateItem(g.id, { weight: per }))
    }
  }

  return (
    <Section title="Categories & goals" id="year-categories"
      action={
        <>
          <Badge>{categories.length}</Badge>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={balancer.resetWeights} data-cursor="Spread the weights evenly" aria-label="Reset weights equal">
            <span className="hidden sm:inline">Reset equal</span>
          </Button>
          <Button size="sm" variant="secondary" icon={addingCategory ? X : Plus} onClick={() => setAddingCategory(!addingCategory)} data-cursor="Add a life category">
            {addingCategory ? 'Cancel' : 'Add category'}
          </Button>
        </>
      }>
      {addingCategory && (
        <Panel className="mb-4 animate-fadeIn">
          <div className="flex items-stretch gap-2">
            <input type="text" value={newCategoryTitle} onChange={e => setNewCategoryTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()} placeholder="New category..." autoFocus aria-label="New category name"
              className={cx(inputClass, 'flex-1 min-w-0')} />
            <Button variant="primary" onClick={handleAddCategory}>Add</Button>
          </div>
        </Panel>
      )}

      <div className="space-y-3">
        {categories.map(category => {
          const w = balancer.weightOf(category)
          const isLocked = balancer.locked[category.id] || false
          const catScore = completionMap[category.id] || 0
          const isOpen = openCategoryId === category.id
          const categoryGoals = yearlyGoals.filter(g => g.parentId === category.id)
          const goalWeightSum = categoryGoals.reduce((s, g) => s + (g.weight || 0), 0)

          return (
            <Panel key={category.id} padded={false}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-6">
                <button type="button" aria-expanded={isOpen}
                  onClick={() => { setOpenCategoryId(isOpen ? null : category.id); setOpenItemId(null) }}
                  className="-mx-2 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-gold/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
                  <ChevronDown aria-hidden="true" strokeWidth={1.75}
                    className={cx('h-4 w-4 shrink-0 transition-transform duration-200', isOpen ? 'rotate-180 text-gold' : 'text-parchment/40')} />
                  <span className="min-w-0">
                    <span className="block truncate text-heading text-parchment">{category.title}</span>
                    {category.description && <span className="block truncate text-caption text-parchment/50">{category.description}</span>}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-5">
                  <span className="flex flex-col items-end">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/40">Weight</span>
                    <Percent value={w} className="text-sm text-gold" />
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/40">Score</span>
                    <Percent value={catScore} className="text-sm text-parchment" />
                  </span>
                </div>
                <Meter value={catScore} className="basis-full" />
              </div>

              {isOpen && (
                <div className="space-y-5 border-t border-gold/10 p-4 animate-fadeIn sm:px-6 sm:pb-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <LockToggle locked={isLocked} onToggle={() => balancer.toggleLock(category.id)} />
                      <CategoryActions categoryId={category.id} onEdit={() => setEditingCategoryId(category.id)} onDeleted={handleDeleted} />
                    </div>
                    <label className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45">Score</span>
                      <input type="number" min="0" max="100" value={Math.round(catScore)}
                        onChange={e => { void updateItemScoreMode(category.id, 'manual', parseFloat(e.target.value) || 0) }}
                        className="h-9 w-16 rounded-lg border border-gold/20 bg-ink/40 px-2 text-right font-mono text-sm tabular-nums text-parchment focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20" />
                      <span className="font-mono text-[11px] text-parchment/45">%</span>
                    </label>
                  </div>
                  <WeightSlider label={`${category.title} weight`} value={w} onChange={v => balancer.changeWeight(category.id, v)} />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">Goals</span>
                      <div className="flex items-center gap-2">
                        <Badge tone={Math.round(goalWeightSum) === 100 ? 'moss' : 'ember'}>Total {Math.round(goalWeightSum)}%</Badge>
                        <IconButton icon={addingGoal === category.id ? X : Plus} data-cursor="Set an annual goal"
                          label={addingGoal === category.id ? 'Cancel adding goal' : 'Add goal'}
                          onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)} />
                      </div>
                    </div>

                    {addingGoal === category.id && (
                      <div className="flex items-stretch gap-2 animate-fadeIn">
                        <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddGoal(category.id)} placeholder="New annual goal..." autoFocus aria-label="New goal title"
                          className={cx(inputClass, 'flex-1 min-w-0')} />
                        <Button variant="primary" onClick={() => handleAddGoal(category.id)}>Add</Button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {categoryGoals.map(goal => (
                        <YearGoalCard key={goal.id} goal={goal} score={completionMap[goal.id] || 0}
                          open={openItemId === goal.id} onToggle={() => setOpenItemId(openItemId === goal.id ? null : goal.id)}
                          onDeleted={handleDeleted} />
                      ))}
                    </div>
                    {categoryGoals.length === 0 && !addingGoal && <p className="text-caption text-parchment/45">{emptyGoals}</p>}
                  </div>
                </div>
              )}
            </Panel>
          )
        })}
        {categories.length === 0 && <EmptyState title="No categories yet" body="Seed the framework first." />}
      </div>

      <CategoryEditModal categoryId={editingCategoryId} onClose={() => setEditingCategoryId(null)} />
    </Section>
  )
}

/** Edit / delete for one category, in the spec C row menu (always visible: the row is already open). */
function CategoryActions({ categoryId, onEdit, onDeleted }: { categoryId: string; onEdit: () => void; onDeleted: (id: string) => void | Promise<void> }) {
  const remove = useDeleteItem({ itemId: categoryId, onDeleted })
  return (
    <RowActions label="Category actions" className="[&>button]:opacity-100" actions={[
      { label: 'Edit category', icon: Edit3, onSelect: onEdit },
      { label: 'Delete Category', icon: Trash2, destructive: true, onSelect: () => { void remove() } },
    ]} />
  )
}
