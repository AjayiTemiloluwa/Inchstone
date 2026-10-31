'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, X, RotateCcw } from 'lucide-react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { Button, EmptyState, Page, Panel, Section, cx, inputClass } from '@/components/ds'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { type Crumb } from '@/components/hierarchy/Breadcrumbs'
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
  if (!quarterItem) return (
    <Page width="narrow" className="pt-8"><EmptyState title="Quarter not found" action={<Button href="/year">Back to year</Button>} /></Page>
  )

  const qScore = completionMap[quarterItem.id] || 0
  const crumbs: Crumb[] = [{ label: 'Year', href: '/year' }]
  if (parentCategory) crumbs.push({ label: parentCategory.title })
  if (parentYearlyGoal) crumbs.push({ label: parentYearlyGoal.title })
  crumbs.push({ label: quarterItem.title })

  return (
    <Page width="wide">
      <ItemHeaderCard item={quarterItem} score={qScore} renameLabel="Rename quarter" deleteLabel="Delete Quarter" showTheme
        eyebrow="Quarter" crumbs={crumbs}
        onRename={t => updateItem(quarterItem.id, { title: t })} onTheme={t => updateItem(quarterItem.id, { theme: t })}
        onDeleted={handleDeleted} />

      <Section title="Quarter & months" id="quarter-months"
        action={
          <>
            <Button size="sm" variant="ghost" onClick={balancer.resetScores}>Auto scores</Button>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={balancer.resetWeights}>Reset equal</Button>
            <Button size="sm" variant="secondary" icon={addingMonth ? X : Plus} onClick={() => setAddingMonth(!addingMonth)}>
              {addingMonth ? 'Cancel' : 'Add month'}
            </Button>
          </>
        }>
        {addingMonth && (
          <Panel className="mb-4 animate-fadeIn">
            <div className="flex items-center gap-2">
              <input type="text" value={newMonthTitle} onChange={e => setNewMonthTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMonth()} aria-label="New month title"
                placeholder="New month..." className={cx(inputClass, 'flex-1 min-w-0')} autoFocus />
              <Button variant="primary" onClick={handleAddMonth}>Add</Button>
            </div>
          </Panel>
        )}

        <HierarchySummaryCard title={quarterItem.title} renameLabel="Rename quarter" score={qScore} weight={quarterItem.weight || 0}
          weightLabel="Quarter Weight (Relative to Year)" childrenLabel="Months" childrenTotal={balancer.totalWeight}
          onRename={t => updateItem(quarterItem.id, { title: t })}
          onScoreChange={v => { void updateItemScoreMode(quarterItem.id, 'manual', v) }}
          onWeightChange={v => updateItem(quarterItem.id, { weight: v })}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            <EmptyState title="No months yet" body="Use Add month to create one." />
          )}
        </HierarchySummaryCard>
      </Section>
    </Page>
  )
}
