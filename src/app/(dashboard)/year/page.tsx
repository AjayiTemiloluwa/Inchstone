'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useRouter } from 'next/navigation'
import { Lock, Unlock, RotateCcw, Plus, X, Trash2, BookOpen, Download, Database } from 'lucide-react'
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
  const [habitTitles, setHabitTitles] = useState<Array<{ title: string; total: number; completed: number; latestDate?: Date }>>([])
  const [addingHabit, setAddingHabit] = useState(false)
  const [newHabitTitle, setNewHabitTitle] = useState('')
  const [deleteHabitMenu, setDeleteHabitMenu] = useState<string | null>(null)

  // Fetch habits
  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/habits?range=year')
      if (res.ok) {
        const data = await res.json()
        setHabitTitles(data.uniqueTitles || [])
      }
    } catch (e) {
      console.error('Failed to fetch habits', e)
    }
  }, [])

  const handleStartAddHabit = () => {
    setAddingHabit(true)
    setNewHabitTitle('')
  }

  const handleAddHabit = async () => {
    if (!newHabitTitle.trim()) return
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newHabitTitle.trim() })
      })
      if (res.ok) {
        showToast('Habit created for the rest of the year!', 'success')
        setNewHabitTitle('')
        setAddingHabit(false)
        fetchHabits()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to create habit', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('Network error', 'error')
    }
  }

  const handleDeleteHabitFuture = async (title: string) => {
    try {
      const res = await fetch(`/api/habits?title=${encodeURIComponent(title)}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Future instances deleted (past history preserved)', 'success')
        fetchHabits()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to delete habit', 'error')
      }
    } catch (e) {
      console.error(e)
    }
    setDeleteHabitMenu(null)
  }

  const handleDeleteHabitAll = async (title: string) => {
    if (!(await confirm(`Delete ALL instances of "${title}" including past data? This cannot be undone.`))) {
      setDeleteHabitMenu(null)
      return
    }
    try {
      const res = await fetch(`/api/habits?title=${encodeURIComponent(title)}&deleteAll=true`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Habit deleted completely', 'success')
        fetchHabits()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to delete habit', 'error')
      }
    } catch (e) {
      console.error(e)
    }
    setDeleteHabitMenu(null)
  }

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
    fetchHabits()
  }, [fetchItems, fetchHabits])

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
    try {
      showToast('Generating PDF Report...', 'info')
      const jsPDF = (await import('jspdf')).default
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      let y = 20

      doc.setFontSize(18)
      doc.setTextColor(212, 175, 55)
      doc.setFont('helvetica', 'bold')
      doc.text(`Year Report: ${new Date().getFullYear()}`, margin, y)
      y += 10

      doc.setFontSize(11)
      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy')}`, margin, y)
      y += 8

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 8

      doc.setFontSize(12)
      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'bold')
      doc.text('Categories & Goals', margin, y)
      y += 7

      categories.forEach(cat => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.setFontSize(10)
        doc.setTextColor(212, 175, 55)
        doc.setFont('helvetica', 'bold')
        doc.text(cat.title, margin, y)
        y += 5

        const catScore = completionMap[cat.id] || 0
        doc.setFontSize(8)
        doc.setTextColor(30, 30, 30)
        doc.setFont('helvetica', 'normal')
        doc.text(`• Overall progress: ${Math.round(catScore)}%`, margin + 4, y)
        doc.setTextColor(143, 188, 143)
        doc.text(`${Math.round(catScore)}%`, pageWidth - margin, y, { align: 'right' })
        y += 5
        y += 3
      })

      doc.setFontSize(7)
      doc.setTextColor(200, 200, 200)
      doc.setFont('helvetica', 'italic')
      doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, 285)

      doc.save(`Year_Report_${new Date().getFullYear()}.pdf`)
      showToast('PDF Report downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF export failed:', err)
      showToast('Failed to export PDF', 'error')
    }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><span className="text-ink/60">Loading...</span></div>

  if (!yearItem) return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
      <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center animate-pulseGlow">
        <Database className="w-10 h-10 text-gold" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-ink">Framework Not Initialized</h2>
        <p className="text-sm text-ink/60 max-w-sm">Please seed the framework first from the dashboard to get started.</p>
      </div>
      <button
        onClick={() => router.push('/dashboard')}
        className="px-6 py-3 bg-gold text-surface font-semibold rounded-xl hover:bg-gold-glow active:scale-95 transition-all shadow-lg shadow-gold/20 min-h-[44px]"
      >
        Go to Dashboard
      </button>
    </div>
  )

  // Group quarters by label for the quarters section
  const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterGroups = quarterLabels.map(label => {
    const qItems = quarters.filter(q => q.title.includes(label))
    const avgScore = qItems.length > 0 ? qItems.reduce((s, q) => s + (completionMap[q.id] || 0), 0) / qItems.length : 0
    return { label, items: qItems, avgScore }
  })

  return (
    <div className="space-y-6 sm:space-y-8 max-w-full pb-24 lg:pb-12 stagger-children" id="report-content">
      {/* Year Vision Banner */}
      <div className="glass-gold glow-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center animate-slideUp border border-gold/20">
        <h1 className="text-4xl sm:text-5xl font-display font-bold bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent mb-3">{yearItem.title || new Date().getFullYear()}</h1>
        {yearItem.theme && <p className="text-lg sm:text-xl text-gold font-serif italic mb-3">"{yearItem.theme}"</p>}
        {yearItem.anchorScripture && <p className="text-xs sm:text-sm text-ink/50 font-mono mb-5">{yearItem.anchorScripture}</p>}
        <p className="text-xs sm:text-sm text-ink/80 max-w-xl mx-auto leading-relaxed px-4">{yearItem.description}</p>
        <div className="max-w-md mx-auto mt-6 sm:mt-8 bg-black/20 p-4 sm:p-6 rounded-2xl backdrop-blur-sm border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase text-ink/60">Overall Progress</span>
            <button onClick={handleDownloadReport} className="px-3 py-2 bg-gold/10 text-gold border border-gold/30 text-xs font-bold rounded-lg hover:bg-gold/20 active:scale-95 transition-all flex items-center space-x-1.5 min-h-[36px]">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report</span>
            </button>
          </div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{Math.round(completionMap[yearItem.id] || 0)}%</span>
          </div>
          <ProgressBar progress={completionMap[yearItem.id] || 0} />
        </div>
      </div>

      {/* Categories with Goals */}
      <div>
        {/* Mobile-optimized header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink flex items-center gap-2 sm:gap-3">
              Categories & Goals
              <span className="text-[10px] sm:text-xs font-mono font-normal bg-white/10 px-2 py-0.5 sm:py-1 rounded-full text-ink/60">{categories.length}</span>
            </h2>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button onClick={() => setAddingCategory(!addingCategory)} className="flex items-center space-x-1.5 text-xs sm:text-sm text-ink/50 hover:text-gold active:scale-95 transition min-h-[36px] px-3 py-2 rounded-lg hover:bg-white/5">
              {addingCategory ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span>{addingCategory ? 'Cancel' : 'Add Category'}</span>
            </button>
            <button onClick={resetWeights} className="flex items-center space-x-1.5 text-xs sm:text-sm text-gold hover:text-gold/80 active:scale-95 transition min-h-[36px] px-3 py-2 rounded-lg hover:bg-gold/5">
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Reset Equal</span>
            </button>
          </div>
        </div>

        {addingCategory && (
          <div className="flex items-stretch space-x-2 mb-4 sm:mb-6 animate-fadeIn">
            <input type="text" value={newCategoryTitle} onChange={e => setNewCategoryTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              placeholder="New category..."
              className="flex-1 px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all placeholder:text-ink/30 min-h-[44px]"
              autoFocus />
            <button onClick={handleAddCategory} className="px-5 py-3 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow hover:glow-gold transition-all shadow-lg shadow-gold/20 active:scale-95 min-h-[44px] px-6">
              Add
            </button>
          </div>
        )}

        <div className="space-y-4 sm:space-y-6">
          {categories.map(category => {
            const w = categoryWeights[category.id] ?? category.weight
            const isLocked = lockedWeights[category.id] || false
            const catScore = completionMap[category.id] || 0
            const categoryGoals = yearlyGoals.filter(g => g.parentId === category.id)
            const goalWeightSum = categoryGoals.reduce((s, g) => s + (g.weight || 0), 0)

            return (
              <Card key={category.id} className="p-4 sm:p-5 space-y-3 sm:space-y-4 active:scale-[0.99] transition-transform">
                {/* Category Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => toggleLock(category.id)} className="p-1 hover:bg-mist rounded transition min-w-[36px] min-h-[36px] flex items-center justify-center" title={isLocked ? 'Unlock weight' : 'Lock weight'}>
                        {isLocked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold" /> : <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-ink/30" />}
                      </button>
                      <h3 className="text-lg font-bold text-ink">{category.title}</h3>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Score:</span>
                        <input type="number" min="0" max="100" value={Math.round(catScore)}
                          onChange={e => updateItemScoreMode(category.id, 'manual', parseFloat(e.target.value) || 0)}
                          className="w-12 px-1 py-0.5 text-[10px] font-mono bg-white/[0.06] rounded border border-transparent hover:border-white/20 focus:bg-white/[0.1] focus:border-gold outline-none transition-colors" />
                        <span className="text-[9px] text-ink/50">%</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-gold w-14 text-right">{Math.round(w)}%</span>
                      <button onClick={(e) => handleDelete(e, category.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition text-ink/30 hover:text-red-500 min-w-[36px] min-h-[36px] flex items-center justify-center" title="Delete Category">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={w}
                    onChange={(e) => handleWeightChange(category.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold touch-manipulation" />
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
                      <button onClick={() => setAddingGoal(addingGoal === category.id ? null : category.id)} className="p-2 hover:bg-mist rounded-lg active:scale-90 transition text-ink/50 hover:text-gold min-w-[36px] min-h-[36px] flex items-center justify-center">
                        {addingGoal === category.id ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                      </button>
                    </div>
                  </div>

                  {addingGoal === category.id && (
                    <div className="flex items-stretch space-x-2 animate-fadeIn mb-3">
                      <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddGoal(category.id)}
                        placeholder="New annual goal..."
                        className="flex-1 px-4 py-3 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 transition-all min-h-[44px]"
                        autoFocus />
                      <button onClick={() => handleAddGoal(category.id)} className="px-4 py-3 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20 min-h-[44px] px-6">
                        Add
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categoryGoals.map(goal => {
                      const gScore = completionMap[goal.id] || 0
                      return (
                        <Card key={goal.id} className="p-3 sm:p-4 hover:border-gold active:scale-[0.98] transition-all group relative">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-ink text-sm truncate pr-6">{goal.title}</h4>
                            <div className="flex items-center space-x-2">
                              <ProgressRing progress={gScore} size={32} />
                              <span className="text-base font-mono font-bold">{Math.round(gScore)}%</span>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] text-ink/50 uppercase tracking-wider">Weight</span>
                                <span className="text-[9px] font-mono text-ink/50">{Math.round(goal.weight)}%</span>
                              </div>
                              <input type="range" min="0" max="100" step={1} value={goal.weight}
                                onChange={e => updateItem(goal.id, { weight: parseFloat(e.target.value) || 0 })}
                                className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-gold touch-manipulation" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] text-ink/50 uppercase tracking-wider">Score</span>
                                <span className="text-[9px] font-mono text-ink/50">{Math.round(gScore)}%</span>
                              </div>
                              <input type="range" min="0" max={100} step={1} value={Math.round(gScore)}
                                onChange={e => updateItem(goal.id, { progress: parseFloat(e.target.value) || 0 })}
                                className="w-full h-2 bg-mist rounded-full appearance-none cursor-pointer accent-sage touch-manipulation" />
                            </div>
                          </div>
                          <button onClick={(e) => handleDelete(e, goal.id)} className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition text-ink/50 hover:text-red-400 z-10 min-w-[36px] min-h-[36px] flex items-center justify-center" title="Delete Goal">
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
        <Card className="p-4 sm:p-6">
          <textarea value={reflectionText}
            onChange={(e) => { setReflectionText(e.target.value); saveReflection(e.target.value) }}
            placeholder="Reflect on your year so far... What's working? What needs to change?"
            className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-4 sm:p-5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 placeholder:text-ink/30 transition-all" />
          <p className="text-[10px] text-ink/40 mt-2">Auto-saves as you type</p>
        </Card>
      </div>

      {/* Habits Section */}
      <div>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink flex items-center gap-2 sm:gap-3">
            🌱 Habits
            <span className="text-xs font-mono font-normal bg-white/10 px-2 py-0.5 sm:py-1 rounded-full text-ink/60">{habitTitles.length}</span>
          </h2>
          <button
            onClick={handleStartAddHabit}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium bg-gold/10 text-gold rounded-lg border border-gold/30 hover:bg-gold/20 active:scale-95 transition min-h-[36px]"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Add Habit</span>
          </button>
        </div>

        {addingHabit && (
          <Card className="p-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 space-x-0 sm:space-x-3">
              <input
                type="text"
                value={newHabitTitle}
                onChange={e => setNewHabitTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
                placeholder="Habit name (e.g., 'Morning run', 'Read 30 mins')..."
                className="flex-1 px-4 py-3 text-sm bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-ink/30 min-h-[44px]"
                autoFocus
              />
              <div className="flex space-x-2">
                <button onClick={handleAddHabit} className="flex-1 sm:flex-none px-4 py-3 bg-gold text-paper text-sm font-bold rounded-xl hover:bg-gold-glow transition-all active:scale-95 shadow-lg shadow-gold/20 min-h-[44px]">
                  Create Habit
                </button>
                <button onClick={() => setAddingHabit(false)} className="px-4 py-3 text-ink/50 hover:text-ink hover:bg-white/5 rounded-xl transition min-h-[44px]">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-ink/40 mt-2">This will create daily habit instances for the rest of the year.</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {habitTitles.map(ht => {
            const pct = ht.total > 0 ? Math.round((ht.completed / ht.total) * 100) : 0
            return (
              <Card key={ht.title} className="p-4 space-y-3 hover:border-gold/50 active:scale-[0.98] transition-colors group">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink text-sm">{ht.title}</h3>
                  <div className="relative">
                    <button
                      onClick={() => setDeleteHabitMenu(deleteHabitMenu === ht.title ? null : ht.title)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded transition text-ink/30 hover:text-red-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    {deleteHabitMenu === ht.title && (
                      <div className="absolute right-0 top-8 z-50 bg-paper border border-mist rounded-xl shadow-xl p-2 min-w-[200px] animate-fadeIn">
                        <p className="text-[10px] text-ink/50 px-3 py-1 font-bold uppercase">Delete options</p>
                        <button onClick={() => handleDeleteHabitFuture(ht.title)} className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-mist rounded-lg transition flex items-center space-x-2">
                          <X className="w-3.5 h-3.5" />
                          <span>Delete future instances only</span>
                        </button>
                        <button onClick={() => handleDeleteHabitAll(ht.title)} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition flex items-center space-x-2">
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete completely (including past)</span>
                        </button>
                        <button onClick={() => setDeleteHabitMenu(null)} className="w-full text-left px-3 py-2 text-xs text-ink/50 hover:bg-mist rounded-lg transition">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-ink/50">
                  <span>{ht.completed}/{ht.total} days done</span>
                  <span className="font-mono font-bold text-gold">{pct}%</span>
                </div>
                <ProgressBar progress={pct} colorClass={pct >= 80 ? 'bg-sage' : pct >= 40 ? 'bg-gold' : 'bg-coral'} />
              </Card>
            )
          })}
          {habitTitles.length === 0 && !addingHabit && (
            <Card className="p-6 col-span-full text-center">
              <p className="text-sm text-ink/50">No habits yet. Add daily habits to build consistency!</p>
            </Card>
          )}
        </div>
      </div>

      {/* Quarters Section - below reflection */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink mb-4 sm:mb-6">Quarters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quarterGroups.map(({ label, items: qItems, avgScore }) => {
            const firstQ = qItems[0]
            return (
              <Card key={label} className={`p-5 transition-colors group ${firstQ ? 'hover:border-gold cursor-pointer active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
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