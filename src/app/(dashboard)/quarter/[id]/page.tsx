'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Plus, X, Trash2, BookOpen, Lock, Unlock, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'

export default function QuarterPage() {
  const router = useRouter()
  const params = useParams()
  const quarterId = params.id as string

  const { items, completionMap, setItems, updateItem, updateItemScoreMode } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [addingMonth, setAddingMonth] = useState(false)
  const [newMonthTitle, setNewMonthTitle] = useState('')
  const [reflectionPopup, setReflectionPopup] = useState<string | null>(null)
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

  const [lockedWeights, setLockedWeights] = useState<Record<string, boolean>>({})
  const [monthWeights, setMonthWeights] = useState<Record<string, number>>({})

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

  // Initialize month weights from data
  useEffect(() => {
    if (monthlyGoals.length > 0 && Object.keys(monthWeights).length === 0) {
      const w: Record<string, number> = {}
      monthlyGoals.forEach(m => { w[m.id] = m.weight || 0 })
      setMonthWeights(w)
    }
  }, [monthlyGoals, monthWeights])

  const handleWeightChange = (monthId: string, newVal: number) => {
    const newWeights = { ...monthWeights }
    newWeights[monthId] = newVal

    const newLocked = { ...lockedWeights, [monthId]: true }
    setLockedWeights(newLocked)

    const lockedSum = Object.entries(newWeights)
      .filter(([id]) => newLocked[id])
      .reduce((sum, [, w]) => sum + w, 0)

    if (lockedSum > 100) {
      newWeights[monthId] = newVal - (lockedSum - 100)
      return
    }

    const unlockedIds = monthlyGoals.filter(m => !newLocked[m.id]).map(m => m.id)
    const remainder = 100 - lockedSum
    const perUnlocked = unlockedIds.length > 0 ? remainder / unlockedIds.length : 0

    unlockedIds.forEach(id => {
      newWeights[id] = Math.round(perUnlocked * 10) / 10
    })

    setMonthWeights(newWeights)
    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const handleScoreChange = (monthId: string, newScore: number) => {
    updateItemScoreMode(monthId, 'manual', newScore)
  }

  const resetWeights = () => {
    const equal = Math.round((100 / monthlyGoals.length) * 10) / 10
    const newWeights: Record<string, number> = {}
    monthlyGoals.forEach(m => { newWeights[m.id] = equal })
    setMonthWeights(newWeights)
    setLockedWeights({})
    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const resetScores = () => {
    monthlyGoals.forEach(m => updateItemScoreMode(m.id, 'auto'))
  }

  const toggleLock = (monthId: string) => {
    setLockedWeights(prev => ({ ...prev, [monthId]: !prev[monthId] }))
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

        // Reset month weights state so it reinitializes
        setMonthWeights({})
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
              setMonthWeights({})
            }
          })
        }
      }
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
  if (!quarterItem) return <div className="p-6 text-ink/60">Quarter not found.</div>

  const qScore = completionMap[quarterItem.id] || 0
  const monthWeightSum = monthlyGoals.reduce((s, m) => s + (monthWeights[m.id] ?? m.weight ?? 0), 0)

  return (
    <div className="space-y-8 max-w-full pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-ink/50 flex-wrap">
        <button onClick={() => router.push('/year')} className="hover:text-gold transition">Year</button>
        <ChevronRight className="w-3 h-3" />
        {parentCategory && <><span>{parentCategory.title}</span><ChevronRight className="w-3 h-3" /></>}
        {parentYearlyGoal && <><span>{parentYearlyGoal.title}</span><ChevronRight className="w-3 h-3" /></>}
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

      {/* Quarter & Months Section (Exact Features of Categories & Goals) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display font-bold text-ink">Quarter & Months</h2>
          <div className="flex items-center space-x-4">
            <button onClick={() => setAddingMonth(!addingMonth)} className="flex items-center space-x-1.5 text-xs text-ink/50 hover:text-gold transition">
              {addingMonth ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{addingMonth ? 'Cancel' : 'Add Month'}</span>
            </button>
            <button onClick={resetWeights} className="flex items-center space-x-1.5 text-xs text-gold hover:text-gold/80 transition">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Equal</span>
            </button>
            <button onClick={resetScores} className="text-xs text-sage hover:text-sage/80 transition">Auto Scores</button>
          </div>
        </div>

        {addingMonth && (
          <div className="flex items-center space-x-2 mb-4">
            <input type="text" value={newMonthTitle} onChange={e => setNewMonthTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMonth()}
              placeholder="New month..." className="flex-1 px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30" autoFocus />
            <button onClick={handleAddMonth} className="px-3 py-2 bg-gold text-surface text-sm font-semibold rounded-lg hover:bg-gold/90 transition">Add</button>
          </div>
        )}

        <div className="space-y-6">
          <Card className="p-5 space-y-4 border-gold">
            {/* "Category" Header (The Quarter Itself) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-ink">{quarterItem.title}</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <span className="text-[9px] text-ink/50 uppercase tracking-wider">Score:</span>
                    <input type="number" min="0" max="100" value={Math.round(qScore)}
                      onChange={e => updateItemScoreMode(quarterItem.id, 'manual', parseFloat(e.target.value) || 0)}
                      className="w-12 px-1 py-0.5 text-[9px] bg-mist/30 rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none" />
                    <span className="text-[9px] text-ink/50">%</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-gold w-14 text-right">{Math.round(quarterItem.weight || 0)}%</span>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Quarter Weight (Relative to Year)</span>
                <input type="range" min={0} max={100} step={1} value={quarterItem.weight || 0}
                  onChange={(e) => updateItem(quarterItem.id, { weight: parseFloat(e.target.value) || 0 })}
                  className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
              </div>
              <ProgressBar progress={qScore} colorClass="bg-sage" />
            </div>

            {/* "Goals" (The Months) */}
            <div className="space-y-3 pt-2 border-t border-mist">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-ink/50">Months</span>
                <span className={`text-[10px] font-mono ${Math.round(monthWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
                  Total: {Math.round(monthWeightSum)}%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {monthlyGoals.map(month => {
                  const mScore = completionMap[month.id] || 0
                  const w = monthWeights[month.id] ?? month.weight ?? 0
                  const isLocked = lockedWeights[month.id] || false

                  return (
                    <Card key={month.id} className="p-4 hover:border-gold transition-colors group relative cursor-pointer" onClick={() => router.push(`/month/${month.id}`)}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <button onClick={(e) => { e.stopPropagation(); toggleLock(month.id); }} className="p-1 hover:bg-mist rounded transition" title={isLocked ? 'Unlock weight' : 'Lock weight'}>
                            {isLocked ? <Lock className="w-3.5 h-3.5 text-gold" /> : <Unlock className="w-3.5 h-3.5 text-ink/30" />}
                          </button>
                          <h4 className="font-bold text-ink text-sm truncate pr-6">{month.title}</h4>
                        </div>
                        <div className="flex items-center space-x-2">
                          <ProgressRing progress={mScore} size={32} />
                          <span className="text-base font-mono font-bold">{Math.round(mScore)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                        <div className="flex-1">
                          <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Weight</span>
                          <input type="range" min="0" max="100" step={1} value={w}
                            onChange={e => handleWeightChange(month.id, parseFloat(e.target.value) || 0)}
                            className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                          <span className="text-[9px] font-mono text-ink/50">{Math.round(w)}%</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                          <input type="range" min="0" max="100" step={1} value={Math.round(mScore)}
                            onChange={e => handleScoreChange(month.id, parseFloat(e.target.value) || 0)}
                            className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                          <span className="text-[9px] font-mono text-ink/50">{Math.round(mScore)}%</span>
                        </div>
                      </div>
                      <button onClick={(e) => handleDelete(e, month.id)} className="absolute top-2 right-2 p-1.5 bg-paper/80 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 z-10" title="Delete Month">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Card>
                  )
                })}
              </div>
              {monthlyGoals.length === 0 && !addingMonth && (
                <p className="text-xs text-ink/40 italic">No months yet. Click + to add one.</p>
              )}
            </div>
          </Card>
        </div>
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
