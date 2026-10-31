'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { addMonths } from 'date-fns'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { EmptyState, Page, Section } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'
import { Loader } from '@/components/ui/Loader'
import { useVoiceLine } from '@/lib/voice/use-voice-line'
import { useActiveYear } from '@/lib/useActiveYear'
import { PeriodHero } from '@/components/hierarchy/PeriodHero'
import { PeriodReflection } from '@/components/hierarchy/PeriodReflection'
import { CategoryGoalsList, type CategoryRow } from '@/components/hierarchy/CategoryGoalsList'
import { useItemTree } from '@/components/hierarchy/useItemTree'
import { downloadCategoryReport } from '@/components/hierarchy/exportReport'
import { createYearlyGoalWithQuarters } from '@/components/hierarchy/createGoal'
import { equalWeight } from '@/components/hierarchy/itemTree'
import { PeriodGrid, PeriodTile } from '@/components/hierarchy/primitives'

const QUARTER_MONTH_NAMES: Record<string, string[]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
}

export default function YearQuarterPage() {
  const router = useRouter()
  const params = useParams()
  const quarterLabel = params.quarter as string

  const { completionMap, updateItem, getFlatItems } = useHierarchyStore()
  const { showToast } = useToast()
  const emptyGoals = useVoiceLine('empty.goals')
  const { loading, fetchItems } = useItemTree()

  const flatItems = getFlatItems()
  const { yearItem, subtreeIds } = useActiveYear(flatItems)
  const categories = flatItems.filter(i => i.layer === 1 && i.parentId === yearItem?.id)
  const yearlyGoals = flatItems.filter(i => i.layer === 2 && subtreeIds.has(i.id))
  const matchingQuarters = flatItems.filter(i => i.layer === 3 && subtreeIds.has(i.id) && i.title.includes(quarterLabel))

  // Auto-create months for any quarter that has none.
  const ensuring = useRef(false)
  const needsMonths = matchingQuarters.some(q => (q.children?.filter(c => c.layer === 4) || []).length === 0)
  useEffect(() => {
    if (loading || !needsMonths || ensuring.current) return
    ensuring.current = true
    const run = async () => {
      try {
        const monthNames = QUARTER_MONTH_NAMES[quarterLabel] || ['Month 1', 'Month 2', 'Month 3']
        for (const quarterItem of matchingQuarters) {
          if ((quarterItem.children?.filter(c => c.layer === 4) || []).length > 0) continue
          const qStart = new Date(quarterItem.startDate || new Date())
          const perWeight = equalWeight(3)
          for (let m = 0; m < 3; m++) {
            const mStart = addMonths(qStart, m)
            await fetch('/api/items', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ layer: 4, parentId: quarterItem.id, title: monthNames[m], weight: perWeight, startDate: mStart.toISOString(), endDate: addMonths(mStart, 1).toISOString() }),
            })
          }
        }
        await fetchItems()
      } catch (e) { console.error(e) } finally { ensuring.current = false }
    }
    void run()
  }, [loading, needsMonths, matchingQuarters, quarterLabel, fetchItems])

  const handleAddGoal = async (categoryId: string, title: string) => {
    try {
      const existing = yearlyGoals.filter(g => g.parentId === categoryId)
      const goal = await createYearlyGoalWithQuarters({ categoryId, title, weight: equalWeight(existing.length + 1), yearItem })
      const all = goal ? [...existing, goal] : existing
      const per = equalWeight(all.length)
      all.forEach(g => updateItem(g.id, { weight: per }))
      await fetchItems()
      return true
    } catch (e) { console.error(e); return false }
  }

  const handleDownloadReport = async () => {
    try {
      showToast('Generating PDF Report...', 'info')
      await downloadCategoryReport({ heading: `Quarter Report: ${quarterLabel}`, fileName: `${quarterLabel}_Report`, categories, completionMap })
      showToast('PDF Report downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF export failed:', err)
      showToast('Failed to export PDF', 'error')
    }
  }

  const avgScore = matchingQuarters.length > 0
    ? matchingQuarters.reduce((s, q) => s + (completionMap[q.id] || 0), 0) / matchingQuarters.length
    : 0

  if (loading) return <Loader label="Firing up the quarter…" routeKey="year-quarter" />
  if (categories.length === 0) return (
    <Page width="narrow" className="pt-8"><EmptyState title="No categories found" body="Seed the framework first." /></Page>
  )

  const rows: CategoryRow[] = categories.map(category => {
    const catYearlyGoals = yearlyGoals.filter(g => g.parentId === category.id)
    const catQuarters = matchingQuarters.filter(q => catYearlyGoals.some(yg => yg.id === q.parentId))
    return {
      category,
      goals: catQuarters.map(item => ({ item, label: catYearlyGoals.find(yg => yg.id === item.parentId)?.title })),
    }
  })

  const monthGroups = (QUARTER_MONTH_NAMES[quarterLabel] || ['Month 1', 'Month 2', 'Month 3']).map(label => {
    const mItems = matchingQuarters.flatMap(q => q.children?.filter(c => c.layer === 4 && c.title === label) || [])
    const avg = mItems.length > 0 ? mItems.reduce((s, m) => s + (completionMap[m.id] || 0), 0) / mItems.length : 0
    return { label, items: mItems, avgScore: avg }
  })

  return (
    <div id="report-content">
      <Page width="wide">
        <PeriodHero crumbs={[{ label: 'Year', href: '/year' }, { label: quarterLabel }]} eyebrow="Quarter"
          title={`${quarterLabel} Overview`} subtitle={`Showing all goals across your Yearly Categories for ${quarterLabel}`}
          score={avgScore} scoreCaption={`across ${matchingQuarters.length} goals`} onDownloadReport={handleDownloadReport} />

        <Section title="Months" id="quarter-months">
          <PeriodGrid cols={3}>
            {monthGroups.map(({ label, items: mItems, avgScore: mAvg }) => (
              <PeriodTile key={label} label={label} score={mAvg} caption={`${mItems.length} active goals`}
                onOpen={() => router.push(`/year/${quarterLabel}/${label}`)} />
            ))}
          </PeriodGrid>
        </Section>

        <CategoryGoalsList rows={rows} completionMap={completionMap} heading="Categories & goals" goalsLabel="Goals" quarterMode
          weightLabel="Weight (in Year)" emptyText={emptyGoals} hrefFor={item => `/quarter/${item.id}`}
          onAddGoal={handleAddGoal} onDeleted={async () => { await fetchItems() }} />

        <PeriodReflection key={matchingQuarters[0]?.id ?? 'none'} label={quarterLabel} timePeriod="quarter"
          itemId={matchingQuarters[0]?.id || null} initialText={matchingQuarters[0]?.reflection}
          periodKey={matchingQuarters[0]?.id || quarterLabel}
          placeholder={`Reflect on ${quarterLabel} so far... What's working? What needs to change?`} />
      </Page>
    </div>
  )
}
