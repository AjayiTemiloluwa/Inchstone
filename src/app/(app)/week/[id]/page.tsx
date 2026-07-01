'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen, Lock, Unlock, RotateCcw } from 'lucide-react'
import { format, addDays } from 'date-fns'

export default function WeekPage() {
  const router = useRouter()
  const params = useParams()
  const weekId = params.id as string

  const { items, completionMap, setItems, updateItem, updateItemScoreMode } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [reflectionPopup, setReflectionPopup] = useState<string | null>(null)
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)
  const [weekScoreMode, setWeekScoreMode] = useState<'auto' | 'manual'>('auto')

  const [lockedWeights, setLockedWeights] = useState<Record<string, boolean>>({})
  const [dayWeights, setDayWeights] = useState<Record<string, number>>({})

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
  const parentQuarter = parentMonth?.parentId ? findItem(parentMonth.parentId) : undefined
  const parentYearlyGoal = parentQuarter?.parentId ? findItem(parentQuarter.parentId) : undefined
  const parentCategory = parentYearlyGoal?.parentId ? findItem(parentYearlyGoal.parentId) : undefined

  const [isManualMode, setIsManualMode] = useState(false)
  const [manualScore, setManualScore] = useState(0)

  const weekStart = weekItem?.startDate ? new Date(weekItem.startDate) : new Date()
  const weekEnd = weekItem?.endDate ? new Date(weekItem.endDate) : addDays(weekStart, 6)
  const totalDays = Math.round((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Auto-create days if none exist - calculate proper day count based on week date range
  const ensureDays = useCallback(async () => {
    if (!weekItem || dailyGoals.length > 0) return
    const perWeight = Math.round((100 / totalDays) * 10) / 10
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    for (let d = 0; d < totalDays; d++) {
      const dDate = addDays(weekStart, d)
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
      setDayWeights({})
    }
  }, [weekItem, dailyGoals.length, setItems, totalDays, weekStart])

  useEffect(() => {
    if (!loading && weekItem && dailyGoals.length === 0) {
      ensureDays()
    }
  }, [loading, weekItem, dailyGoals.length, ensureDays])

  // Initialize day weights from data
  useEffect(() => {
    if (dailyGoals.length > 0 && Object.keys(dayWeights).length === 0) {
      const w: Record<string, number> = {}
      dailyGoals.forEach(m => { w[m.id] = m.weight || 0 })
      setDayWeights(w)
    }
  }, [dailyGoals, dayWeights])

  const handleWeightChange = (dayId: string, newVal: number) => {
    const newWeights = { ...dayWeights }
    newWeights[dayId] = newVal

    const newLocked = { ...lockedWeights, [dayId]: true }
    setLockedWeights(newLocked)

    const lockedSum = Object.entries(newWeights)
      .filter(([id]) => newLocked[id])
      .reduce((sum, [, w]) => sum + w, 0)

    if (lockedSum > 100) {
      newWeights[dayId] = newVal - (lockedSum - 100)
      return
    }

    const unlockedIds = dailyGoals.filter(m => !newLocked[m.id]).map(m => m.id)
    const remainder = 100 - lockedSum
    const perUnlocked = unlockedIds.length > 0 ? remainder / unlockedIds.length : 0

    unlockedIds.forEach(id => {
      newWeights[id] = Math.round(perUnlocked * 10) / 10
    })

    setDayWeights(newWeights)
    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const resetWeights = () => {
    const equal = Math.round((100 / dailyGoals.length) * 10) / 10
    const newWeights: Record<string, number> = {}
    dailyGoals.forEach(m => { newWeights[m.id] = equal })
    setDayWeights(newWeights)
    setLockedWeights({})
    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const toggleLock = (dayId: string) => {
    setLockedWeights(prev => ({ ...prev, [dayId]: !prev[dayId] }))
  }

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
    if (!confirm('Are you sure you want to delete this? All nested tasks will also be deleted.')) return
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
              setDayWeights({})
            }
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
  if (!weekItem) return <div className="p-6 text-ink/60">Week not found.</div>

  const wScore = completionMap[weekItem.id] || 0
  const dayWeightSum = dailyGoals.reduce((s, m) => s + (dayWeights[m.id] ?? m.weight ?? 0), 0)

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
        {parentCategory && <><span>{parentCategory.title}</span><ChevronRight className="w-3 h-3" /></>}
        {parentYearlyGoal && <><span>{parentYearlyGoal.title}</span><ChevronRight className="w-3 h-3" /></>}
        {parentQuarter && <><button onClick={() => router.push(`/quarter/${parentQuarter.id}`)} className="hover:text-gold transition">{parentQuarter.title}</button><ChevronRight className="w-3 h-3" /></>}
        {parentMonth && <><button onClick={() => router.push(`/month/${parentMonth.id}`)} className="hover:text-gold transition">{parentMonth.startDate ? format(new Date(parentMonth.startDate), 'MMM') : parentMonth.title}</button><ChevronRight className="w-3 h-3" /></>}
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
              {format(weekStart, 'EEE, MMM d')} – {format(weekEnd, 'EEE, MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const newMode = weekScoreMode === 'manual' ? 'auto' : 'manual'
                setWeekScoreMode(newMode)
                updateItemScoreMode(weekItem.id, newMode, newMode === 'manual' ? Math.round(wScore) : undefined)
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wide transition ${weekScoreMode === 'manual' ? 'bg-gold text-surface' : 'bg-mist text-ink/60 hover:bg-mist/80'}`}
            >
              {weekScoreMode === 'manual' ? 'Manual' : 'Auto'}
            </button>
            <ProgressRing progress={wScore} size={72} />
          </div>
        </div>
      </div>

      {/* Week & Days Section (Exact Features of Categories & Goals) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display font-bold text-ink">Week & Days</h2>
          <div className="flex items-center space-x-4">
            <button onClick={resetWeights} className="flex items-center space-x-1.5 text-xs text-gold hover:text-gold/80 transition">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Equal</span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-5 space-y-4 border-gold">
            {/* "Category" Header (The Week Itself) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-ink">{weekItem.title}</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <span className="text-[9px] text-ink/50 uppercase tracking-wider">Score:</span>
                    <input type="number" min="0" max="100" value={Math.round(wScore)}
                      onChange={e => updateItem(weekItem.id, { progress: parseFloat(e.target.value) || 0 })}
                      className="w-12 px-1 py-0.5 text-[9px] bg-mist/30 rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none" />
                    <span className="text-[9px] text-ink/50">%</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-gold w-14 text-right">{Math.round(weekItem.weight || 0)}%</span>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Week Weight (Relative to Month)</span>
                <input type="range" min={0} max={100} step={1} value={weekItem.weight || 0}
                  onChange={(e) => updateItem(weekItem.id, { weight: parseFloat(e.target.value) || 0 })}
                  className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
              </div>
              <ProgressBar progress={wScore} colorClass="bg-sage" />
            </div>

            {/* "Goals" (The Days) */}
            <div className="space-y-3 pt-2 border-t border-mist">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-ink/50">Days</span>
                <span className={`text-[10px] font-mono ${Math.round(dayWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
                  Total: {Math.round(dayWeightSum)}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                {daySlots.map(({ date, dayGoal }, idx) => {
                  const isToday = new Date().toDateString() === date.toDateString()
                  const dScore = dayGoal ? (completionMap[dayGoal.id] || 0) : 0
                  const w = dayGoal ? (dayWeights[dayGoal.id] ?? dayGoal.weight ?? 0) : 0
                  const isLocked = dayGoal ? (lockedWeights[dayGoal.id] || false) : false

                  return (
                    <Card key={idx} className={`p-4 hover:border-gold transition-colors group relative cursor-pointer ${isToday ? 'ring-2 ring-gold' : ''}`} onClick={() => dayGoal ? router.push(`/day/${format(date, 'yyyy-MM-dd')}`) : null}>
                      {dayGoal && (
                        <button onClick={(e) => handleDelete(e, dayGoal.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Day">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <div className={`p-2 text-center rounded-lg mb-2 ${isToday ? 'bg-gold/10' : ''}`}>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-ink/50">{format(date, 'EEE')}</p>
                            <p className={`text-xl font-mono font-bold ${isToday ? 'text-gold' : 'text-ink'}`}>{format(date, 'd')}</p>
                          </div>

                          {dayGoal ? (
                            <div className="flex items-center justify-between mb-2">
                              <button onClick={(e) => { e.stopPropagation(); toggleLock(dayGoal.id); }} className="p-1 hover:bg-mist rounded transition -ml-1" title={isLocked ? 'Unlock weight' : 'Lock weight'}>
                                {isLocked ? <Lock className="w-3.5 h-3.5 text-gold" /> : <Unlock className="w-3.5 h-3.5 text-ink/30" />}
                              </button>
                              <div className="flex items-center space-x-2">
                                <ProgressRing progress={dScore} size={28} />
                                <span className="text-xs font-mono font-bold">{Math.round(dScore)}%</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-ink/20 text-center mt-4">No goal set</p>
                          )}
                        </div>

                        {dayGoal && (
                          <div className="space-y-3 mt-4" onClick={e => e.stopPropagation()}>
                            <div>
                              <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                              <input type="range" min="0" max="100" step={1} value={w}
                                onChange={e => handleWeightChange(dayGoal.id, parseFloat(e.target.value) || 0)}
                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                              <span className="text-[9px] font-mono text-ink/50">{Math.round(w)}%</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                              <input type="range" min="0" max="100" step={1} value={Math.round(dScore)}
                                onChange={e => updateItem(dayGoal.id, { progress: parseFloat(e.target.value) || 0 })}
                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                              <span className="text-[9px] font-mono text-ink/50">{Math.round(dScore)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
              {dailyGoals.length === 0 && (
                <p className="text-xs text-ink/40 italic">No days yet.</p>
              )}
            </div>
          </Card>
        </div>
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
            className="w-full h-32 bg-paper border border-mist rounded-lg p-3 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30" />
          <p className="text-[10px] text-ink/40 mt-1">Auto-saves as you type</p>
        </Card>
      </div>
    </div>
  )
}