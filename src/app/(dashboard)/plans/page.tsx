'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { usePlansStore } from '@/stores/plansStore'
import { Loader } from '@/components/ui/Loader'
import { Button, EmptyState, Page, PageHeader, Panel, Section, Stat, StatGrid } from '@/components/ds'
import { PlanFormModal } from '@/components/plans/PlanFormModal'
import { ProgressSegments } from '@/components/plans/ProgressSegments'
import { formatMonthRange, formatSpan } from '@/lib/plans/duration'
import { countStatuses } from '@/lib/plans/status'
import { CADENCE_LABELS } from '@/lib/plans/types'
import type { PlanSummary } from '@/lib/plans/types'

function activeStatusesOf(plan: PlanSummary) {
  return (plan.sections ?? []).flatMap(s => (s.goals ?? []).filter(g => !g.archived).map(g => g.status))
}

function PlanRow({ plan, onOpen }: { plan: PlanSummary; onOpen: () => void }) {
  const lastReviewed = plan.reviewSessions?.[0]?.conductedAt
  const activeStatuses = activeStatusesOf(plan)
  return (
    <Panel onClick={onOpen} role="link" className="group flex h-full flex-col gap-4" aria-label={`Open plan ${plan.title}`}>
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-display text-xl leading-snug text-parchment">{plan.title}</h3>
          <ArrowUpRight
            className="mt-1 h-4 w-4 shrink-0 text-gold-dim transition-colors group-hover:text-gold"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <p className="font-mono text-[11px] tabular-nums text-parchment/50">
          {formatMonthRange(plan.startMonth, plan.endMonth)} · <span className="text-gold-dim">{formatSpan(plan.startMonth, plan.endMonth)}</span>
        </p>
      </div>
      {plan.anchorNote && (
        <p className="line-clamp-2 text-body italic text-parchment/55">“{plan.anchorNote}”</p>
      )}
      <ProgressSegments statuses={activeStatuses} className="mt-auto" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gold/10 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-parchment/45">
        <span>{CADENCE_LABELS[plan.reviewCadence] ?? plan.reviewCadence} reviews</span>
        <span className="tabular-nums">
          {lastReviewed ? `Last reviewed ${format(new Date(lastReviewed), 'MMM yyyy')}` : 'Never reviewed'}
        </span>
      </div>
    </Panel>
  )
}

export default function PlansPage() {
  const router = useRouter()
  const { plans, loadingPlans, plansError, fetchPlans } = usePlansStore()
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const ready = !loadingPlans && !plansError
  const hasPlans = ready && plans.length > 0
  // Portfolio rollup across every plan (display only)
  const totals = countStatuses(plans.flatMap(activeStatusesOf))
  const pct = (n: number) => (totals.total > 0 ? Math.round((n / totals.total) * 100) : 0)

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="Long-Term"
        title="Long-Term Plans"
        description="Sketch the decade ahead, or just next quarter. Each plan holds sections, goals and the reviews that keep them honest."
        meta={hasPlans ? `${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}` : undefined}
        actions={
          hasPlans ? (
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)} data-cursor="Name a plan, pick its months">
              New plan
            </Button>
          ) : undefined
        }
      />

      {loadingPlans && <Loader routeKey="plans" />}

      {!loadingPlans && plansError && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 border-ember/40" role="alert">
          <p className="text-body text-ember">{plansError}</p>
          <Button size="sm" variant="danger" onClick={() => fetchPlans()}>Retry</Button>
        </Panel>
      )}

      {ready && plans.length === 0 && (
        <EmptyState
          title="No long-term plans yet"
          body="Sketch the decade ahead — or just next quarter. Start by naming a plan and picking its months."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)} data-cursor="Name a plan, pick its months">
              Create your first plan
            </Button>
          }
        />
      )}

      {hasPlans && (
        <>
          <Section title="Across all plans">
            <StatGrid>
              <Stat label="Goals" value={totals.total} caption={`in ${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}`} />
              <Stat label="Achieved" value={`${pct(totals.achieved)}%`} caption={`${totals.achieved} of ${totals.total}`} tone="moss" />
              <Stat label="In progress" value={totals.inProgress} caption={`${totals.notStarted} not started`} tone="gold" />
              <Stat label="At risk" value={totals.atRisk} caption={totals.atRisk > 0 ? 'Worth a review' : 'Nothing slipping'} tone={totals.atRisk > 0 ? 'ember' : 'neutral'} />
            </StatGrid>
          </Section>

          <Section title="Plans">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {plans.map(p => (
                <PlanRow key={p.id} plan={p} onOpen={() => router.push(`/plans/${p.id}`)} />
              ))}
            </div>
          </Section>
        </>
      )}

      {formOpen && (
        <PlanFormModal
          onClose={() => setFormOpen(false)}
          onSaved={plan => router.push(`/plans/${plan.id}`)}
        />
      )}
    </Page>
  )
}
