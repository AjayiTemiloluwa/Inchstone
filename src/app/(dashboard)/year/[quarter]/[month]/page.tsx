'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useToast } from '@/components/ui/ToastProvider'
import { getWeeksInMonth } from '@/lib/calendarUtils'
import { Loader } from '@/components/ui/Loader'
import { useVoiceLine } from '@/lib/voice/use-voice-line'
import { useActiveYear } from '@/lib/useActiveYear'
import { Breadcrumbs } from '@/components/hierarchy/Breadcrumbs'
import { PeriodHero } from '@/components/hierarchy/PeriodHero'
import { PeriodReflection } from '@/components/hierarchy/PeriodReflection'
import { CategoryGoalsList, type CategoryRow } from '@/components/hierarchy/CategoryGoalsList'
import { useItemTree } from '@/components/hierarchy/useItemTree'
import { downloadCategoryReport } from '@/components/hierarchy/exportReport'
import { createYearlyGoalWithQuarters } from '@/components/hierarchy/createGoal'
import { equalWeight } from '@/components/hierarchy/itemTree'

export default function YearQuarterMonthPage() {
  const router = useRouter()
  const params = useParams()
  const quarterLabel = params.quarter as string
  const monthLabel = params.month as string

  const { completionMap, getFlatItems } = useHierarchyStore()
  const { showToast } = useToast()
  const emptyGoals = useVoiceLine('empty.goals')
  const { loading, fetchItems } = useItemTree()

  const flatItems = getFlatItems()
  const { yearItem, subtreeIds } = useActiveYear(flatItems)
  const categories = flatItems.filter(i => i.layer === 1 && i.parentId === yearItem?.id)
  const yearlyGoals = flatItems.filter(i => i.layer === 2 && subtreeIds.has(i.id))
  const matchingQuarters = flatItems.filter(i => i.layer === 3 && subtreeIds.has(i.id) && i.title.includes(quarterLabel))
  // Every month item with this name across the matching quarters.
  const matchingMonths = matchingQuarters.flatMap(q => q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || [])

  // Auto-create weeks for any month that has none.
  const ensuring = useRef(false)
  const needsWeeks = matchingMonths.some(m => (m.children?.filter(c => c.layer === 5) || []).length === 0)
  useEffect(() => {
    if (loading || !needsWeeks || ensuring.current) return
    ensuring.current = true
    const run = async () => {
      try {
        let changed = false
        for (const monthItem of matchingMonths) {
          if ((monthItem.children?.filter(c => c.layer === 5) || []).length > 0 || !monthItem.startDate) continue
          changed = true
          const mStart = new Date(monthItem.startDate)
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
        }
        if (changed) await fetchItems()
      } catch (e) { console.error(e) } finally { ensuring.current = false }
    }
    void run()
  }, [loading, needsWeeks, matchingMonths, fetchItems])

  const handleAddGoal = async (categoryId: string, title: string) => {
    try {
      const existing = yearlyGoals.filter(g => g.parentId === categoryId)
      await createYearlyGoalWithQuarters({ categoryId, title, weight: equalWeight(existing.length + 1), yearItem })
      await fetchItems()
      return true
    } catch (e) { console.error(e); return false }
  }

  const handleDownloadReport = async () => {
    try {
      showToast('Generating PDF Report...', 'info')
      await downloadCategoryReport({ heading: `Month Report: ${monthLabel}`, fileName: `${monthLabel}_Report`, categories, completionMap })
      showToast('PDF Report downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF export failed:', err)
      showToast('Failed to export PDF', 'error')
    }
  }

  const avgScore = matchingMonths.length > 0
    ? matchingMonths.reduce((s, m) => s + (completionMap[m.id] || 0), 0) / matchingMonths.length
    : 0

  if (loading) return <Loader label="Flipping over the month…" routeKey="year-quarter-month" />
  if (categories.length === 0) return <div className="p-6 text-ink/60">No categories found. Seed the framework first.</div>

  const rows: CategoryRow[] = categories.map(category => {
    const catYearlyGoals = yearlyGoals.filter(g => g.parentId === category.id)
    const catQuarters = matchingQuarters.filter(q => catYearlyGoals.some(yg => yg.id === q.parentId))
    const catMonths = catQuarters.flatMap(q => q.children?.filter(c => c.layer === 4 && c.title === monthLabel) || [])
    return {
      category,
      goals: catMonths.map(item => {
        const parentQ = catQuarters.find(q => q.id === item.parentId)
        return { item, label: catYearlyGoals.find(yg => yg.id === parentQ?.parentId)?.title }
      }),
    }
  })

  // Week groups across all matching months, ordered by week number.
  const weekTitles = Array.from(new Set(matchingMonths.flatMap(m => (m.children?.filter(c => c.layer === 5) || []).map(w => w.title))))
    .sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0))
  const weekGroups = weekTitles.map(title => {
    const wItems = matchingMonths.flatMap(m => m.children?.filter(c => c.layer === 5 && c.title === title) || [])
    const avg = wItems.length > 0 ? wItems.reduce((s, w) => s + (completionMap[w.id] || 0), 0) / wItems.length : 0
    const first = wItems[0]
    const dateLabel = first?.startDate && first?.endDate
      ? `${format(new Date(first.startDate), 'MMM d')} – ${format(new Date(first.endDate), 'MMM d')}`
      : ''
    return { title, items: wItems, avgScore: avg, dateLabel }
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12 stagger-children" id="report-content">
      <Breadcrumbs crumbs={[{ label: 'Year', href: '/year' }, { label: quarterLabel, href: `/year/${quarterLabel}` }, { label: monthLabel }]} />

      <PeriodHero title={monthLabel} subtitle={quarterLabel} score={avgScore} onDownloadReport={handleDownloadReport} />

      <CategoryGoalsList rows={rows} completionMap={completionMap} heading="Categories & Goals" goalsLabel="Monthly Goals"
        weightLabel="Weight" emptyText={emptyGoals} hrefFor={item => `/month/${item.id}`}
        onAddGoal={handleAddGoal} onDeleted={async () => { await fetchItems() }} />

      <PeriodReflection key={matchingMonths[0]?.id ?? 'none'} label={monthLabel} timePeriod="month"
        itemId={matchingMonths[0]?.id || null} initialText={matchingMonths[0]?.reflection}
        periodKey={matchingMonths[0]?.id || monthLabel}
        placeholder={`Reflect on ${monthLabel} so far... What's working? What needs to change?`} />

      <div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink mb-6">Weeks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {weekGroups.map(({ title, items: wItems, avgScore: wAvg, dateLabel }) => (
            <Card key={title} className="p-5 transition-colors group hover:border-gold cursor-pointer"
              onClick={() => router.push(`/year/${quarterLabel}/${monthLabel}/${title.replace(/\s+/g, '')}`)}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{title}</p>
                  {dateLabel && <p className="text-[10px] text-ink/40 mt-0.5">{dateLabel}</p>}
                </div>
              </div>
              <div className="flex items-end justify-between">
                <ProgressRing progress={wAvg} size={48} />
                <div className="text-right">
                  <p className="text-xl font-mono font-bold">{Math.round(wAvg)}%</p>
                  <p className="text-[10px] text-ink/40">{wItems.length} active goals</p>
                </div>
              </div>
            </Card>
          ))}
          {weekGroups.length === 0 && (
            <p className="text-sm text-ink/50 italic col-span-full">Weeks will appear once goals are created.</p>
          )}
        </div>
      </div>
    </div>
  )
}
