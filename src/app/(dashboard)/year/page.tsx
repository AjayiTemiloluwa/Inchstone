'use client'

import { useRouter } from 'next/navigation'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { useToast } from '@/components/ui/ToastProvider'
import { YearFilm } from '@/components/ui/YearFilm'
import { Reveal } from '@/components/ui/motion'
import { Button, EmptyState, Page } from '@/components/ds'
import { Loader } from '@/components/ui/Loader'
import { useActiveYear } from '@/lib/useActiveYear'
import { useItemTree } from '@/components/hierarchy/useItemTree'
import { downloadCategoryReport } from '@/components/hierarchy/exportReport'
import { PeriodReflection } from '@/components/hierarchy/PeriodReflection'
import { YearHero } from '@/components/hierarchy/year/YearHero'
import { YearCategories } from '@/components/hierarchy/year/YearCategories'
import { YearHabits } from '@/components/hierarchy/year/YearHabits'
import { YearQuarters } from '@/components/hierarchy/year/YearQuarters'

export default function YearPage() {
  const router = useRouter()
  const { completionMap, getFlatItems } = useHierarchyStore()
  const { showToast } = useToast()
  const { loading, fetchItems } = useItemTree()

  // Everything is scoped to the ACTIVE year (switchable, multi-year).
  const flatItems = getFlatItems()
  const { activeYear, yearItem, allYears, subtreeIds } = useActiveYear(flatItems)

  // Categories of the active year: direct children of its workspace item, or,
  // as a fallback, layer-1 items with no parent that no other year owns (keeps
  // legacy frameworks from before multi-year seeding visible).
  const categories = (() => {
    const direct = flatItems.filter(i => i.layer === 1 && i.parentId === yearItem?.id)
    if (direct.length > 0) return direct
    const ownedByAYear = new Set(
      allYears.flatMap(y => flatItems.filter(i => i.layer === 1 && i.parentId === y.id).map(i => i.id)),
    )
    return flatItems.filter(i => i.layer === 1 && !i.parentId && !ownedByAYear.has(i.id))
  })()
  // Deterministic order: ids are random uuids, so DB tie-order isn't stable.
  const orderedCategories = [...categories].sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '') || a.title.localeCompare(b.title),
  )
  const yearlyGoals = flatItems.filter(i => i.layer === 2 && subtreeIds.has(i.id))
  const quarters = flatItems.filter(i => i.layer === 3 && subtreeIds.has(i.id))

  const handleDownloadReport = async () => {
    try {
      showToast('Generating PDF Report...', 'info')
      const year = new Date().getFullYear()
      await downloadCategoryReport({ heading: `Year Report: ${year}`, fileName: `Year_Report_${year}`, categories: orderedCategories, completionMap })
      showToast('PDF Report downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF export failed:', err)
      showToast('Failed to export PDF', 'error')
    }
  }

  if (loading) return <Loader label="Painting your year…" routeKey="year" />

  if (!yearItem) return (
    <Page width="narrow" className="pt-8">
      <EmptyState title="Framework not initialized"
        body="Please seed the framework first from the dashboard to get started."
        action={<Button variant="primary" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>} />
    </Page>
  )

  return (
    <div id="report-content">
      <Page width="wide">
        <YearHero yearItem={yearItem} activeYear={activeYear} score={completionMap[yearItem.id] || 0} onDownloadReport={handleDownloadReport} />

        <YearQuarters quarters={quarters} completionMap={completionMap} />

        {/* key: switching year resets the weight-balancer and accordion state */}
        <YearCategories key={yearItem.id} yearItem={yearItem} categories={orderedCategories} yearlyGoals={yearlyGoals}
          completionMap={completionMap} fetchItems={fetchItems} />

        <YearHabits />

        {/* YearFilm carries its own header row, so it sits outside a titled Section. */}
        <Reveal>
          <YearFilm year={new Date(yearItem.startDate || new Date()).getFullYear()} />
        </Reveal>

        <PeriodReflection key={yearItem.id} label="Year" timePeriod="year" itemId={yearItem.id} initialText={yearItem.reflection}
          periodKey={String(yearItem.id || activeYear)}
          placeholder="Reflect on your year so far... What's working? What needs to change?" />
      </Page>
    </div>
  )
}
