'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter } from 'next/navigation'
import { Lock, Unlock, RotateCcw, Plus, X, Trash2, BookOpen, Download } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'

export default function YearPage() {
  const router = useRouter()
  const { items, completionMap, setItems, updateItem, getFlatItems, updateItemScoreMode } = useHierarchyStore()
  const { showToast, confirm } = useToast()
  const [loading, setLoading] = useState(true)
  const [lockedWeights, setLockedWeights] = useState<Record<string, boolean>>({})
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({})
  const [addingGoal, setAddingGoal] = useState<string | null>(null)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryTitle, setNewCategoryTitle] = useState('')
  const [reflectionText, setReflectionText] = useState('')
  const [reflectionTimer, setReflectionTimer] = useState<NodeJS.Timeout | null>(null)

  // Fetch items
  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/items?t=' + Date.now())
    const data = await res.json()
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
  }, [setItems])

  useEffect(() => {
    fetchItems().finally(() => setLoading(false))
  }, [fetchItems])

  // Layer references
  const flatItems = getFlatItems()
  const yearItem = flatItems.find(i => i.layer === 0)
  const categories = flatItems.filter(i => i.layer === 1 && i.parentId === yearItem?.id)
  const yearlyGoals = flatItems.filter(i => i.layer === 2)
  const quarters = flatItems.filter(i => i.layer === 3)

  // Initialize category weights from data
  useEffect(() => {
    if (categories.length > 0 && Object.keys(categoryWeights).length === 0) {
      const w: Record<string, number> = {}
      categories.forEach(c => { w[c.id] = c.weight })
      setCategoryWeights(w)
    }
  }, [categories, categoryWeights])

  // Initialize reflection text
  useEffect(() => {
    if (yearItem?.reflection && reflectionText === '') {
      setReflectionText(yearItem.reflection)
    }
  }, [yearItem, reflectionText])

  // Auto-save reflection with debounce
  const saveReflection = useCallback((text: string) => {
    if (!yearItem) return
    if (reflectionTimer) clearTimeout(reflectionTimer)
    const timer = setTimeout(() => {
      updateItem(yearItem.id, { reflection: text })
    }, 800)
    setReflectionTimer(timer)
  }, [yearItem, updateItem, reflectionTimer])

  // Category weight slider logic
  const handleWeightChange = (catId: string, newVal: number) => {
    const newWeights = { ...categoryWeights }
    newWeights[catId] = newVal

    const newLocked = { ...lockedWeights, [catId]: true }
    setLockedWeights(newLocked)

    const lockedSum = Object.entries(newWeights)
      .filter(([id]) => newLocked[id])
      .reduce((sum, [, w]) => sum + w, 0)

    if (lockedSum > 100) {
      newWeights[catId] = newVal - (lockedSum - 100)
      return
    }

    const unlockedIds = categories.filter(c => !newLocked[c.id]).map(c => c.id)
    const remainder = 100 - lockedSum
    const perUnlocked = unlockedIds.length > 0 ? remainder / unlockedIds.length : 0

    unlockedIds.forEach(id => {
      newWeights[id] = Math.round(perUnlocked * 10) / 10
    })

    setCategoryWeights(newWeights)

    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const resetWeights = () => {
    const equal = Math.round((100 / categories.length) * 10) / 10
    const newWeights: Record<string, number> = {}
    categories.forEach(c => { newWeights[c.id] = equal })
    setCategoryWeights(newWeights)
    setLockedWeights({})
    Object.entries(newWeights).forEach(([id, w]) => {
      updateItem(id, { weight: w })
    })
  }

  const toggleLock = (catId: string) => {
    setLockedWeights(prev => ({ ...prev, [catId]: !prev[catId] }))
  }

  const handleAddGoal = async (categoryId: string) => {
    if (!newGoalTitle.trim()) return
    try {
      const existingGoals = yearlyGoals.filter(g => g.parentId === categoryId)
      const newCount = existingGoals.length + 1
      const equalWeight = Math.round((100 / newCount) * 10) / 10

      const goalRes = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 2,
          parentId: categoryId,
          title: newGoalTitle.trim(),
          weight: equalWeight,
          startDate: yearItem?.startDate || new Date().toISOString(),
          endDate: yearItem?.endDate || new Date().toISOString(),
        })
      })
      const goalData = await goalRes.json()

      const allGoals = [...existingGoals]
      if (goalData.success && goalData.item) {
        allGoals.push(goalData.item)
      }
      const perGoal = Math.round((100 / allGoals.length) * 10) / 10
      allGoals.forEach(g => {
        updateItem(g.id, { weight: perGoal })
      })

      if (goalData.success && goalData.item) {
        const quartersToCreate = [
          { title: 'Q1 Objective', startMonth: 0, endMonth: 2 },
          { title: 'Q2 Objective', startMonth: 3, endMonth: 5 },
          { title: 'Q3 Objective', startMonth: 6, endMonth: 8 },
          { title: 'Q4 Objective', startMonth: 9, endMonth: 11 },
        ]
        const year = new Date(yearItem?.startDate || new Date()).getFullYear()
        await Promise.all(quartersToCreate.map(q => {
          const qStart = new Date(year, q.startMonth, 1)
          const qEnd = new Date(year, q.endMonth + 1, 0)
          return fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              layer: 3, parentId: goalData.item.id, title: q.title, weight: 25,
              startDate: qStart.toISOString(), endDate: qEnd.toISOString(),
            })
          })
        }))
      }

      const res = await fetch('/api/items')
      const data = await res.json()
      if (data.items) {
        const itemMap = new Map()
        data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
        const tree: any[] = []
        data.items.forEach((item: any) => {
          if (item.parentId) {
            const parent = itemMap.get(item.parentId)
            if (parent) parent.children.push(itemMap.get(item.id))
          } else { tree.push(itemMap.get(item.id)) }
        })
        setItems(tree)
      }
      setNewGoalTitle('')
      setAddingGoal(null)
    } catch (e) { console.error(e) }
  }

  const handleAddCategory = async () => {
    if (!newCategoryTitle.trim() || !yearItem) return
    try {
      const resPost = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 1, parentId: yearItem.id, title: newCategoryTitle.trim(), weight: 0,
          startDate: yearItem.startDate || new Date().toISOString(),
          endDate: yearItem.endDate || new Date().toISOString(),
        })
      })
      const postData = await resPost.json()
      if (!resPost.ok || !postData.success) {
        showToast('Failed to add category: ' + (postData.error || 'Unknown error'), 'error')
        return
      }
      const res = await fetch('/api/items?t=' + Date.now())
      const data = await res.json()
      if (data.items) {
        const itemMap = new Map()
        data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
        const tree: any[] = []
        data.items.forEach((item: any) => {
          if (item.parentId) {
            const parent = itemMap.get(item.parentId)
            if (parent) parent.children.push(itemMap.get(item.id))
          } else { tree.push(itemMap.get(item.id)) }
        })
        setItems(tree)
        setCategoryWeights(prev => ({ ...prev, [postData.item.id]: 0 }))
      }
      setNewCategoryTitle('')
      setAddingCategory(false)
    } catch (e) { console.error(e); showToast('Error adding category.', 'error') }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!(await confirm('Are you sure you want to delete this? All nested goals will also be deleted.'))) return
    try {
      const goalToDelete = yearlyGoals.find(g => g.id === id)
      const parentCategoryId = goalToDelete?.parentId
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (!res.ok) { showToast('Failed to delete item', 'error') }
      else {
        await fetchItems()
        if (parentCategoryId) {
          const remainingGoals = yearlyGoals.filter(g => g.parentId === parentCategoryId && g.id !== id)
          if (remainingGoals.length > 0) {
            const perGoal = Math.round((100 / remainingGoals.length) * 10) / 10
            remainingGoals.forEach(g => updateItem(g.id, { weight: perGoal }))
          }
        }
      }
    } catch (e) { console.error(e) }
  }

  const handleDownloadReport = async () => {
    const element = document.getElementById('report-content')
    if (!element) return

    const opt = {
      margin: 0.5,
      filename: `Year_Report_${new Date().getFullYear()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
    }

    try {
      showToast('Generating PDF Report...', 'info')
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf().set(opt as any).from(element).save()
      showToast('PDF Report downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF export failed:', err)
      showToast('Failed to export PDF', 'error')
    }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>
  if (!yearItem) return <div className="p-6 text-ink/60">Please seed the framework first from the dashboard.</div>

  // Group quarters by label for the quarters section
  const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterGroups = quarterLabels.map(label => {
    const qItems = quarters.filter(q => q.title.includes(label))
    const avgScore = qItems.length > 0 ? qItems.reduce((s, q) => s + (completionMap[q.id] || 0), 0) / qItems.length : 0
    return { label, items: qItems, avgScore }
  })

  return (
    <div className="space-y-8 max-w-full pb-12 stagger-children" id="report-content">
      {/* Year Vision Banner */}
      <div className="glass-gold glow-sm rounded-3xl p-8 text-center animate-slideUp border border-gold/20">
        <h1 className="text-5xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent mb-3">{yearItem.title || new Date().getFullYear()}</h1>
        {yearItem.theme && <p className="text-xl text-gold font-serif italic mb-3">"{yearItem.theme}"</p>}
        {yearItem.anchorScripture && <p className="text-sm text-ink/50 font-mono mb-5">{yearItem.anchorScripture}</p>}
        <p className="text-sm text-ink/80 max-w-xl mx-auto leading-relaxed">{yearItem.description}</p>
        <div className="max-w-md mx-auto mt-8 bg-black/20 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase text-ink/60">Overall Progress</span>
            <button onClick={handleDownloadReport} className="px-3 py-1.5 bg-gold/10 text-gold border border-gold/30 text-xs font-bold rounded-lg hover:bg-gold/20 transition-all flex items-center space-x-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>
          </div>
          <div className="flex justify-between items-end mb-1">
            <span className="text-xl font-bold font-mono">{Math.round(completionMap[yearItem.id] || 0)}%</span>
          </div>
          <ProgressBar progress={completionMap[yearItem.id] || 0} />
        </div>
      </div>

      {/* Categories with Goals */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-display font-bold text-ink flex items-center gap-3">
            Categories & Goals
            <span className="text-xs font-mono font-normal bg-white/10 px-2 py-1 rounded-full text-ink/60">{categories.length}</span>
          </h2>
          <div className="flex items-center space-x-4">
            <button onClick={() => setAddingCategory(!addingCategory)} className="flex items-center space-x-1.5 text-xs text-ink/50 hover:text-gold transition">
              {addingCategory ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{addingCategory ? 'Cancel' : 'Add Category'}</span>
            </button>
            <button onClick={resetWeights} className="flex items-center space-x-1.5 text-xs text-gold hover:text-gold/80 transition">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Equal</span>
            </button>
            <button onClick={() => {
              categories.forEach(c => updateItemScoreMode(c.id, 'auto'))
              showToast('Scores set to auto-calculate', 'success')
            }} className="flex items-center space-x-1.5 text-xs text-sage hover:text-sage/80 transition">
              <span>Auto Scores</span>
            </button>
          </div>
        </div>

        {addingCategory && (
          <div className="flex items-center space-x-2 mb-6 animate-fadeIn">
            <input type="text" value={newCategoryTitle} onChange={e => setNewCategoryTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              placeholder="New category..." className="flex-1 px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all placeholder:text-ink/30" autoFocus />
            <button onClick={handleAddCategory} className="px-5 py-3 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow hover:glow-gold transition-all shadow-lg shadow-gold/20 active:scale-95">Add</button>
          </div>
        )}

        <div className="space-y-6">
          {categories.map(category => {
            const w = categoryWeights[category.id] ?? category.weight
            const isLocked = lockedWeights[category.id] || false
            const catScore = completionMap[category.id] || 0
            const categoryGoals = yearlyGoals.filter(g => g.parentId === category.id)
            const goalWeightSum = categoryGoals.reduce((s, g) => s + (g.weight || 0), 0)

            return (
              <Card key={category.id} className="p-5 space-y-4">
                {/* Category Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => toggleLock(category.id)} className="p-1 hover:bg-mist rounded transition" title={isLocked ? 'Unlock weight' : 'Lock weight'}>
                        {isLocked ? <Lock className="w-3.5 h-3.5 text-gold" /> : <Unlock className="w-3.5 h-3.5 text-ink/30" />}
                      </button>
                      <h3 className="text-lg font-bold text-ink">{category.title}</h3>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Score:</span>
                        <input type="number" min="0" max="100" value={Math.round(catScore)}
                          onChange={e => updateItemScoreMode(category.id, 'manual', parseFloat(e.target.value) || 0)}
                          className="w-12 px-1 py-0.5 text-[10px] font-mono bg-white/[0.06] rounded border border-transparent hover:border-white/20 focus:bg-white/[0.1] focus:border-gold outline-none transition-colors" />
                        <span className="text-[9px] text-ink/50">%</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-gold w-14 text-right">{Math.round(w)}%</span>
                      <button onClick={(e) => handleDelete(e, category.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500" title="Delete Category">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={w}
                    onChange={(e) => handleWeightChange(category.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                  <ProgressBar progress={catScore} colorClass="bg-sage" />
                </div>

                {/* Goals */}
                <div className="space-y-3 pt-2 border-t border-mist">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-ink/50">Goals</span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-mono ${Math.round(goalWeightSum) === 100 ? 'text-sage' : 'text-coral'}`}>
                        Total: {Math.round(goalWeightSum)}%
                      </span>
                      <button onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)} className="p-1 hover:bg-mist rounded-lg transition text-ink/50 hover:text-gold">
                        {addingGoal === category.id ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {addingGoal === category.id && (
                    <div className="flex items-center space-x-2 animate-fadeIn mb-3">
                      <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddGoal(category.id)}
                        placeholder="New annual goal..." className="flex-1 px-4 py-2.5 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all" autoFocus />
                      <button onClick={() => handleAddGoal(category.id)} className="px-4 py-2.5 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20">Add</button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryGoals.map(goal => {
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
                              <input type="range" min="0" max="100" step={1} value={goal.weight}
                                onChange={e => updateItem(goal.id, { weight: parseFloat(e.target.value) || 0 })}
                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-gold" />
                              <span className="text-[9px] font-mono text-ink/50">{Math.round(goal.weight)}%</span>
                            </div>
                            <div className="flex-1">
                              <span className="text-[9px] text-ink/50 uppercase tracking-wider block mb-0.5">Score</span>
                              <input type="range" min="0" max="100" step={1} value={Math.round(gScore)}
                                onChange={e => updateItem(goal.id, { progress: parseFloat(e.target.value) || 0 })}
                                className="w-full h-1.5 bg-mist rounded-full appearance-none cursor-pointer accent-sage" />
                              <span className="text-[9px] font-mono text-ink/50">{Math.round(gScore)}%</span>
                            </div>
                          </div>
                          <button onClick={(e) => handleDelete(e, goal.id)} className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition text-ink/50 hover:text-red-400 z-10" title="Delete Goal">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Card>
                      )
                    })}
                  </div>
                  {categoryGoals.length === 0 && !addingGoal && (
                    <p className="text-xs text-ink/40 italic">No goals yet. Click + to add one.</p>
                  )}
                </div>
              </Card>
            )
          })}
          {categories.length === 0 && <p className="text-sm text-ink/50">No categories. Seed the framework first.</p>}
        </div>
      </div>

      {/* Year Reflection - single section below all categories */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="w-5 h-5 text-gold" />
          <h2 className="text-2xl font-display font-bold text-ink">Year Reflection</h2>
        </div>
        <Card className="p-6">
          <textarea value={reflectionText}
            onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
            placeholder="Reflect on your year so far... What's working? What needs to change?"
            className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 placeholder:text-ink/30 transition-all" />
          <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
        </Card>
      </div>

      {/* Quarters Section - below reflection */}
      <div>
        <h2 className="text-3xl font-display font-bold text-ink mb-6">Quarters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quarterGroups.map(({ label, items: qItems, avgScore }) => {
            const firstQ = qItems[0]
            return (
              <Card key={label} className={`p-5 transition-colors group ${firstQ ? 'hover:border-gold cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => { if (firstQ) router.push(`/year/${label}`) }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{label}</p>
                    <p className="text-[10px] text-ink/40 mt-0.5">
                      {label === 'Q1' ? 'Jan–Mar' : label === 'Q2' ? 'Apr–Jun' : label === 'Q3' ? 'Jul–Sep' : 'Oct–Dec'}
                    </p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <ProgressRing progress={avgScore} size={48} />
                  <div className="text-right">
                    <p className="text-xl font-mono font-bold">{Math.round(avgScore)}%</p>
                    <p className="text-[10px] text-ink/40">{qItems.length} goals</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}