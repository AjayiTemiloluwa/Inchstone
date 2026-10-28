'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { addMonths } from 'date-fns'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useToast } from '@/components/ui/ToastProvider'
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
  if (categories.length === 0) return <div className="p-6 text-ink/60">No categories found. Seed the framework first.</div>

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
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12 stagger-children" id="report-content">
      <Breadcrumbs crumbs={[{ label: 'Year', href: '/year' }, { label: quarterLabel }]} />

      <PeriodHero title={`${quarterLabel} Overview`} subtitle={`Showing all goals across your Yearly Categories for ${quarterLabel}`}
        score={avgScore} onDownloadReport={handleDownloadReport} />

      <CategoryGoalsList rows={rows} completionMap={completionMap} heading="Categories & Goals" goalsLabel="Goals" quarterMode
        weightLabel="Weight (in Year)" emptyText={emptyGoals} hrefFor={item => `/quarter/${item.id}`}
        onAddGoal={handleAddGoal} onDeleted={async () => { await fetchItems() }} />

      <PeriodReflection key={matchingQuarters[0]?.id ?? 'none'} label={quarterLabel} timePeriod="quarter"
        itemId={matchingQuarters[0]?.id || null} initialText={matchingQuarters[0]?.reflection}
        periodKey={matchingQuarters[0]?.id || quarterLabel}
        placeholder={`Reflect on ${quarterLabel} so far... What's working? What needs to change?`} />

      <div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink mb-6">Months</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthGroups.map(({ label, items: mItems, avgScore: mAvg }) => (
            <Card key={label} className="p-5 transition-colors group hover:border-gold cursor-pointer"
              onClick={() => router.push(`/year/${quarterLabel}/${label}`)}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-gold to-gold-glow bg-clip-text text-transparent">{label}</p>
              </div>
              <div className="flex items-end justify-between">
                <ProgressRing progress={mAvg} size={48} />
                <div className="text-right">
                  <p className="text-xl font-mono font-bold">{Math.round(mAvg)}%</p>
                  <p className="text-[10px] text-ink/40">{mItems.length} active goals</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
