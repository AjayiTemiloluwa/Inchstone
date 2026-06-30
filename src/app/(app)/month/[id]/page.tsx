'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen } from 'lucide-react'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import { getWeeksInMonth } from '@/lib/calendarUtils'

export default function MonthPage() {
  const router = useRouter()
  const params = useParams()
  const monthId = params.id as string

  const { items, completionMap, setItems, updateItem } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
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

  const monthItem = findItem(monthId)
  const weeklyGoals = monthItem?.children?.filter(c => c.layer === 5) || []
  const parentQuarter = monthItem?.parentId ? findItem(monthItem.parentId) : undefined
  const parentYearlyGoal = parentQuarter?.parentId ? findItem(parentQuarter.parentId) : undefined
  const parentCategory = parentYearlyGoal?.parentId ? findItem(parentYearlyGoal.parentId) : undefined
  const weekWeightSum = weeklyGoals.reduce((s, w) => s + (w.weight || 0), 0)

  // Auto-create weeks if none exist - calculate proper week ranges for the month
  const ensureWeeks = useCallback(async () => {
    if (!monthItem || weeklyGoals.length > 0) return
    const mStart = monthItem.startDate ? new Date(monthItem.startDate) : new Date()
    const weeksInMonth = getWeeksInMonth(mStart.getFullYear(), mStart.getMonth() + 1)
    const perWeight = Math.round((100 / weeksInMonth.length) * 10) / 10

    for (let w = 0; w < weeksInMonth.length; w++) {
      const weekDays = weeksInMonth[w]
      const wStart = weekDays[0].date
      const wEnd = weekDays[weekDays.length - 1].date
      const wStartStr = format(wStart, 'yyyy-MM-dd')
      const wEndStr = format(wEnd, 'yyyy-MM-dd')
      await fetch('/api/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer: 5, parentId: monthItem.id, title: `Week ${w + 1}`, weight: perWeight, startDate: wStartStr, endDate: wEndStr })
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
  }, [monthItem, weeklyGoals.length, setItems])

  useEffect(() => {
    if (!loading && monthItem && weeklyGoals.length === 0) {
      ensureWeeks()
    }
  }, [loading, monthItem, weeklyGoals.length, ensureWeeks])

  // Find all categories
  const categories = items.filter(i => i.layer === 1)

  // Find monthly goals (layer 4) in the same category
  const monthlyGoalsFromCategory = items.filter(c => c.layer === 4 && c.parentId === parentQuarter?.id)

  // Group monthly goals by category
  const goalsByCategory: Record<string, Item[]> = {}
  monthlyGoalsFromCategory.forEach(goal => {
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

  // Initialize reflection
  useEffect(() => {
    if (monthItem?.reflection && reflectionText === '') {
      setReflectionText(monthItem.reflection)
    }
  }, [monthItem, reflectionText])

  const saveReflection = useCallback((text: string) => {
    if (!monthItem) return
    if (reflectionTimer) clearTimeout(reflectionTimer)
    const timer = setTimeout(() => { updateItem(monthItem.id, { reflection: text }) }, 800)
    setReflectionTimer(timer)
  }, [monthItem, updateItem, reflectionTimer])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this? All nested goals will also be deleted.')) return
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) { alert('Failed to delete item') }
      else {
        if (id === monthId) { router.push(`/quarter/${parentQuarter?.id || ''}`) }
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
              const remaining = data.items.filter((i: any) => i.parentId === monthId)
              if (remaining.length > 0) { const eq = Math.round((100 / remaining.length) * 10) / 10; remaining.forEach((w: any) => updateItem(w.id, { weight: eq })) }
            }
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
  if (!monthItem) return <div className="p-6 text-ink/60">Month not found.</div>

  const mScore = completionMap[monthItem.id] || 0
  const monthLabel = monthItem.startDate ? format(new Date(monthItem.startDate), 'MMMM yyyy') : monthItem.title

  return (
    <div className="space-y-8 max-w-full pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-ink/50 flex-wrap">
        <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
        <ChevronRight className="w-3 h-3" />
        {parentQuarter && <><button onClick={() => router.push(`/quarter/${parentQuarter.id}`)} className="hover:text-gold transition">{parentQuarter.title}</button><ChevronRight className="w-3 h-3" /></>}
        <span className="text-ink font-bold">{monthLabel}</span>
      </div>

      {/* Month Header */}
      <div className="bg-surface border border-mist rounded-2xl p-8 relative">
        <button onClick={(e) => handleDelete(e, monthItem.id)} className="absolute top-4 right-4 p-2 text-ink/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete Month">
          <Trash2 className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-ink">{monthLabel}</h1>
          </div>
          <ProgressRing progress={mScore} size={72} />
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
                      const isCurrentMonth = goal.id === monthItem?.id
                      return (
                        <Card key={goal.id} className={`p-4 hover:border-gold transition-colors group relative ${isCurrentMonth ? 'ring-2 ring-gold' : ''}`}>
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
                          {isCurrentMonth && (
                            <div className="mt-2 pt-2 border-t border-mist">
                              <span className="text-[9px] text-gold font-bold uppercase">Current Month</span>
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

      {/* Weeks Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display font-bold text-ink">Weeks</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {weeklyGoals.map((week, idx) => {
            const wScore = completionMap[week.id] || 0
            const wStart = week.startDate ? new Date(week.startDate) : new Date()
            const wEnd = week.endDate ? new Date(week.endDate) : addDays(wStart, 6)
            return (
              <Card key={week.id} className="p-5 hover:border-gold transition-colors cursor-pointer group relative" onClick={() => router.push(`/week/${week.id}`)}>
                <button onClick={(e) => handleDelete(e, week.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Week">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center justify-between mb-3 pr-6">
                  <div>
                    <p className="text-sm font-bold text-ink">{week.title}</p>
                    <p className="text-[10px] text-ink/40 font-mono mt-0.5">
                      {format(wStart, 'MMM d')} – {format(wEnd, 'MMM d')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink/30 group-hover:text-gold transition" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <ProgressRing progress={wScore} size={40} />
                  <span className="text-lg font-mono font-bold">{Math.round(wScore)}%</span>
                </div>
                <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                  <div className="flex-1">
                    <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                    <input type="range" min="0" max="100" step={1} value={week.weight || 0}
                      onChange={e => updateItem(week.id, { weight: parseFloat(e.target.value) || 0 })}
                      className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                    <span className="text-[9px] font-mono text-ink/50">{Math.round(week.weight || 0)}%</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                    <input type="range" min="0" max="100" step={1} value={Math.round(wScore)}
                      onChange={e => updateItem(week.id, { progress: parseFloat(e.target.value) || 0 })}
                      className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                    <span className="text-[9px] font-mono text-ink/50">{Math.round(wScore)}%</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
        {weeklyGoals.length > 0 && (
          <div className="flex justify-end mt-2">
            <span className={`text-[10px] font-mono ${Math.round(weekWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
              Total: {Math.round(weekWeightSum)}%
            </span>
          </div>
        )}
      </div>

      {/* Reflection Section */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="w-5 h-5 text-gold" />
          <h2 className="text-2xl font-display font-bold text-ink">Month Reflection</h2>
        </div>
        <Card className="p-5">
          <textarea value={reflectionText}
            onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
            placeholder="Reflect on this month..."
            className="w-full h-48 bg-paper border border-mist rounded-lg p-4 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
          <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
        </Card>
      </div>
    </div>
  )
}