'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { getWeeksInMonth } from '@/lib/calendarUtils'
import { Loader } from '@/components/ui/Loader'
import { Scramble } from '@/components/ui/motion'
import { Breadcrumbs, type Crumb } from '@/components/hierarchy/Breadcrumbs'
import { ItemHeaderCard } from '@/components/hierarchy/ItemHeaderCard'
import { HierarchySummaryCard } from '@/components/hierarchy/HierarchySummaryCard'
import { ChildItemCard } from '@/components/hierarchy/ChildItemCard'
import { useItemTree } from '@/components/hierarchy/useItemTree'
import { useWeightBalancer } from '@/components/hierarchy/useWeightBalancer'
import { findItemById, equalWeight } from '@/components/hierarchy/itemTree'

export default function MonthPage() {
  const router = useRouter()
  const params = useParams()
  const monthId = params.id as string

  const { items, completionMap, updateItem } = useHierarchyStore()
  const { loading, fetchItems } = useItemTree()

  const monthItem = findItemById(items, monthId)
  const weeklyGoals = monthItem?.children?.filter(c => c.layer === 5) || []
  const parentQuarter = monthItem?.parentId ? findItemById(items, monthItem.parentId) : undefined
  const parentYearlyGoal = parentQuarter?.parentId ? findItemById(items, parentQuarter.parentId) : undefined
  const parentCategory = parentYearlyGoal?.parentId ? findItemById(items, parentYearlyGoal.parentId) : undefined
  const balancer = useWeightBalancer(weeklyGoals)
  const { clearOverrides } = balancer

  // Auto-create weeks when the month has none.
  const ensuring = useRef(false)
  const needsWeeks = !!monthItem && weeklyGoals.length === 0
  const monthStart = monthItem?.startDate
  useEffect(() => {
    if (loading || !needsWeeks || !monthItem || ensuring.current) return
    ensuring.current = true
    const run = async () => {
      try {
        const mStart = monthStart ? new Date(monthStart) : new Date()
        const weeksInMonth = getWeeksInMonth(mStart.getFullYear(), mStart.getMonth() + 1)
        const perWeight = equalWeight(weeksInMonth.length)
        for (let w = 0; w < weeksInMonth.length; w++) {
          const weekDays = weeksInMonth[w]
          await fetch('/api/items', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              layer: 5, parentId: monthItem.id, title: `Week ${w + 1}`, weight: perWeight,
              startDate: format(weekDays[0].date, 'yyyy-MM-dd'), endDate: format(weekDays[weekDays.length - 1].date, 'yyyy-MM-dd'),
            }),
          })
        }
        await fetchItems()
        clearOverrides()
      } catch (e) { console.error(e) } finally { ensuring.current = false }
    }
    void run()
  }, [loading, needsWeeks, monthItem, monthStart, fetchItems, clearOverrides])

  const handleDeleted = async (id: string) => {
    if (id === monthId) { router.push(`/quarter/${parentQuarter?.id || ''}`); return }
    await fetchItems()
    clearOverrides()
  }

  if (loading) return <Loader label="Summoning this month…" routeKey="month" />
  if (!monthItem) return <div className="p-6 text-ink/60">Month not found.</div>

  const mScore = completionMap[monthItem.id] || 0
  const monthLabel = monthItem.startDate ? format(new Date(monthItem.startDate), 'MMMM yyyy') : monthItem.title
  const crumbs: Crumb[] = [{ label: 'Year', href: '/year' }]
  if (parentCategory) crumbs.push({ label: parentCategory.title })
  if (parentYearlyGoal) crumbs.push({ label: parentYearlyGoal.title })
  if (parentQuarter) crumbs.push({ label: parentQuarter.title, href: `/quarter/${parentQuarter.id}` })
  crumbs.push({ label: monthLabel })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <Breadcrumbs crumbs={crumbs} />

      <ItemHeaderCard item={monthItem} score={mScore} fallbackTitle={monthLabel} renameLabel="Rename month" deleteLabel="Delete Month"
        onRename={t => updateItem(monthItem.id, { title: t })} onDeleted={handleDeleted} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-ink"><Scramble text="Month & Weeks" mono={false} /></h2>
          <div className="flex items-center gap-x-4">
            <button type="button" onClick={balancer.resetWeights} className="flex items-center space-x-1.5 py-2 text-xs text-gold hover:text-gold/80 transition">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Equal</span>
            </button>
            <button type="button" onClick={balancer.resetScores} className="py-2 text-xs text-sage hover:text-sage/80 transition">Auto Scores</button>
          </div>
        </div>

        <HierarchySummaryCard title={monthItem.title || monthLabel} renameLabel="Rename month" score={mScore} weight={monthItem.weight || 0}
          weightLabel="Month Weight (Relative to Quarter)" childrenLabel="Weeks" childrenTotal={balancer.totalWeight}
          onRename={t => updateItem(monthItem.id, { title: t })}
          onScoreChange={v => updateItem(monthItem.id, { progress: v })}
          onWeightChange={v => updateItem(monthItem.id, { weight: v })}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weeklyGoals.map(week => (
              <ChildItemCard key={week.id} item={week} href={`/week/${week.id}`} noun="week"
                score={completionMap[week.id] || 0} weight={balancer.weightOf(week)} locked={balancer.locked[week.id] || false}
                onToggleLock={() => balancer.toggleLock(week.id)}
                onRename={t => updateItem(week.id, { title: t })}
                onWeightChange={v => balancer.changeWeight(week.id, v)}
                onScoreChange={v => balancer.changeScore(week.id, v)}
                onDeleted={handleDeleted} />
            ))}
          </div>
          {weeklyGoals.length === 0 && <p className="text-xs text-ink/40 italic">No weeks yet.</p>}
        </HierarchySummaryCard>
      </div>
    </div>
  )
}
