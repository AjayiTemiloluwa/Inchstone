'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format, addDays } from 'date-fns'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { Badge, EmptyState, Page, Section } from '@/components/ds'
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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface DayGroup {
  title: string
  items: Item[]
  avgScore: number
  dateLabel: string
  categories: string[]
}

export default function YearQuarterMonthWeekPage() {
  const router = useRouter()
  const params = useParams()
  const quarterLabel = params.quarter as string
  const monthLabel = params.month as string
  const weekSlug = params.week as string // e.g. "Week1"
  // Convert slug back to title: "Week1" -> "Week 1"
  const weekTitle = weekSlug.replace(/Week(\d+)/i, 'Week $1')

  const { completionMap, getFlatItems } = useHierarchyStore()
  const { showToast } = useToast()
  const emptyGoals = useVoiceLine('empty.goals')
  const { loading, fetchItems } = useItemTree()

  const flatItems = getFlatItems()
  const { yearItem, subtreeIds } = useActiveYear(flatItems)
  const categories = flatItems.filter(i => i.layer === 1 && i.parentId === yearItem?.id)
  const yearlyGoals = flatItems.filter(i => i.layer === 2 && subtreeIds.has(i.id))
  const matchingQuarters = flatItems.filter(i => i.layer === 3 && subtreeIds.has(i.id) && i.title.includes(quarterLabel))
  const matchingMonths = matchingQuarters.flatMap(q => q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || [])
  const matchingWeeks = matchingMonths.flatMap(m => m.children?.filter(c => c.layer === 5 && c.title === weekTitle) || [])

  // Auto-create days for any week that has none.
  const ensuring = useRef(false)
  const needsDays = matchingWeeks.some(w => (w.children?.filter(c => c.layer === 6) || []).length === 0)
  useEffect(() => {
    if (loading || !needsDays || ensuring.current) return
    ensuring.current = true
    const run = async () => {
      try {
        let changed = false
        for (const weekItem of matchingWeeks) {
          if ((weekItem.children?.filter(c => c.layer === 6) || []).length > 0 || !weekItem.startDate) continue
          changed = true
          const wStart = new Date(weekItem.startDate)
          const wEnd = new Date(weekItem.endDate || weekItem.startDate)
          const dayCount = Math.round((wEnd.getTime() - wStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const perWeight = equalWeight(dayCount)
          for (let d = 0; d < dayCount; d++) {
            const dayDate = addDays(wStart, d)
            const dateStr = format(dayDate, 'yyyy-MM-dd')
            await fetch('/api/items', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ layer: 6, parentId: weekItem.id, title: WEEKDAYS[dayDate.getDay()], weight: perWeight, startDate: dateStr, endDate: dateStr }),
            })
          }
        }
        if (changed) await fetchItems()
      } catch (e) { console.error(e) } finally { ensuring.current = false }
    }
    void run()
  }, [loading, needsDays, matchingWeeks, fetchItems])

  const handleAddGoal = async (categoryId: string, title: string) => {
    try {
      await createYearlyGoalWithQuarters({ categoryId, title, weight: 0, yearItem })
      await fetchItems()
      return true
    } catch (e) { console.error(e); return false }
  }

  const handleDownloadReport = async () => {
    try {
      showToast('Generating PDF Report...', 'info')
      await downloadCategoryReport({ heading: `Week Report: ${weekTitle}`, fileName: `${weekTitle}_Report`, categories, completionMap })
      showToast('PDF Report downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF export failed:', err)
      showToast('Failed to export PDF', 'error')
    }
  }

  const avgScore = matchingWeeks.length > 0
    ? matchingWeeks.reduce((s, w) => s + (completionMap[w.id] || 0), 0) / matchingWeeks.length
    : 0

  if (loading) return <Loader label="Unlocking the week…" routeKey="year-quarter-month-week" />
  if (categories.length === 0) return (
    <Page width="narrow" className="pt-8"><EmptyState title="No categories found" body="Seed the framework first." /></Page>
  )

  const rows: CategoryRow[] = categories.map(category => {
    const catYearlyGoals = yearlyGoals.filter(g => g.parentId === category.id)
    const catQuarters = matchingQuarters.filter(q => catYearlyGoals.some(yg => yg.id === q.parentId))
    const catMonths = catQuarters.flatMap(q => q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || [])
    const catWeeks = catMonths.flatMap(m => m.children?.filter(c => c.layer === 5 && c.title === weekTitle) || [])
    return {
      category,
      goals: catWeeks.map(item => {
        const parentMonth = catMonths.find(m => m.id === item.parentId)
        const parentQ = catQuarters.find(q => q.id === parentMonth?.parentId)
        return { item, label: catYearlyGoals.find(yg => yg.id === parentQ?.parentId)?.title }
      }),
    }
  })

  // Day groups across all matching weeks, ordered chronologically.
  const dayMap = new Map<string, { items: Item[]; categories: string[] }>()
  matchingWeeks.flatMap(w => w.children?.filter(c => c.layer === 6) || []).forEach(d => {
    const entry = dayMap.get(d.title) ?? { items: [], categories: [] }
    dayMap.set(d.title, entry)
    entry.items.push(d)
    ;(d.tasks || []).forEach(t => {
      const catTitle = t.categoryId ? categories.find(c => c.id === t.categoryId)?.title : undefined
      if (catTitle && !entry.categories.includes(catTitle)) entry.categories.push(catTitle)
    })
  })
  const dayTime = (g: { items: Item[] }) => new Date(g.items[0]?.startDate || 0).getTime()
  const dayGroups: DayGroup[] = Array.from(dayMap.entries())
    .sort(([, a], [, b]) => dayTime(a) - dayTime(b))
    .map(([title, entry]) => {
      const first = entry.items[0]
      return {
        title,
        items: entry.items,
        avgScore: entry.items.length > 0 ? entry.items.reduce((s, d) => s + (completionMap[d.id] || 0), 0) / entry.items.length : 0,
        dateLabel: first?.startDate ? format(new Date(first.startDate), 'MMM d') : '',
        categories: entry.categories,
      }
    })

  const firstWeek = matchingWeeks[0]
  const weekDateRange = firstWeek?.startDate && firstWeek?.endDate
    ? `${format(new Date(firstWeek.startDate), 'MMM d, yyyy')} – ${format(new Date(firstWeek.endDate), 'MMM d, yyyy')}`
    : ''

  return (
    <div id="report-content">
      <Page width="wide">
        <PeriodHero crumbs={[
          { label: 'Year', href: '/year' },
          { label: quarterLabel, href: `/year/${quarterLabel}` },
          { label: monthLabel, href: `/year/${quarterLabel}/${monthLabel}` },
          { label: weekTitle },
        ]}
          eyebrow={`Week · ${monthLabel}`} title={weekTitle}
          subtitle={`${monthLabel} · ${quarterLabel}${weekDateRange ? ` · ${weekDateRange}` : ''}`}
          score={avgScore} scoreCaption={`across ${matchingWeeks.length} goals`} onDownloadReport={handleDownloadReport} />

        <Section title="Days" id="week-days">
          {dayGroups.length === 0 ? (
            <EmptyState title="No days yet" body="Days will appear once goals are created." />
          ) : (
            <PeriodGrid cols={7}>
              {dayGroups.map(({ title, items: dItems, avgScore: dAvg, dateLabel, categories: dayCategories }) => {
                const firstDate = dItems[0]?.startDate ? format(new Date(dItems[0].startDate), 'yyyy-MM-dd') : null
                return (
                  <PeriodTile key={title} label={title} sublabel={dateLabel || undefined} score={dAvg} caption={`${dItems.length} goals`}
                    onOpen={firstDate ? () => router.push(`/day/${firstDate}`) : undefined}>
                    {dayCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {dayCategories.slice(0, 3).map(cat => <Badge key={cat} tone="gold" className="max-w-full truncate">{cat}</Badge>)}
                      </div>
                    )}
                  </PeriodTile>
                )
              })}
            </PeriodGrid>
          )}
        </Section>

        <CategoryGoalsList rows={rows} completionMap={completionMap} heading="Categories & goals" goalsLabel="Weekly Goals"
          weightLabel="Weight" emptyText={emptyGoals} hrefFor={item => `/week/${item.id}`}
          onAddGoal={handleAddGoal} onDeleted={async () => { await fetchItems() }} />

        <PeriodReflection key={firstWeek?.id ?? 'none'} label={weekTitle} timePeriod="week"
          itemId={firstWeek?.id || null} initialText={firstWeek?.reflection}
          periodKey={firstWeek?.id || weekTitle}
          placeholder={`Reflect on ${weekTitle}... What went well? What will you improve?`} />
      </Page>
    </div>
  )
}
