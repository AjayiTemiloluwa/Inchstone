'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, X, RotateCcw } from 'lucide-react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { Breadcrumbs, type Crumb } from '@/components/hierarchy/Breadcrumbs'
import { ItemHeaderCard } from '@/components/hierarchy/ItemHeaderCard'
import { HierarchySummaryCard } from '@/components/hierarchy/HierarchySummaryCard'
import { ChildItemCard } from '@/components/hierarchy/ChildItemCard'
import { useItemTree } from '@/components/hierarchy/useItemTree'
import { useWeightBalancer } from '@/components/hierarchy/useWeightBalancer'
import { findItemById, equalWeight } from '@/components/hierarchy/itemTree'

export default function QuarterPage() {
  const router = useRouter()
  const params = useParams()
  const quarterId = params.id as string

  const { items, completionMap, updateItem, updateItemScoreMode } = useHierarchyStore()
  const { showToast } = useToast()
  const { loading, fetchItems } = useItemTree()
  const [addingMonth, setAddingMonth] = useState(false)
  const [newMonthTitle, setNewMonthTitle] = useState('')

  const quarterItem = findItemById(items, quarterId)
  const monthlyGoals = quarterItem?.children?.filter(c => c.layer === 4) || []
  const parentYearlyGoal = quarterItem?.parentId ? findItemById(items, quarterItem.parentId) : undefined
  const parentCategory = parentYearlyGoal?.parentId ? findItemById(items, parentYearlyGoal.parentId) : undefined
  const balancer = useWeightBalancer(monthlyGoals)

  const handleAddMonth = async () => {
    if (!newMonthTitle.trim() || !quarterItem) return
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 4,
          parentId: quarterItem.id,
          title: newMonthTitle.trim(),
          weight: equalWeight(monthlyGoals.length + 1),
          startDate: quarterItem.startDate,
          endDate: quarterItem.endDate,
        }),
      })
      await fetchItems()
      balancer.clearOverrides()
      setNewMonthTitle('')
      setAddingMonth(false)
    } catch (e) {
      console.error(e)
      showToast('Failed to add month', 'error')
    }
  }

  const handleDeleted = async (id: string) => {
    if (id === quarterId) { router.push('/year'); return }
    await fetchItems()
    balancer.clearOverrides()
  }

  if (loading) return <Loader label="Carving this quarter…" routeKey="quarter" />
  if (!quarterItem) return <div className="p-6 text-ink/60">Quarter not found.</div>

  const qScore = completionMap[quarterItem.id] || 0
  const crumbs: Crumb[] = [{ label: 'Year', href: '/year' }]
  if (parentCategory) crumbs.push({ label: parentCategory.title })
  if (parentYearlyGoal) crumbs.push({ label: parentYearlyGoal.title })
  crumbs.push({ label: quarterItem.title })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <Breadcrumbs crumbs={crumbs} />

      <ItemHeaderCard item={quarterItem} score={qScore} renameLabel="Rename quarter" deleteLabel="Delete Quarter" showTheme
        onRename={t => updateItem(quarterItem.id, { title: t })} onTheme={t => updateItem(quarterItem.id, { theme: t })}
        onDeleted={handleDeleted} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-ink">Quarter & Months</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" onClick={() => setAddingMonth(!addingMonth)} className="flex items-center space-x-1.5 py-2 text-xs text-ink/50 hover:text-gold transition">
              {addingMonth ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{addingMonth ? 'Cancel' : 'Add Month'}</span>
            </button>
            <button type="button" onClick={balancer.resetWeights} className="flex items-center space-x-1.5 py-2 text-xs text-gold hover:text-gold/80 transition">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Equal</span>
            </button>
            <button type="button" onClick={balancer.resetScores} className="py-2 text-xs text-sage hover:text-sage/80 transition">Auto Scores</button>
          </div>
        </div>

        {addingMonth && (
          <div className="flex items-center space-x-2 mb-4">
            <input type="text" value={newMonthTitle} onChange={e => setNewMonthTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMonth()}
              placeholder="New month..." className="flex-1 min-w-0 px-3 py-2 text-sm bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30" autoFocus />
            <button type="button" onClick={handleAddMonth} className="px-3 py-2 bg-gold text-surface text-sm font-semibold rounded-lg hover:bg-gold/90 transition">Add</button>
          </div>
        )}

        <HierarchySummaryCard title={quarterItem.title} renameLabel="Rename quarter" score={qScore} weight={quarterItem.weight || 0}
          weightLabel="Quarter Weight (Relative to Year)" childrenLabel="Months" childrenTotal={balancer.totalWeight}
          onRename={t => updateItem(quarterItem.id, { title: t })}
          onScoreChange={v => { void updateItemScoreMode(quarterItem.id, 'manual', v) }}
          onWeightChange={v => updateItem(quarterItem.id, { weight: v })}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {monthlyGoals.map(month => (
              <ChildItemCard key={month.id} item={month} href={`/month/${month.id}`} noun="month"
                score={completionMap[month.id] || 0} weight={balancer.weightOf(month)} locked={balancer.locked[month.id] || false}
                onToggleLock={() => balancer.toggleLock(month.id)}
                onRename={t => updateItem(month.id, { title: t })}
                onWeightChange={v => balancer.changeWeight(month.id, v)}
                onScoreChange={v => balancer.changeScore(month.id, v)}
                onDeleted={handleDeleted} />
            ))}
          </div>
          {monthlyGoals.length === 0 && !addingMonth && (
            <p className="text-xs text-ink/40 italic">No months yet. Click + to add one.</p>
          )}
        </HierarchySummaryCard>
      </div>
    </div>
  )
}
