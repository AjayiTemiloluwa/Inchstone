'use client'

import { useState } from 'react'
import { ChevronDown, Edit3, Lock, Plus, RotateCcw, Unlock, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Scramble } from '@/components/ui/motion'
import { CategoryEditModal } from '@/components/ui/CategoryEditModal'
import { useToast } from '@/components/ui/ToastProvider'
import { useVoiceLine } from '@/lib/voice/use-voice-line'
import { yearOf } from '@/lib/useActiveYear'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { DeleteItemButton } from '../DeleteItemButton'
import { createYearlyGoalWithQuarters } from '../createGoal'
import { equalWeight } from '../itemTree'
import { useWeightBalancer } from '../useWeightBalancer'
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
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink flex items-center gap-2 sm:gap-3">
          <Scramble text="Categories & Goals" mono={false} />
          <span className="text-[10px] sm:text-xs font-mono font-normal bg-white/10 px-2 py-0.5 sm:py-1 rounded-full text-ink/60">{categories.length}</span>
        </h2>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button type="button" onClick={() => setAddingCategory(!addingCategory)} data-cursor="Add a life category"
            className="flex items-center space-x-1.5 text-xs sm:text-sm text-ink/50 hover:text-gold active:opacity-70 transition min-h-[40px] px-3 py-2 rounded-lg hover:bg-white/5">
            {addingCategory ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span>{addingCategory ? 'Cancel' : 'Add Category'}</span>
          </button>
          <button type="button" onClick={balancer.resetWeights} data-cursor="Spread the weights evenly" aria-label="Reset weights equal"
            className="flex items-center space-x-1.5 text-xs sm:text-sm text-gold hover:text-gold/80 active:opacity-70 transition min-h-[40px] px-3 py-2 rounded-lg hover:bg-gold/5">
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Reset Equal</span>
          </button>
        </div>
      </div>

      {addingCategory && (
        <div className="flex items-stretch space-x-2 mb-4 sm:mb-6 animate-fadeIn">
          <input type="text" value={newCategoryTitle} onChange={e => setNewCategoryTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()} placeholder="New category..." autoFocus
            className="flex-1 min-w-0 px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all placeholder:text-ink/30 min-h-[44px]" />
          <button type="button" onClick={handleAddCategory}
            className="py-3 bg-gold text-ink text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:opacity-70 min-h-[44px] px-6">Add</button>
        </div>
      )}

      <div className="space-y-4 sm:space-y-6">
        {categories.map(category => {
          const w = balancer.weightOf(category)
          const isLocked = balancer.locked[category.id] || false
          const catScore = completionMap[category.id] || 0
          const isOpen = openCategoryId === category.id
          const categoryGoals = yearlyGoals.filter(g => g.parentId === category.id)
          const goalWeightSum = categoryGoals.reduce((s, g) => s + (g.weight || 0), 0)

          return (
            <Card key={category.id} className="p-4 sm:p-5 space-y-3 sm:space-y-4 active:opacity-70 transition-transform">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <button type="button" aria-expanded={isOpen}
                    onClick={() => { setOpenCategoryId(isOpen ? null : category.id); setOpenItemId(null) }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left min-h-[44px] rounded-lg px-1 hover:bg-mist/50 transition">
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gold' : 'text-ink/40'}`} />
                    <span className="min-w-0">
                      <span className="block text-lg font-bold text-ink truncate">{category.title}</span>
                      {category.description && <span className="block text-xs text-ink/60 truncate">{category.description}</span>}
                    </span>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-mono font-bold text-gold w-14 text-right">{Math.round(w)}%</span>
                    <span className="text-sm font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-ink/80">{Math.round(catScore)}%</span>
                  </div>
                </div>
                <ProgressBar progress={catScore} colorClass="bg-sage" />
              </div>

              {isOpen && (
                <div className="space-y-3 sm:space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1">
                      <button type="button" onClick={() => balancer.toggleLock(category.id)} aria-pressed={isLocked}
                        className="p-1 hover:bg-mist rounded transition min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                        title={isLocked ? 'Unlock weight' : 'Lock weight'} aria-label={isLocked ? 'Unlock weight' : 'Lock weight'}>
                        {isLocked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold" /> : <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-ink/30" />}
                      </button>
                      <button type="button" onClick={() => setEditingCategoryId(category.id)} title="Edit category" aria-label="Edit category"
                        className="p-1.5 hover:bg-mist rounded-lg transition text-ink/30 hover:text-gold min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                      <label className="flex items-center space-x-1">
                        <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Score:</span>
                        <input type="number" min="0" max="100" value={Math.round(catScore)}
                          onChange={e => { void updateItemScoreMode(category.id, 'manual', parseFloat(e.target.value) || 0) }}
                          className="w-14 px-1 py-1.5 sm:py-0.5 text-[11px] font-mono bg-white/[0.06] rounded border border-transparent hover:border-white/20 focus:bg-white/[0.1] focus:border-gold outline-none transition-colors" />
                        <span className="text-[9px] text-ink/50">%</span>
                      </label>
                      <DeleteItemButton itemId={category.id} title="Delete Category" onDeleted={handleDeleted} variant="inline" />
                    </div>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={w} aria-label={`${category.title} weight`}
                    onChange={e => balancer.changeWeight(category.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold touch-manipulation" />

                  <div className="space-y-3 pt-2 border-t border-mist">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-ink/50">Goals</span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-mono ${Math.round(goalWeightSum) === 100 ? 'text-sage' : 'text-[#cf8f78]'}`}>
                          Total: {Math.round(goalWeightSum)}%
                        </span>
                        <button type="button" onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)} data-cursor="Set an annual goal"
                          aria-label={addingGoal === category.id ? 'Cancel adding goal' : 'Add goal'}
                          className="p-2 hover:bg-mist rounded-lg active:opacity-70 transition text-ink/50 hover:text-gold min-w-[36px] min-h-[36px] flex items-center justify-center">
                          {addingGoal === category.id ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        </button>
                      </div>
                    </div>

                    {addingGoal === category.id && (
                      <div className="flex items-stretch space-x-2 animate-fadeIn mb-3">
                        <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddGoal(category.id)} placeholder="New annual goal..." autoFocus
                          className="flex-1 min-w-0 px-4 py-3 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all min-h-[44px]" />
                        <button type="button" onClick={() => handleAddGoal(category.id)}
                          className="py-3 bg-gold text-ink text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:opacity-70 min-h-[44px] px-6">Add</button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {categoryGoals.map(goal => (
                        <YearGoalCard key={goal.id} goal={goal} score={completionMap[goal.id] || 0}
                          open={openItemId === goal.id} onToggle={() => setOpenItemId(openItemId === goal.id ? null : goal.id)}
                          onDeleted={handleDeleted} />
                      ))}
                    </div>
                    {categoryGoals.length === 0 && !addingGoal && <p className="text-xs text-ink/40 italic">{emptyGoals}</p>}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
        {categories.length === 0 && <p className="text-sm text-ink/50">No categories. Seed the framework first.</p>}
      </div>

      <CategoryEditModal categoryId={editingCategoryId} onClose={() => setEditingCategoryId(null)} />
    </div>
  )
}
