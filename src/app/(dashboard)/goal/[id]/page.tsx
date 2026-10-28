'use client'

import { useRouter, useParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Loader } from '@/components/ui/Loader'
import { Scramble } from '@/components/ui/motion'
import { InlineEdit } from '@/components/ui/InlineEdit'
import { Breadcrumbs, type Crumb } from '@/components/hierarchy/Breadcrumbs'
import { ItemHeaderCard } from '@/components/hierarchy/ItemHeaderCard'
import { DeleteItemButton } from '@/components/hierarchy/DeleteItemButton'
import { WeightSlider } from '@/components/hierarchy/WeightScoreInputs'
import { useItemTree } from '@/components/hierarchy/useItemTree'
import { findItemById, equalWeight } from '@/components/hierarchy/itemTree'

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
  if (!goalItem) return <div className="p-6 text-ink/60">Goal not found.</div>

  const gScore = completionMap[goalItem.id] || 0
  const crumbs: Crumb[] = [{ label: 'Year', href: '/year' }]
  if (parentCategory) crumbs.push({ label: parentCategory.title })
  crumbs.push({ label: goalItem.title })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <Breadcrumbs crumbs={crumbs} />

      <ItemHeaderCard item={goalItem} score={gScore} renameLabel="Rename goal" deleteLabel="Delete Goal" showTheme
        onRename={t => updateItem(goalItem.id, { title: t })} onTheme={t => updateItem(goalItem.id, { theme: t })}
        onDeleted={handleDeleted} />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-ink"><Scramble text="Quarters" mono={false} /></h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quarters.map((quarter, idx) => {
            const qScore = completionMap[quarter.id] || 0
            return (
              <Card key={quarter.id} className="p-5 hover:border-gold transition-colors cursor-pointer group relative" onClick={() => router.push(`/quarter/${quarter.id}`)}>
                <DeleteItemButton itemId={quarter.id} title="Delete Quarter" onDeleted={handleDeleted} />
                <div className="flex items-center justify-between mb-3 pr-8">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      <InlineEdit value={quarter.title || ''} onSave={t => updateItem(quarter.id, { title: t })} placeholder={`Q${idx + 1}`} title="Rename quarter"
                        inputClassName="w-full min-w-0 rounded-md border border-gold/40 bg-mist/20 px-2 py-1 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-gold/30" />
                    </p>
                    <p className="text-[10px] text-ink/40 font-mono mt-0.5">
                      {quarter.startDate && format(new Date(quarter.startDate), 'MMM d')} – {quarter.endDate && format(new Date(quarter.endDate), 'MMM d')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink/30 group-hover:text-gold transition shrink-0" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <ProgressRing progress={qScore} size={40} />
                  <span className="text-lg font-mono font-bold">{Math.round(qScore)}%</span>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <WeightSlider value={quarter.weight || 0} onChange={v => updateItem(quarter.id, { weight: v })} />
                </div>
              </Card>
            )
          })}
        </div>
        {quarters.length > 0 && (
          <div className="flex justify-end mt-2">
            <span className={`text-[10px] font-mono ${Math.round(quarterWeightSum) === 100 ? 'text-sage' : 'text-[#cf8f78]'}`}>
              Total: {Math.round(quarterWeightSum)}%
            </span>
          </div>
        )}
        {quarters.length === 0 && <p className="text-sm text-ink/40 italic">No quarters found for this goal.</p>}
      </div>
    </div>
  )
}
