'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { getWeeksInMonth } from '@/lib/calendarUtils'
import { Loader } from '@/components/ui/Loader'
import { Button, EmptyState, Page, Section } from '@/components/ds'
import { type Crumb } from '@/components/hierarchy/Breadcrumbs'
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
  if (!monthItem) return (
    <Page width="narrow" className="pt-8"><EmptyState title="Month not found" action={<Button href="/year">Back to year</Button>} /></Page>
  )

  const mScore = completionMap[monthItem.id] || 0
  const monthLabel = monthItem.startDate ? format(new Date(monthItem.startDate), 'MMMM yyyy') : monthItem.title
  const crumbs: Crumb[] = [{ label: 'Year', href: '/year' }]
  if (parentCategory) crumbs.push({ label: parentCategory.title })
  if (parentYearlyGoal) crumbs.push({ label: parentYearlyGoal.title })
  if (parentQuarter) crumbs.push({ label: parentQuarter.title, href: `/quarter/${parentQuarter.id}` })
  crumbs.push({ label: monthLabel })

  return (
    <Page width="wide">
      <ItemHeaderCard item={monthItem} score={mScore} fallbackTitle={monthLabel} renameLabel="Rename month" deleteLabel="Delete Month"
        eyebrow={`Month · ${monthLabel}`} crumbs={crumbs}
        onRename={t => updateItem(monthItem.id, { title: t })} onDeleted={handleDeleted} />

      <Section title="Month & weeks" id="month-weeks"
        action={
          <>
            <Button size="sm" variant="ghost" onClick={balancer.resetScores}>Auto scores</Button>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={balancer.resetWeights}>Reset equal</Button>
          </>
        }>
        <HierarchySummaryCard title={monthItem.title || monthLabel} renameLabel="Rename month" score={mScore} weight={monthItem.weight || 0}
          weightLabel="Month Weight (Relative to Quarter)" childrenLabel="Weeks" childrenTotal={balancer.totalWeight}
          onRename={t => updateItem(monthItem.id, { title: t })}
          onScoreChange={v => updateItem(monthItem.id, { progress: v })}
          onWeightChange={v => updateItem(monthItem.id, { weight: v })}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          {weeklyGoals.length === 0 && <EmptyState title="No weeks yet" />}
        </HierarchySummaryCard>
      </Section>
    </Page>
  )
}
