'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen } from 'lucide-react'
import { format, addDays } from 'date-fns'

export default function WeekPage() {
  const router = useRouter()
  const params = useParams()
  const weekId = params.id as string

  const { items, completionMap, setItems, updateItem } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [addingGoal, setAddingGoal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
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
      }
    }).finally(() => setLoading(false))
  }, [setItems])

  const findItem = (id: string): Item | undefined => {
    const search = (nodes: Item[]): Item | undefined => {
      for (const n of nodes) { if (n.id === id) return n; if (n.children) { const f = search(n.children); if (f) return f } }
      return undefined
    }
    return search(items)
  }

  const weekItem = findItem(weekId)
  const dailyGoals = weekItem?.children?.filter(c => c.layer === 6) || []
  const parentMonth = weekItem?.parentId ? findItem(weekItem.parentId) : undefined
  const dayWeightSum = dailyGoals.reduce((s, d) => s + (d.weight || 0), 0)

  // Find all categories
  const categories = items.filter(i => i.layer === 1)

  // Find weekly goals (layer 5) that are children of categories under this week
  const weeklyGoals = items.filter(c => c.layer === 5 && weekItem?.children?.some(dc => dc.id === c.parentId))

  // Group weekly goals by category
  const goalsByCategory: Record<string, Item[]> = {}
  weeklyGoals.forEach(goal => {
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

  // Auto-create days if none exist - calculate proper day count based on week date range
  const ensureDays = useCallback(async () => {
    if (!weekItem || dailyGoals.length > 0) return
    const wStart = weekItem.startDate ? new Date(weekItem.startDate) : new Date()
    const wEnd = weekItem.endDate ? new Date(weekItem.endDate) : addDays(wStart, 6)
    const totalDays = Math.round((wEnd.getTime() - wStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const perWeight = Math.round((100 / totalDays) * 10) / 10
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    for (let d = 0; d < totalDays; d++) {
      const dDate = addDays(wStart, d)
      const dayName = dayNames[dDate.getDay()]
      const dateStr = format(dDate, 'yyyy-MM-dd')
      await fetch('/api/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer: 6, parentId: weekItem.id, title: dayName, weight: perWeight, startDate: dateStr, endDate: dateStr })
      })
    }
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
  }, [weekItem, dailyGoals.length, setItems])

  useEffect(() => {
    if (!loading && weekItem && dailyGoals.length === 0) {
      ensureDays()
    }
  }, [loading, weekItem, dailyGoals.length, ensureDays])

  // Initialize reflection
  useEffect(() => {
    if (weekItem?.reflection && reflectionText === '') {
      setReflectionText(weekItem.reflection)
    }
  }, [weekItem, reflectionText])

  const saveReflection = useCallback((text: string) => {
    if (!weekItem) return
    if (reflectionTimer) clearTimeout(reflectionTimer)
    const timer = setTimeout(() => { updateItem(weekItem.id, { reflection: text }) }, 800)
    setReflectionTimer(timer)
  }, [weekItem, updateItem, reflectionTimer])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this? All nested goals will also be deleted.')) return
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) { alert('Failed to delete item') }
      else {
        if (id === weekId) { router.push(`/month/${parentMonth?.id || ''}`) }
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
              const remaining = data.items.filter((i: any) => i.parentId === weekId)
              if (remaining.length > 0) { const eq = Math.round((100 / remaining.length) * 10) / 10; remaining.forEach((d: any) => updateItem(d.id, { weight: eq })) }
            }
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  const handleAddGoal = async (categoryId: string) => {
    if (!newGoalTitle.trim() || !weekItem) return
    try {
      const existingGoals = weeklyGoals.filter(g => g.parentId === categoryId)
      const newCount = existingGoals.length + 1
      const equalWeight = Math.round((100 / newCount) * 10) / 10

      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 5,
          parentId: categoryId,
          title: newGoalTitle.trim(),
          weight: equalWeight,
          startDate: weekItem.startDate || new Date().toISOString(),
          endDate: weekItem.endDate || new Date().toISOString(),
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
      setNewGoalTitle('')
      setSelectedCategoryId('')
      setAddingGoal(false)
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
  if (!weekItem) return <div className="p-6 text-ink/60">Week not found.</div>

  const wScore = completionMap[weekItem.id] || 0
  const weekStart = weekItem.startDate ? new Date(weekItem.startDate) : new Date()
  const weekEnd = weekItem.endDate ? new Date(weekItem.endDate) : addDays(weekStart, 6)
  const totalDays = Math.round((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Build day slots matching the actual length of this week
  const daySlots = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(weekStart, i)
    const dayGoal = dailyGoals.find(dg => {
      if (!dg.startDate) return false
      return new Date(dg.startDate).toDateString() === date.toDateString()
    })
    return { date, dayGoal }
  })

  return (
    <div className="space-y-8 max-w-full pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-ink/50 flex-wrap">
        <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
        <ChevronRight className="w-3 h-3" />
        {parentMonth && <><button onClick={() => router.push(`/month/${parentMonth.id}`)} className="hover:text-gold transition">{parentMonth.title}</button><ChevronRight className="w-3 h-3" /></>}
        <span className="text-ink font-bold">{weekItem.title}</span>
      </div>

      {/* Week Header */}
      <div className="bg-surface border border-mist rounded-2xl p-8 relative">
        <button onClick={(e) => handleDelete(e, weekItem.id)} className="absolute top-4 right-4 p-2 text-ink/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete Week">
          <Trash2 className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-ink">{weekItem.title}</h1>
            <p className="text-sm text-ink/50 mt-2 font-mono">
              {format(weekStart, 'EEE, MMM d')} – {format(addDays(weekStart, 6), 'EEE, MMM d, yyyy')}
            </p>
          </div>
          <ProgressRing progress={wScore} size={72} />
        </div>
      </div>

      {/* Categories & Goals Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display font-bold text-ink">Categories & Goals</h2>
          <div className="flex items-center space-x-4">
            <button onClick={() => setAddingGoal(!addingGoal)} className="flex items-center space-x-1.5 text-xs text-ink/50 hover:text-gold transition">
              {addingGoal ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{addingGoal ? 'Cancel' : 'Add Goal'}</span>
            </button>
          </div>
        </div>

        {addingGoal && categories.length > 0 && (
          <div className="flex items-center space-x-2 mb-4">
            <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="flex-1 px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30">
              <option value="">Select category...</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
            </select>
            <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGoal(selectedCategoryId)}
              placeholder="New goal..." className="flex-1 px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30" autoFocus />
            <button onClick={() => handleAddGoal(selectedCategoryId)} className="px-3 py-2 bg-gold text-surface text-sm font-semibold rounded-lg hover:bg-gold/90 transition">Add</button>
          </div>
        )}

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
                      return (
                        <Card key={goal.id} className="p-4 hover:border-gold transition-colors group relative">
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
                          <button onClick={(e) => handleDelete(e, goal.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Goal">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Card>
                      )
                    })}
                  </div>
                  {catGoals.length === 0 && !addingGoal && (
                    <p className="text-xs text-ink/40 italic">No goals yet. Click + to add one.</p>
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

      {/* Days Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display font-bold text-ink">Days</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {daySlots.map(({ date, dayGoal }, idx) => {
            const isToday = new Date().toDateString() === date.toDateString()
            const dScore = dayGoal ? (completionMap[dayGoal.id] || 0) : 0

            return (
              <Card key={idx} className={`p-4 hover:border-gold transition-colors cursor-pointer group relative min-h-[200px] ${isToday ? 'ring-2 ring-gold' : ''}`}
                onClick={() => dayGoal ? router.push(`/day/${format(date, 'yyyy-MM-dd')}`) : null}>
                {dayGoal && (
                  <button onClick={(e) => handleDelete(e, dayGoal.id)} className="absolute top-2 right-2 p-1 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Day">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className={`p-2 text-center rounded-lg mb-2 ${isToday ? 'bg-gold/10' : ''}`}>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink/50">{format(date, 'EEE')}</p>
                  <p className={`text-xl font-mono font-bold ${isToday ? 'text-gold' : 'text-ink'}`}>{format(date, 'd')}</p>
                </div>

                {dayGoal ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <ProgressRing progress={dScore} size={32} />
                      <span className="text-sm font-mono font-bold">{Math.round(dScore)}%</span>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <span className="text-[8px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                      <input type="range" min="0" max="100" step={1} value={dayGoal.weight || 0}
                        onChange={e => updateItem(dayGoal.id, { weight: parseFloat(e.target.value) || 0 })}
                        className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                      <span className="text-[8px] font-mono text-ink/50">{Math.round(dayGoal.weight || 0)}%</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[8px] text-ink/40 block truncate">{dayGoal.title}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-ink/20 text-center mt-4">No goal set</p>
                )}
              </Card>
            )
          })}
        </div>
        {dailyGoals.length > 0 && (
          <div className="flex justify-end mt-2">
            <span className={`text-[10px] font-mono ${Math.round(dayWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
              Total: {Math.round(dayWeightSum)}%
            </span>
          </div>
        )}
        {dailyGoals.length === 0 && (
          <p className="text-sm text-ink/40 italic">No days set up for this week.</p>
        )}
      </div>

      {/* Reflection Section */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="w-5 h-5 text-gold" />
          <h2 className="text-2xl font-display font-bold text-ink">Week Reflection</h2>
        </div>
        <Card className="p-5">
          <textarea value={reflectionText}
            onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
            placeholder="Reflect on this week..."
            className="w-full h-48 bg-paper border border-mist rounded-lg p-4 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
          <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
        </Card>
      </div>
    </div>
  )
}