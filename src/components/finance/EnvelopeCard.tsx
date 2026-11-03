'use client'

import { useId, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, IconButton, Meter, Panel, cx, inputClass } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'
import { SECTION_CATEGORIES } from './budgetCategories'
import { Notice, SECTION_TONE } from './ui'
import { api, naira, nairaShort } from './money'

export interface EnvelopeData {
  section: 'Need' | 'Want' | 'Offerings' | 'Savings'
  benchmarkPct: number
  actualPct: number | null
  assigned: number
  spent: number
  remaining: number
  planned: number
  overPlanned: boolean
  allocation: { id: string; sourcePurse: string; purse: string } | null
  categories: { category: string; budgetId: string | null; planned: number; spent: number }[]
}

const COPY = {
  Need: { title: 'Needs', line: 'Rent, food, transport, bills: what you cannot skip.' },
  Want: { title: 'Wants', line: 'Lifestyle and small joys. Enjoy them within the limit.' },
  Offerings: { title: 'Offerings', line: 'Tithes, gifts and giving. Set this aside first.' },
  Savings: { title: 'Savings', line: 'Reserves and goals. Pay your future self.' },
} as const

interface Props {
  envelope: EnvelopeData
  month: string
  purses: { name: string; balance: number }[]
  /** Reload the overview after any change. */
  onChanged: () => void
}

/** One envelope for the month: the money it was given, what was spent from it, and an optional plan by category. */
export function EnvelopeCard({ envelope: e, month, purses, onChanged }: Props) {
  const { showToast } = useToast()
  const tone = SECTION_TONE[e.section]
  const [assigning, setAssigning] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [amount, setAmount] = useState(e.assigned ? String(e.assigned) : '')
  const [source, setSource] = useState(e.allocation?.sourcePurse ?? 'Main')
  const [dest, setDest] = useState(e.allocation?.purse ?? purses.find((p) => p.name !== 'Main')?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')
  const [newAmt, setNewAmt] = useState('')
  const listId = useId()

  const used = e.assigned > 0 ? Math.min(100, (e.spent / e.assigned) * 100) : e.spent > 0 ? 100 : 0
  const over = e.spent > e.assigned
  const meterTone = over ? 'ember' : used >= 85 ? 'gold' : e.section === 'Offerings' ? 'moss' : 'gold'
  const suggestions = SECTION_CATEGORIES[e.section]?.map((c) => c.label) ?? []

  const saveAssignment = async (value: string) => {
    setBusy(true); setError(null)
    const r = await api('POST', '/api/allocations', { section: e.section, month, amount: value === '' ? 0 : value, sourcePurse: source, purse: dest || source })
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'Could not assign that.'); return }
    showToast(value === '' || Number(value) === 0 ? `${COPY[e.section].title} cleared` : `${naira(Number(value))} assigned to ${COPY[e.section].title}`, 'success')
    setAssigning(false)
    onChanged()
  }

  const savePlan = async (category: string, value: string, existingId: string | null) => {
    setError(null)
    if (value.trim() === '' || Number(value) === 0) {
      if (existingId) { const r = await api('DELETE', '/api/budgets', { id: existingId }); if (!r.ok) setError(r.error ?? 'Could not remove that.') ; else onChanged() }
      return
    }
    const r = await api('POST', '/api/budgets', { section: e.section, category, amount: value, month })
    if (!r.ok) { setError(r.error ?? 'Could not save that.'); return }
    onChanged()
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={cx('text-heading font-semibold', tone.text)}>{COPY[e.section].title}</h3>
          <p className="text-caption text-parchment/60">{COPY[e.section].line}</p>
        </div>
        <Badge tone={e.actualPct === null ? 'neutral' : e.actualPct <= e.benchmarkPct ? 'moss' : 'ember'}>
          {e.actualPct === null ? `Target ${e.benchmarkPct}%` : `${e.actualPct}% of income · target ${e.benchmarkPct}%`}
        </Badge>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[['Assigned', e.assigned, 'text-parchment'], ['Spent', e.spent, over ? 'text-ember' : 'text-parchment'], [over ? 'Over by' : 'Left', Math.abs(e.remaining), over ? 'text-ember' : 'text-moss']].map(([label, value, cls]) => (
          <div key={label as string} className="rounded-xl border border-gold/10 px-1.5 py-2">
            <dd className={cx('break-words font-mono text-sm font-semibold tabular-nums sm:text-base', cls as string)}>{nairaShort(value as number)}</dd>
            <dt className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-parchment/55">{label as string}</dt>
          </div>
        ))}
      </dl>

      <Meter value={used} tone={meterTone} label={`${COPY[e.section].title} used`} />
      {over && <p role="alert" className="text-caption text-ember">You have spent more than you assigned here. Assign more from Main, or ease off this envelope.</p>}
      {!over && e.assigned === 0 && <p className="text-caption text-parchment/60">No money assigned yet. Give this envelope a job.</p>}
      {e.allocation && e.assigned > 0 && <p className="text-caption text-parchment/55">Funded from <strong className="text-parchment/80">{e.allocation.sourcePurse}</strong> into <strong className="text-parchment/80">{e.allocation.purse}</strong>.</p>}

      {assigning ? (
        <form className="space-y-3 rounded-xl border border-gold/20 p-3 animate-fadeIn" onSubmit={(ev) => { ev.preventDefault(); void saveAssignment(amount) }}>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/55">Amount for {month}</span>
            <input autoFocus inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} placeholder="0.00" className={inputClass} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/55">Take from</span>
              <select value={source} onChange={(ev) => setSource(ev.target.value)} className={inputClass}>{purses.map((p) => <option key={p.name} value={p.name}>{p.name} · {naira(p.balance)}</option>)}</select></label>
            <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/55">Put into</span>
              <select value={dest} onChange={(ev) => setDest(ev.target.value)} className={inputClass}>{purses.filter((p) => p.name !== source).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setAssigning(false); setError(null) }}>Cancel</Button>
            {e.assigned > 0 && <Button type="button" variant="ghost" disabled={busy} onClick={() => void saveAssignment('')}>Clear</Button>}
            <Button type="submit" variant="primary" disabled={busy || !dest}>{busy ? 'Saving…' : 'Assign'}</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant={e.assigned > 0 ? 'ghost' : 'primary'} onClick={() => setAssigning(true)}>{e.assigned > 0 ? 'Change amount' : 'Assign money'}</Button>
          <Button variant="ghost" icon={ChevronDown} aria-expanded={showPlan} onClick={() => setShowPlan((v) => !v)}>Plan by category</Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {showPlan && (
        <div className="space-y-2 border-t border-gold/10 pt-3 animate-fadeIn">
          {e.overPlanned && <p role="alert" className="text-caption text-ember">Your category plans ({naira(e.planned)}) add up to more than this envelope ({naira(e.assigned)}).</p>}
          {e.categories.length === 0 && <p className="text-caption text-parchment/60">Plan how this envelope is used, category by category.</p>}
          <ul className="space-y-1.5">
            {e.categories.map((c) => (
              <li key={c.category} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-parchment">{c.category}</span>
                  <span className={cx('block font-mono text-[11px]', c.planned > 0 && c.spent > c.planned ? 'text-ember' : 'text-parchment/55')}>spent {naira(c.spent)}</span>
                </span>
                <input aria-label={`Planned amount for ${c.category}`} inputMode="decimal" defaultValue={c.planned || ''} placeholder="Plan"
                  onBlur={(ev) => { if (ev.target.value !== String(c.planned || '')) void savePlan(c.category, ev.target.value, c.budgetId) }}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur() }}
                  className={cx(inputClass, 'w-28 text-right font-mono')} />
                {c.budgetId && <IconButton icon={Trash2} label={`Remove plan for ${c.category}`} tone="danger" onClick={() => void savePlan(c.category, '', c.budgetId)} />}
              </li>
            ))}
          </ul>
          <form className="flex items-stretch gap-2 pt-1" onSubmit={(ev) => { ev.preventDefault(); if (newCat.trim() && newAmt.trim()) { void savePlan(newCat.trim(), newAmt, null); setNewCat(''); setNewAmt('') } }}>
            <input list={listId} value={newCat} onChange={(ev) => setNewCat(ev.target.value)} placeholder="Category" aria-label="New category" className={cx(inputClass, 'min-w-0 flex-1')} />
            <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
            <input inputMode="decimal" value={newAmt} onChange={(ev) => setNewAmt(ev.target.value)} placeholder="Plan" aria-label="Planned amount" className={cx(inputClass, 'w-24 text-right font-mono')} />
            <Button type="submit" variant="ghost" icon={Plus} aria-label="Add category plan" disabled={!newCat.trim() || !newAmt.trim()} />
          </form>
        </div>
      )}
    </Panel>
  )
}
