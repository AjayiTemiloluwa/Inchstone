'use client'

/**
 * Plan detail (§3–§7): Overview (sections/goals) · Gantt · Review tabs.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { usePlansStore } from '@/stores/plansStore'
import { Segmented } from '@/components/ui/Segmented'
import { PlanFormModal } from '@/components/plans/PlanFormModal'
import { SectionList } from '@/components/plans/SectionList'
import { GoalFormModal } from '@/components/plans/GoalFormModal'
import { GoalDetailModal } from '@/components/plans/GoalDetailModal'
import { GanttChart } from '@/components/plans/GanttChart'
import { ProgressSegments } from '@/components/plans/ProgressSegments'
import { ReviewTab } from '@/components/plans/ReviewTab'
import { formatMonthRange, formatSpan } from '@/lib/plans/duration'
import { CADENCE_LABELS, type PlanGoalRecord, type PlanSectionRecord } from '@/lib/plans/types'

type TabKey = 'overview' | 'gantt' | 'review'

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { currentPlan, loadingPlan, planError, fetchPlan, deletePlan, fetchTrackerItems } = usePlansStore()

  const [tab, setTab] = useState<TabKey>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [goalForm, setGoalForm] = useState<{ open: boolean; sectionId: string; initial: PlanGoalRecord | null }>({
    open: false,
    sectionId: '',
    initial: null,
  })
  const [detailGoal, setDetailGoal] = useState<PlanGoalRecord | null>(null)

  useEffect(() => {
    fetchPlan(id)
  }, [id, fetchPlan])

  // Load yearly-tracker items once for §8 rollup chips
  useEffect(() => {
    fetchTrackerItems()
  }, [fetchTrackerItems])

  if (loadingPlan && !currentPlan) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 pb-24 lg:px-8 lg:pb-12" aria-busy="true">
        <div className="h-4 w-24 animate-pulse rounded bg-parchment/10" />
        <div className="h-8 w-1/2 animate-pulse rounded bg-parchment/10" />
        <div className="h-40 animate-pulse rounded-[8px] bg-parchment/5" />
      </div>
    )
  }

  if (!loadingPlan && !currentPlan) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center lg:px-8">
        <h1 className="font-display text-xl text-parchment">Plan not found</h1>
        <p className="mt-2 text-sm text-parchment/55">{planError || 'It may have been deleted.'}</p>
        <Link href="/plans" className="mt-6 inline-block min-h-11 rounded-md border border-parchment/20 px-5 py-2.5 text-sm text-parchment/75 transition-colors hover:border-gold/40 hover:text-parchment">
          ← Back to plans
        </Link>
      </div>
    )
  }

  if (!currentPlan) return null
  const plan = currentPlan
  // Plan-level rollup (§5): every non-archived goal in the plan
  const activeStatuses = (plan.sections ?? [])
    .flatMap(s => (s.goals ?? []).filter(g => !g.archived).map(g => g.status))

  const handleDeletePlan = async () => {
    if (!window.confirm(`Delete “${plan.title}” with all sections, goals and history? This cannot be undone.`)) return
    const ok = await deletePlan(plan.id)
    if (ok) router.push('/plans')
  }

  const openAdd = (section: PlanSectionRecord) => setGoalForm({ open: true, sectionId: section.id, initial: null })
  const openEdit = (goal: PlanGoalRecord) => setGoalForm({ open: true, sectionId: goal.sectionId, initial: goal })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-12">
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/plans"
          className="inline-flex items-center gap-1.5 text-xs text-parchment/45 transition-colors hover:text-parchment"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Long-Term Plans
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-snug text-parchment lg:text-3xl">{plan.title}</h1>
            {plan.anchorNote && (
              <p className="mt-1 max-w-xl text-sm italic text-parchment/55">“{plan.anchorNote}”</p>
            )}
            <p className="mt-2 font-mono text-[11px] text-parchment/50">
              {formatMonthRange(plan.startMonth, plan.endMonth)} · {formatSpan(plan.startMonth, plan.endMonth)} ·{' '}
              <span className="text-gold-dim">{CADENCE_LABELS[plan.reviewCadence] ?? plan.reviewCadence} reviews</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-parchment/20 px-3 text-xs text-parchment/75 transition-colors hover:border-gold/40 hover:text-parchment"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={handleDeletePlan}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-ember/30 px-3 text-xs text-[#CD8B70] transition-colors hover:bg-ember/15"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </header>

      <ProgressSegments statuses={activeStatuses} className="mb-6" />

      {/* Tabs */}
      <Segmented<TabKey>
        ariaLabel="Plan sections"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'gantt', label: 'Gantt' },
          { value: 'review', label: 'Review' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5 border-b hairline-bottom"
      />

      {tab === 'overview' && (
        <SectionList onGoalClick={g => setDetailGoal(g)} onGoalEdit={openEdit} onGoalAdd={openAdd} />
      )}

      {tab === 'gantt' && (
        <>
          {(plan.sections ?? []).flatMap(s => s.goals ?? []).filter(g => !g.archived).length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-parchment/20 px-6 py-10 text-center text-sm text-parchment/50">
              Nothing to chart yet — add sections and goals first.
            </div>
          ) : (
            <GanttChart plan={plan} onSelectGoal={goalId => {
              const g = (plan.sections ?? []).flatMap(s => s.goals ?? []).find(x => x.id === goalId)
              if (g) setDetailGoal(g)
            }} />
          )}
        </>
      )}

      {tab === 'review' && <ReviewTab plan={plan} />}

      {editOpen && (
        <PlanFormModal initial={plan} onClose={() => setEditOpen(false)} onSaved={() => undefined} />
      )}

      {goalForm.open && goalForm.sectionId && (
        <GoalFormModal
          key={goalForm.initial?.id ?? `new-${goalForm.sectionId}`}
          sectionId={goalForm.sectionId}
          planStartMonth={plan.startMonth}
          planEndMonth={plan.endMonth}
          initial={goalForm.initial}
          onClose={() => setGoalForm(f => ({ ...f, open: false }))}
        />
      )}

      {detailGoal && (
        <GoalDetailModal
          key={detailGoal.id}
          goalId={detailGoal.id}
          onClose={() => setDetailGoal(null)}
          onEdit={g => {
            openEdit(g)
            setDetailGoal(null)
          }}
        />
      )}
    </div>
  )
}