'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen } from 'lucide-react'
import { format } from 'date-fns'

export default function QuarterPage() {
  const router = useRouter()
  const params = useParams()
  const quarterId = params.id as string

  const { items, completionMap, setItems, updateItem } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [addingMonth, setAddingMonth] = useState(false)
  const [newMonthTitle, setNewMonthTitle] = useState('')
  const [reflectionPopup, setReflectionPopup] = useState<string | null>(null)
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          const itemMap = new Map()
          data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
          const tree: any[] = []
          data.items.forEach((item: any) => {
            if (item.parentId) {
              const parent = itemMap.get(item.parentId)
              if (parent) parent.children.push(itemMap.get(item.id))
            } else {
              tree.push(itemMap.get(item.id))
            }
          })
          setItems(tree)
        }
      })
      .finally(() => setLoading(false))
  }, [setItems])

  const findItem = (id: string): Item | undefined => {
    const search = (nodes: Item[]): Item | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n
        if (n.children) { const f = search(n.children); if (f) return f }
      }
      return undefined
    }
    return search(items)
  }

  const quarterItem = findItem(quarterId)
  const monthlyGoals = quarterItem?.children?.filter(c => c.layer === 4) || []
  const parentYearlyGoal = quarterItem?.parentId ? findItem(quarterItem.parentId) : undefined
  const parentCategory = parentYearlyGoal?.parentId ? findItem(parentYearlyGoal.parentId) : undefined
  const monthWeightSum = monthlyGoals.reduce((s, m) => s + (m.weight || 0), 0)

  // Find all categories
  const categories = items.filter(i => i.layer === 1)

  // Find annual goals (layer 2) in the same category
  const annualGoals = items.filter(c => c.layer === 2 && c.parentId === parentCategory?.id)

  // Group annual goals by category
  const goalsByCategory: Record<string, Item[]> = {}
  annualGoals.forEach(goal => {
    const category = findCategoryForGoal(goal)
    if (category) {
      if (!goalsByCategory[category.id]) {
        goalsByCategory[category.id] = []
      }
      goalsByCategory[category.id].push(goal)
    }
  })

  function findCategoryForGoal(goal: Item): Item | undefined {
    if (goal.layer === 1) return goal
    if (goal.parentId) {
      return findCategoryForGoal(findItem(goal.parentId)!)
    }
    return undefined
  }

  useEffect(() => {
    if (quarterItem?.reflection && reflectionText === '') {
      setReflectionText(quarterItem.reflection)
    }
  }, [quarterItem, reflectionText])

  const saveReflection = useCallback((text: string) => {
    if (!reflectionPopup) return
    if (reflectionTimer) clearTimeout(reflectionTimer)
    const timer = setTimeout(() => {
      updateItem(reflectionPopup, { reflection: text })
    }, 800)
    setReflectionTimer(timer)
  }, [reflectionPopup, updateItem, reflectionTimer])

  const handleAddMonth = async () => {
    if (!newMonthTitle.trim() || !quarterItem) return
    try {
      const existingMonths = monthlyGoals
      const perWeight = Math.round((100 / (existingMonths.length + 1)) * 10) / 10

      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 4,
          parentId: quarterItem.id,
          title: newMonthTitle.trim(),
          weight: perWeight,
          startDate: quarterItem.startDate,
          endDate: quarterItem.endDate,
        })
      })

      const res = await fetch('/api/items')
      const data = await res.json()
      if (data.items) {
        const itemMap = new Map()
        data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
        const tree: any[] = []
        data.items.forEach((item: any) => {
          if (item.parentId) { const parent = itemMap.get(item.parentId); if (parent) parent.children.push(itemMap.get(item.id)) }
          else { tree.push(itemMap.get(item.id)) }
        })
        setItems(tree)
      }
      setNewMonthTitle('')
      setAddingMonth(false)
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this? All nested goals will also be deleted.')) return
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) { alert('Failed to delete item') }
      else {
        if (id === quarterId) { router.push('/year') }
        else {
          fetch('/api/items').then(r => r.json()).then(data => {
            if (data.items) {
              const itemMap = new Map()
              data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
              const tree: any[] = []
              data.items.forEach((item: any) => {
                if (item.parentId) { const parent = itemMap.get(item.parentId); if (parent) parent.children.push(itemMap.get(item.id)) }
                else { tree.push(itemMap.get(item.id)) }
              })
              setItems(tree)
              const remaining = data.items.filter((i: any) => i.parentId === quarterId)
              if (remaining.length > 0) {
                const eqWeight = Math.round((100 / remaining.length) * 10) / 10
                remaining.forEach((m: any) => updateItem(m.id, { weight: eqWeight }))
              }
            }
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
  if (!quarterItem) return <div className="p-6 text-ink/60">Quarter not found.</div>

  const qScore = completionMap[quarterItem.id] || 0

  return (
    <div className="space-y-8 max-w-full pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-ink/50 flex-wrap">
        <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
        <ChevronRight className="w-3 h-3" />
        {parentCategory && <><span>{parentCategory.title}</span><ChevronRight className="w-3 h-3" /></>}
        <span className="text-ink font-bold">{quarterItem.title}</span>
      </div>

      {/* Quarter Header */}
      <div className="bg-surface border border-mist rounded-2xl p-8 relative">
        <button onClick={(e) => handleDelete(e, quarterItem.id)} className="absolute top-4 right-4 p-2 text-ink/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete Quarter">
          <Trash2 className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-ink">{quarterItem.title}</h1>
            {quarterItem.theme && <p className="text-gold font-serif italic mt-1">"{quarterItem.theme}"</p>}
            <p className="text-sm text-ink/50 mt-2 font-mono">
              {quarterItem.startDate && format(new Date(quarterItem.startDate), 'MMM d')} – {quarterItem.endDate && format(new Date(quarterItem.endDate), 'MMM d, yyyy')}
            </p>
          </div>
          <ProgressRing progress={qScore} size={72} />
        </div>
      </div>

      {/* Categories & Goals Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-display font-bold text-ink">Categories & Goals</h2>
        </div>

        <div className="space-y-6">
          {categories.map(category => {
            const catGoals = goalsByCategory[category.id] || []
            const catScore = completionMap[category.id] || 0
            const goalWeightSum = catGoals.reduce((s, g) => s + (g.weight || 0), 0)

            return (
              <Card key={category.id} className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-bold text-ink">{category.title}</h3>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <span className="text-[9px] text-ink/50 uppercase tracking-wider">Score:</span>
                        <input type="number" min="0" max="100" value={Math.round(catScore)}
                          onChange={e => updateItem(category.id, { progress: parseFloat(e.target.value) || 0 })}
                          className="w-12 px-1 py-0.5 text-[9px] bg-mist/30 rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none" />
                        <span className="text-[9px] text-ink/50">%</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-gold w-14 text-right">{Math.round(category.weight || 0)}%</span>
                    </div>
                  </div>
                  <ProgressBar progress={catScore} colorClass="bg-sage" />
                </div>

                <div className="space-y-3 pt-2 border-t border-mist">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-ink/50">Goals</span>
                    <span className={`text-[10px] font-mono ${Math.round(goalWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
                      Total: {Math.round(goalWeightSum)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catGoals.map(goal => {
                      const gScore = completionMap[goal.id] || 0
                      const isCurrentQuarter = goal.id === parentYearlyGoal?.id
                      return (
                        <Card key={goal.id} className={`p-4 hover:border-gold transition-colors group relative ${isCurrentQuarter ? 'ring-2 ring-gold' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-ink text-sm truncate pr-6">{goal.title}</h4>
                            <div className="flex items-center space-x-2">
                              <ProgressRing progress={gScore} size={32} />
                              <span className="text-base font-mono font-bold">{Math.round(gScore)}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                              <input type="range" min="0" max="100" step={1} value={goal.weight || 0}
                                onChange={e => updateItem(goal.id, { weight: parseFloat(e.target.value) || 0 })}
                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                              <span className="text-[9px] font-mono text-ink/50">{Math.round(goal.weight || 0)}%</span>
                            </div>
                            <div className="flex-1">
                              <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                              <input type="range" min="0" max="100" step={1} value={Math.round(gScore)}
                                onChange={e => updateItem(goal.id, { progress: parseFloat(e.target.value) || 0 })}
                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                              <span className="text-[9px] font-mono text-ink/50">{Math.round(gScore)}%</span>
                            </div>
                          </div>
                          {isCurrentQuarter && (
                            <div className="mt-2 pt-2 border-t border-mist">
                              <span className="text-[9px] text-gold font-bold uppercase">Current Quarter</span>
                            </div>
                          )}
                          <button onClick={(e) => handleDelete(e, goal.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Goal">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Card>
                      )
                    })}
                  </div>
                  {catGoals.length === 0 && (
                    <p className="text-xs text-ink/40 italic">No goals yet.</p>
                  )}
                </div>
              </Card>
            )
          })}
          {categories.length === 0 && (
            <p className="text-sm text-ink/50">No categories found. Please seed the framework from the dashboard.</p>
          )}
        </div>
      </div>

      {/* Months Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display font-bold text-ink">Months</h2>
          <button onClick={() => setAddingMonth(!addingMonth)} className="flex items-center space-x-1.5 text-xs text-ink/50 hover:text-gold transition">
            {addingMonth ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{addingMonth ? 'Cancel' : 'Add Month'}</span>
          </button>
        </div>

        {addingMonth && (
          <div className="flex items-center space-x-2 mb-4">
            <input type="text" value={newMonthTitle} onChange={e => setNewMonthTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMonth()}
              placeholder="New month..." className="flex-1 px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30" autoFocus />
            <button onClick={handleAddMonth} className="px-3 py-2 bg-gold text-surface text-sm font-semibold rounded-lg hover:bg-gold/90 transition">Add</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthlyGoals.map((month, idx) => {
            const mScore = completionMap[month.id] || 0
            const monthLabel = month.startDate ? format(new Date(month.startDate), 'MMMM') : `Month ${idx + 1}`
            return (
              <Card key={month.id} className="p-5 hover:border-gold transition-colors cursor-pointer group relative" onClick={() => router.push(`/month/${month.id}`)}>
                <button onClick={(e) => handleDelete(e, month.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Month">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center justify-between mb-3 pr-6">
                  <div>
                    <p className="text-sm font-bold text-ink">{monthLabel}</p>
                    <p className="text-[10px] text-ink/40 mt-0.5">{month.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink/30 group-hover:text-gold transition" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <ProgressRing progress={mScore} size={40} />
                  <span className="text-lg font-mono font-bold">{Math.round(mScore)}%</span>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                  <input type="range" min="0" max="100" step={1} value={month.weight || 0}
                    onChange={e => updateItem(month.id, { weight: parseFloat(e.target.value) || 0 })}
                    className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                  <span className="text-[9px] font-mono text-ink/50">{Math.round(month.weight || 0)}%</span>
                </div>
              </Card>
            )
          })}
        </div>
        {monthlyGoals.length > 0 && (
          <div className="flex justify-end mt-2">
            <span className={`text-[10px] font-mono ${Math.round(monthWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
              Total: {Math.round(monthWeightSum)}%
            </span>
          </div>
        )}
        {monthlyGoals.length === 0 && !addingMonth && (
          <p className="text-sm text-ink/40 italic">No months yet. Click + to add one.</p>
        )}
      </div>

      {/* Reflection Popup */}
      {reflectionPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setReflectionPopup(null)}>
          <div className="bg-surface rounded-2xl border border-mist shadow-xl p-5 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-gold" />
                <h3 className="font-bold text-ink text-sm">Reflection</h3>
              </div>
              <button onClick={() => setReflectionPopup(null)} className="p-1 hover:bg-mist rounded-lg transition text-ink/30 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea value={reflectionText}
              onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
              placeholder="Write your reflection..."
              className="w-full h-32 bg-paper border border-mist rounded-lg p-3 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
            <p className="text-[10px] text-ink/40 mt-1">Auto-saves as you type</p>
          </div>
        </div>
      )}
    </div>
  )
}