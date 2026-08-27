'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, Compass, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { usePlansStore } from '@/stores/plansStore'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { PlanFormModal } from '@/components/plans/PlanFormModal'
import { ProgressSegments } from '@/components/plans/ProgressSegments'
import { formatMonthRange, formatSpan } from '@/lib/plans/duration'
import { CADENCE_LABELS } from '@/lib/plans/types'
import type { PlanSummary } from '@/lib/plans/types'

function PlanCard({ plan, onOpen }: { plan: PlanSummary; onOpen: () => void }) {
  const lastReviewed = plan.reviewSessions?.[0]?.conductedAt
  const activeStatuses = (plan.sections ?? [])
    .flatMap(s => (s.goals ?? []).filter(g => !g.archived).map(g => g.status))
  return (
    <Card onClick={onOpen} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-snug text-parchment line-clamp-2">{plan.title}</h3>
        <CalendarRange className="w-4 h-4 mt-1 shrink-0 text-gold-dim" strokeWidth={1.5} />
      </div>
      {plan.anchorNote && (
        <p className="text-xs italic text-parchment/50 line-clamp-2">“{plan.anchorNote}”</p>
      )}
      <div className="space-y-0.5">
        <p className="font-mono text-[11px] text-parchment/55">
          {formatMonthRange(plan.startMonth, plan.endMonth)}
        </p>
        <p className="text-xs text-gold-dim">{formatSpan(plan.startMonth, plan.endMonth)}</p>
      </div>
      <ProgressSegments statuses={activeStatuses} />
      <div className="flex items-center justify-between pt-2 border-t hairline-top">
        <span className="text-[10px] uppercase tracking-wider text-parchment/40">
          {CADENCE_LABELS[plan.reviewCadence] ?? plan.reviewCadence} reviews
        </span>
        <span className="text-[10px] text-parchment/40">
          {lastReviewed ? `Last reviewed ${format(new Date(lastReviewed), 'MMM yyyy')}` : 'Never reviewed'}
        </span>
      </div>
    </Card>
  )
}

export default function PlansPage() {
  const router = useRouter()
  const { plans, loadingPlans, plansError, fetchPlans } = usePlansStore()
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 pb-24 lg:pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl text-parchment">Long-Term Plans</h1>
          <p className="mt-1 text-sm text-parchment/55">
            Goals over any horizon — a month, a quarter, a year, or decades.
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 min-h-11 px-4 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-glow transition-colors"
        >
          <Plus className="w-4 h-4" /> New Long-Term Plan
        </button>
      </header>

      {loadingPlans && (
        <Loader routeKey="plans" />
      )}

      {!loadingPlans && plansError && (
        <div className="rounded-[8px] border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-[#CD8B70]">
          {plansError}
          <button onClick={() => fetchPlans()} className="ml-2 underline underline-offset-2">Retry</button>
        </div>
      )}

      {!loadingPlans && !plansError && plans.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <Compass className="w-10 h-10 text-gold-dim" strokeWidth={1.25} />
          <h2 className="mt-4 font-display text-xl text-parchment">No long-term plans yet</h2>
          <p className="mt-1 max-w-sm text-sm text-parchment/55">
            Sketch the decade ahead — or just next quarter. Start by naming a plan and picking its months.
          </p>
          <button
            onClick={() => setFormOpen(true)}
            className="mt-6 flex items-center gap-2 min-h-12 px-6 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-glow transition-colors"
          >
            <Plus className="w-4 h-4" /> Create your first plan
          </button>
        </div>
      )}

      {!loadingPlans && !plansError && plans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map(p => (
            <PlanCard key={p.id} plan={p} onOpen={() => router.push(`/plans/${p.id}`)} />
          ))}
        </div>
      )}

      {formOpen && (
        <PlanFormModal
          onClose={() => setFormOpen(false)}
          onSaved={plan => router.push(`/plans/${plan.id}`)}
        />
      )}
    </div>
  )
}
