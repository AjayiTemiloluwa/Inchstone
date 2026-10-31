'use client'

/**
 * Plan detail (§3–§7): Overview (sections/goals) · Gantt · Review tabs.
 */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { usePlansStore } from '@/stores/plansStore'
import { useToast } from '@/components/ui/ToastProvider'
import { Button, EmptyState, Page, PageHeader, Section, Segmented, Skeleton, Stat, StatGrid, inputClass } from '@/components/ds'
import { PlanFormModal } from '@/components/plans/PlanFormModal'
import { SectionList } from '@/components/plans/SectionList'
import { GoalFormModal } from '@/components/plans/GoalFormModal'
import { GoalDetailModal } from '@/components/plans/GoalDetailModal'
import { GanttChart } from '@/components/plans/GanttChart'
import { ProgressSegments } from '@/components/plans/ProgressSegments'
import { ReviewTab } from '@/components/plans/ReviewTab'
import { formatMonthRange, formatSpan } from '@/lib/plans/duration'
import { countStatuses } from '@/lib/plans/status'
import { CADENCE_LABELS, type PlanGoalRecord, type PlanSectionRecord } from '@/lib/plans/types'

type TabKey = 'overview' | 'gantt' | 'review'

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { confirm } = useToast()
  const { currentPlan, loadingPlan, planError, fetchPlan, deletePlan, fetchTrackerItems } = usePlansStore()
  // Already-loaded list (when arriving from /plans) powers the plan switcher; no extra fetch
  const plans = usePlansStore(s => s.plans)

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
      <Page width="wide">
        <div aria-busy="true" className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <StatGrid>
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </StatGrid>
        <Skeleton className="h-48" />
      </Page>
    )
  }

  if (!loadingPlan && !currentPlan) {
    return (
      <Page width="narrow">
        <EmptyState
          title="Plan not found"
          body={planError || 'It may have been deleted.'}
          action={
            <Button href="/plans" icon={ArrowLeft}>
              Back to plans
            </Button>
          }
        />
      </Page>
    )
  }

  if (!currentPlan) return null
  const plan = currentPlan
  // Plan-level rollup (§5): every non-archived goal in the plan
  const activeStatuses = (plan.sections ?? [])
    .flatMap(s => (s.goals ?? []).filter(g => !g.archived).map(g => g.status))
  const counts = countStatuses(activeStatuses)
  const pct = (n: number) => (counts.total > 0 ? Math.round((n / counts.total) * 100) : 0)
  const sectionCount = (plan.sections ?? []).length

  const handleDeletePlan = async () => {
    if (!(await confirm(`Delete “${plan.title}” with all sections, goals and history? This cannot be undone.`))) return
    const ok = await deletePlan(plan.id)
    if (ok) router.push('/plans')
  }

  const openAdd = (section: PlanSectionRecord) => setGoalForm({ open: true, sectionId: section.id, initial: null })
  const openEdit = (goal: PlanGoalRecord) => setGoalForm({ open: true, sectionId: goal.sectionId, initial: goal })

  return (
    <Page width="wide">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button href="/plans" variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3">
            Long-Term Plans
          </Button>
          {/* Plan switcher: only when the list is already in memory and there is somewhere to switch to */}
          {plans.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Switch plan</span>
              <select
                value={plan.id}
                onChange={e => router.push(`/plans/${e.target.value}`)}
                className={`${inputClass} max-w-[16rem] truncate pointer-fine:min-h-9`}
              >
                {plans.some(p => p.id === plan.id) ? null : <option value={plan.id}>{plan.title}</option>}
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <PageHeader
          eyebrow={
            <span className="tabular-nums">
              {formatMonthRange(plan.startMonth, plan.endMonth)} · {formatSpan(plan.startMonth, plan.endMonth)} ·{' '}
              {CADENCE_LABELS[plan.reviewCadence] ?? plan.reviewCadence} reviews
            </span>
          }
          title={plan.title}
          description={plan.anchorNote ? <span className="italic">“{plan.anchorNote}”</span> : undefined}
          actions={
            <>
              <Button icon={Pencil} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button variant="danger" icon={Trash2} onClick={handleDeletePlan}>
                Delete
              </Button>
            </>
          }
        />
      </div>

      <Section title="Progress">
        <StatGrid>
          <Stat
            label="Goals"
            value={counts.total}
            caption={`${sectionCount} ${sectionCount === 1 ? 'section' : 'sections'}`}
          />
          <Stat label="Achieved" value={`${pct(counts.achieved)}%`} caption={`${counts.achieved} of ${counts.total}`} tone="moss" />
          <Stat label="In progress" value={counts.inProgress} caption={`${counts.notStarted} not started`} tone="gold" />
          <Stat
            label="At risk"
            value={counts.atRisk}
            caption={counts.atRisk > 0 ? 'Worth a look in Review' : 'Nothing slipping'}
            tone={counts.atRisk > 0 ? 'ember' : 'neutral'}
          />
        </StatGrid>
        <ProgressSegments statuses={activeStatuses} className="mt-5" />
      </Section>

      <div className="space-y-6">
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
          className="w-full border-b border-gold/15"
        />

        {tab === 'overview' && (
          <SectionList onGoalClick={g => setDetailGoal(g)} onGoalEdit={openEdit} onGoalAdd={openAdd} />
        )}

        {tab === 'gantt' && (
          <>
            {(plan.sections ?? []).flatMap(s => s.goals ?? []).filter(g => !g.archived).length === 0 ? (
              <EmptyState title="Nothing to chart yet" body="Add sections and goals first." />
            ) : (
              <GanttChart plan={plan} onSelectGoal={goalId => {
                const g = (plan.sections ?? []).flatMap(s => s.goals ?? []).find(x => x.id === goalId)
                if (g) setDetailGoal(g)
              }} />
            )}
          </>
        )}

        {tab === 'review' && <ReviewTab plan={plan} />}
      </div>

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
    </Page>
  )
}
