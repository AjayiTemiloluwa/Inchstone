'use client'

import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { Badge, Button, EmptyState, Page, RowActions, Section } from '@/components/ds'
import { Loader } from '@/components/ui/Loader'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { type Crumb } from '@/components/hierarchy/Breadcrumbs'
import { ItemHeaderCard } from '@/components/hierarchy/ItemHeaderCard'
import { useDeleteItem } from '@/components/hierarchy/DeleteItemButton'
import { WeightSlider } from '@/components/hierarchy/WeightScoreInputs'
import { Meter, NavPanel, Percent } from '@/components/hierarchy/primitives'
import { useItemTree } from '@/components/hierarchy/useItemTree'
import { findItemById, equalWeight } from '@/components/hierarchy/itemTree'

interface GoalQuarterCardProps {
  quarter: Item
  index: number
  score: number
  onOpen: () => void
  onRename: (title: string) => void
  onWeightChange: (value: number) => void
  onDeleted: (id: string) => void | Promise<void>
}

/** One quarter of a yearly goal: rename, weight, delete (row menu), tap to open. */
function GoalQuarterCard({ quarter, index, score, onOpen, onRename, onWeightChange, onDeleted }: GoalQuarterCardProps) {
  const remove = useDeleteItem({ itemId: quarter.id, onDeleted })
  return (
    <NavPanel onOpen={onOpen} className="space-y-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-parchment">
            <InlineEdit value={quarter.title || ''} onSave={onRename} placeholder={`Q${index + 1}`} title="Rename quarter"
              inputClassName="w-full min-w-0 rounded-lg border border-gold/40 bg-ink/40 px-2 py-1 text-sm font-semibold text-parchment outline-none focus:ring-2 focus:ring-gold/30" />
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-parchment/45">
            {quarter.startDate && format(new Date(quarter.startDate), 'MMM d')} – {quarter.endDate && format(new Date(quarter.endDate), 'MMM d')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RowActions label="Quarter actions" actions={[{ label: 'Delete Quarter', icon: Trash2, destructive: true, onSelect: () => { void remove() } }]} />
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-parchment/30 transition-colors group-hover:text-gold" strokeWidth={1.75} />
        </div>
      </div>
      <div className="space-y-2">
        <Percent value={score} className="font-display text-[1.75rem] leading-none text-parchment" />
        <Meter value={score} />
      </div>
      <div onClick={e => e.stopPropagation()}>
        <WeightSlider value={quarter.weight || 0} onChange={onWeightChange} />
      </div>
    </NavPanel>
  )
}

export default function GoalPage() {
  const router = useRouter()
  const params = useParams()
  const goalId = params.id as string

  const { items, completionMap, updateItem } = useHierarchyStore()
  const { loading, fetchItems } = useItemTree()

  const goalItem = findItemById(items, goalId)
  const quarters = goalItem?.children?.filter(c => c.layer === 3) || []
  const parentCategory = goalItem?.parentId ? findItemById(items, goalItem.parentId) : undefined
  const quarterWeightSum = quarters.reduce((s, q) => s + (q.weight || 0), 0)

  const handleDeleted = async (id: string) => {
    if (id === goalId) { router.push('/year'); return }
    const raw = await fetchItems()
    const remaining = (raw || []).filter(i => i.parentId === goalId)
    if (remaining.length > 0) {
      const eq = equalWeight(remaining.length)
      remaining.forEach(m => updateItem(m.id, { weight: eq }))
    }
  }

  if (loading) return <Loader label="Leveling up this goal…" routeKey="goal" />
  if (!goalItem) return (
    <Page width="narrow" className="pt-8"><EmptyState title="Goal not found" action={<Button href="/year">Back to year</Button>} /></Page>
  )

  const gScore = completionMap[goalItem.id] || 0
  const crumbs: Crumb[] = [{ label: 'Year', href: '/year' }]
  if (parentCategory) crumbs.push({ label: parentCategory.title })
  crumbs.push({ label: goalItem.title })

  return (
    <Page width="wide">
      <ItemHeaderCard item={goalItem} score={gScore} renameLabel="Rename goal" deleteLabel="Delete Goal" showTheme
        eyebrow={parentCategory ? `Yearly goal · ${parentCategory.title}` : 'Yearly goal'} crumbs={crumbs}
        onRename={t => updateItem(goalItem.id, { title: t })} onTheme={t => updateItem(goalItem.id, { theme: t })}
        onDeleted={handleDeleted} />

      <Section title="Quarters" id="goal-quarters"
        action={quarters.length > 0 ? (
          <Badge tone={Math.round(quarterWeightSum) === 100 ? 'moss' : 'ember'}>Total {Math.round(quarterWeightSum)}%</Badge>
        ) : undefined}>
        {quarters.length === 0 ? (
          <EmptyState title="No quarters found for this goal." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {quarters.map((quarter, idx) => (
              <GoalQuarterCard key={quarter.id} quarter={quarter} index={idx} score={completionMap[quarter.id] || 0}
                onOpen={() => router.push(`/quarter/${quarter.id}`)}
                onRename={t => updateItem(quarter.id, { title: t })}
                onWeightChange={v => updateItem(quarter.id, { weight: v })}
                onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </Section>
    </Page>
  )
}
