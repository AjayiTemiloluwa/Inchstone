'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Badge, Button, IconButton, Meter, Page, PageHeader, Panel, Section, Stat, StatGrid, inputClass } from '@/components/ds'
import { Loader } from '@/components/ui/Loader'
import { TransactionForm } from '@/components/finance/TransactionForm'
import { TransferForm } from '@/components/finance/TransferForm'
import { EnvelopeCard, type EnvelopeData } from '@/components/finance/EnvelopeCard'
import { AccountsPanel, type PurseData } from '@/components/finance/AccountsPanel'
import { RecentActivity } from '@/components/finance/RecentActivity'
import { MonthLedger, type Reconciliation } from '@/components/finance/MonthLedger'
import { FinanceSheet } from '@/components/finance/FinanceSheet'
import { Notice } from '@/components/finance/ui'
import { api, monthLabel, naira, nairaShort } from '@/components/finance/money'

interface Overview {
  month: string
  purses: PurseData[]
  netWorth: number
  readyToAssign: number
  income: number
  spent: number
  net: number
  savingsRatePct: number | null
  assignedTotal: number
  unassignedIncome: number
  sections: EnvelopeData[]
  reconciliation: Reconciliation
  runwayMonths: number | null
  integrity: { ok: boolean; issues: string[]; entryCount: number; voidedCount: number }
}

const thisMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }
const shift = (m: string, d: number) => { const [y, mo] = m.split('-').map(Number); const x = new Date(y, mo - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }

/**
 * Finance, built on zero-based envelope budgeting: every naira that comes in is given a job (an envelope),
 * measured against the 50/30/20 guideline (adapted: Offerings first). All figures are computed on the server
 * from one validated ledger, so what you see here can never drift from what was recorded.
 */
export default function FinancePage() {
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [sheet, setSheet] = useState<'add' | 'transfer' | null>(null)
  // Monthly savings goal: kept in this browser under the same key the earlier page used, so an existing target carries over.
  const [goal, setGoal] = useState(0)
  const [editGoal, setEditGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  useEffect(() => { try { const v = parseFloat(localStorage.getItem('monthlySavingsTarget') ?? ''); if (v > 0) setGoal(v) } catch { /* private mode */ } }, [])
  const saveGoal = () => {
    const v = parseFloat(goalInput.replace(/,/g, ''))
    const next = Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0
    setGoal(next); setEditGoal(false)
    try { localStorage.setItem('monthlySavingsTarget', String(next)) } catch { /* private mode */ }
  }

  const reload = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    let live = true
    void api('GET', `/api/finance/overview?month=${month}`).then((r) => {
      if (!live) return
      if (r.ok) { setData(r.data as unknown as Overview); setError(null) } else setError(r.error ?? 'Could not load your finances.')
    })
    return () => { live = false }
  }, [month, tick])

  if (!data && !error) return <Loader routeKey="finance" />
  if (!data) return <Page width="narrow" className="pt-8"><Notice tone="error">{error}</Notice><Button className="mt-3" onClick={reload}>Try again</Button></Page>

  const isNow = month === thisMonth()
  const jobsPct = data.income > 0 ? Math.min(100, Math.round((data.assignedTotal / data.income) * 100)) : 0
  const purseOpts = data.purses.map((p) => ({ name: p.name, balance: p.balance }))
  const everyNairaHasAJob = data.readyToAssign === 0 && data.income > 0

  return (
    <Page width="wide" className="pb-16">
      <PageHeader
        eyebrow={<>Ledger · <span className="tabular-nums">{data.integrity.entryCount}</span> entries</>}
        title="Every sum, accounted for."
        description={`Income, expenses & savings — ${monthLabel(month)}. Give every naira a job: income lands in Main, you assign it to envelopes, and spending is measured against them.`}
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button variant="primary" icon={Plus} onClick={() => setSheet('add')}>Add transaction</Button>
            <Button variant="ghost" icon={ArrowLeftRight} onClick={() => setSheet('transfer')} disabled={data.purses.length < 2}>Transfer</Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-2" role="group" aria-label="Month">
        <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth(shift(month, -1))} />
        <div className="text-center">
          <p className="font-display text-heading text-parchment">{monthLabel(month)}</p>
          {!isNow && <button type="button" onClick={() => setMonth(thisMonth())} className="text-caption text-gold underline-offset-2 hover:underline">Back to this month</button>}
        </div>
        <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth(shift(month, 1))} />
      </div>

      <Section title="This month at a glance" id="finance-glance">
        <StatGrid cols={4}>
          <Stat label="Income" value={nairaShort(data.income)} tone="moss" caption={monthLabel(month)} />
          <Stat label="Expenses" value={nairaShort(data.spent)} tone="ember" caption="all spending this month" />
          <Stat label="Net" value={nairaShort(data.net)} tone={data.net >= 0 ? 'gold' : 'ember'} caption={data.savingsRatePct === null ? 'no income yet' : `saved ${data.savingsRatePct}% of income`} />
          <Stat label="Offerings" value={nairaShort(data.sections.find((x) => x.section === 'Offerings')?.spent ?? 0)} caption={`Given in ${monthLabel(month)}`} />
        </StatGrid>
        <StatGrid cols={4} className="mt-3">
          <Stat label="Net worth" value={nairaShort(data.netWorth)} tone="gold" caption="all purses together" />
          <Stat label="Ready to assign" value={nairaShort(data.readyToAssign)} tone={data.readyToAssign > 0 ? 'gold' : 'moss'} caption="in Main, no job yet" />
          <Stat label="Month opened at" value={nairaShort(data.reconciliation.openingNetWorth)} caption="net worth on the 1st" />
          <Stat label="Month closes at" value={nairaShort(data.reconciliation.closingNetWorth)} tone={data.reconciliation.reconciles ? 'neutral' : 'ember'} caption={data.reconciliation.reconciles ? 'opening + income − expenses' : 'does not reconcile'} />
        </StatGrid>

        <Panel className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/55">Monthly savings goal</p>
            <Button size="sm" variant="ghost" className="text-gold" onClick={() => { setEditGoal(!editGoal); setGoalInput(goal ? String(goal) : '') }}>{editGoal ? 'Cancel' : goal > 0 ? 'Edit' : 'Set'}</Button>
          </div>
          {editGoal ? (
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); saveGoal() }}>
              <input autoFocus inputMode="decimal" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} aria-label="Monthly savings target" placeholder="50000" className={`${inputClass} max-w-xs font-mono`} />
              <Button type="submit" variant="secondary">Save</Button>
            </form>
          ) : goal > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-mono text-heading tabular-nums text-parchment">{naira(Math.max(data.net, 0))} <span className="text-mono text-parchment/55">/ {naira(goal)}</span></p>
                {data.net >= goal && <Badge tone="moss">Goal reached</Badge>}
              </div>
              <Meter value={Math.min(100, (Math.max(data.net, 0) / goal) * 100)} tone={data.net >= goal ? 'moss' : 'gold'} label="Savings goal progress" />
              <p className="text-caption text-parchment/55">Saved this month = income minus expenses.</p>
            </div>
          ) : (
            <p className="text-caption text-parchment/60">Tap Set to add a monthly target.</p>
          )}
        </Panel>

        <Panel className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-parchment">
              {everyNairaHasAJob ? 'Every naira has a job ✓' : data.readyToAssign > 0 ? `${naira(data.readyToAssign)} is waiting for a job` : data.income === 0 ? 'Start by recording this month’s income' : 'Money is assigned'}
            </p>
            {data.runwayMonths !== null && <Badge tone={data.runwayMonths >= 3 ? 'moss' : data.runwayMonths >= 1 ? 'gold' : 'ember'}>Emergency fund covers {data.runwayMonths} month{data.runwayMonths === 1 ? '' : 's'} of Needs</Badge>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-parchment/10" role="progressbar" aria-label="Income assigned to envelopes" aria-valuemin={0} aria-valuemax={100} aria-valuenow={jobsPct}>
            <div className="h-full rounded-full bg-gold transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${jobsPct}%` }} />
          </div>
          <p className="text-caption text-parchment/60">{naira(data.assignedTotal)} assigned of {naira(data.income)} income this month. Assigning moves real money out of Main into the purse you choose.</p>
        </Panel>
      </Section>

      <Section title="Envelopes" id="finance-envelopes" description="Offerings and Savings first, then Needs, then Wants. The target is a guide, not a rule.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[...data.sections].sort((a, b) => ['Offerings', 'Savings', 'Need', 'Want'].indexOf(a.section) - ['Offerings', 'Savings', 'Need', 'Want'].indexOf(b.section)).map((s) => (
            <EnvelopeCard key={`${month}-${s.section}-${s.assigned}-${s.allocation?.id ?? ''}`} envelope={s} month={month} purses={purseOpts} onChanged={reload} />
          ))}
        </div>
      </Section>

      <Section title="Where your money sits" id="finance-accounts">
        <AccountsPanel purses={data.purses} onChanged={reload} onTransfer={() => setSheet('transfer')} />
      </Section>

      <Section title="Recent activity" id="finance-activity">
        <RecentActivity refreshKey={tick} onChanged={reload} />
      </Section>

      <Section title={`${monthLabel(month)} ledger`} id="finance-ledger" description="Every entry in order with a running balance, and the proof that each purse adds up.">
        <MonthLedger month={month} recon={data.reconciliation} income={data.income} spent={data.spent} refreshKey={tick} />
      </Section>

      <Section title="Ledger check" id="finance-integrity">
        <Panel className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-parchment">
            {data.integrity.ok ? <ShieldCheck className="h-4 w-4 text-moss" aria-hidden /> : <TriangleAlert className="h-4 w-4 text-ember" aria-hidden />}
            {data.integrity.ok ? 'Your books balance' : 'Your books need attention'}
          </p>
          {data.integrity.ok ? (
            <p className="text-caption text-parchment/65">{data.integrity.entryCount} entries checked: no purse is overdrawn, every transfer has both sides, and nothing has been deleted (corrections are kept as {data.integrity.voidedCount} voided {data.integrity.voidedCount === 1 ? 'entry' : 'entries'}).</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-caption text-ember">{data.integrity.issues.map((i) => <li key={i}>{i}</li>)}</ul>
          )}
          <details className="pt-1 text-caption text-parchment/65">
            <summary className="cursor-pointer text-parchment/80">How this stays honest</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Money can only enter as income (always into Main) or leave as spending. Moving it between purses always writes both sides together or neither.</li>
              <li>No purse can go below zero at any point in time, so you cannot spend, move or back-date money that was not there.</li>
              <li>Entries are never deleted. Undo and Edit keep the original in your history, and balances ignore voided entries.</li>
              <li>Every amount is checked to the kobo, in naira only, and a double tap or retry cannot record the same entry twice.</li>
              <li>Every change is checked against your whole history before it is saved; if anything would break, nothing is changed.</li>
            </ul>
          </details>
        </Panel>
      </Section>

      <FinanceSheet open={sheet === 'add'} onClose={() => setSheet(null)} title="Add a transaction">
        <TransactionForm purses={data.purses} onSuccess={() => { reload() }} />
      </FinanceSheet>
      <FinanceSheet open={sheet === 'transfer'} onClose={() => setSheet(null)} title="Move money between purses">
        <TransferForm purses={purseOpts} onDone={() => { setSheet(null); reload() }} />
      </FinanceSheet>
    </Page>
  )
}
