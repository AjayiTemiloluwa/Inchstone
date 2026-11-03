'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, Pencil, Undo2 } from 'lucide-react'
import { Badge, Button, EmptyState, IconButton, Panel, cx, inputClass } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'
import { FinanceSheet } from './FinanceSheet'
import { Notice } from './ui'
import { api, naira } from './money'

interface Entry {
  id: string; type: string; amount: number; category: string; description: string | null
  purse: string; priority: string | null; entryDate: string; allocationId: string | null; groupId: string | null
}

const day = (iso: string) => new Date(iso).toISOString().slice(0, 10)

/** The latest movements, with Undo (a void: kept in history, out of every balance) and Edit for income and spending. */
export function RecentActivity({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const { showToast, confirm } = useToast()
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)

  const load = useCallback(async () => {
    const r = await api('GET', '/api/financial?limit=40')
    if (r.ok) setEntries((r.data?.entries as Entry[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load, refreshKey])

  // A transfer is two rows; show it once (the outgoing leg). Envelope funding is managed from the envelope, so it is read-only.
  const rows = (entries ?? []).filter((e) => e.type !== 'transfer_in').slice(0, 12)

  const undo = async (e: Entry) => {
    if (!(await confirm(`Undo "${e.category}" (${naira(e.amount)})? It stays in your history but no longer counts.`))) return
    const r = await api('DELETE', '/api/financial', { id: e.id, reason: 'Undone by user' })
    if (!r.ok) { showToast(r.error ?? 'Could not undo that.', 'error'); return }
    showToast('Undone', 'success'); onChanged()
  }

  if (entries === null) return <Panel className="text-caption text-parchment/55">Loading activity…</Panel>
  if (rows.length === 0) return <EmptyState title="No transactions yet" body="Add your first income so every naira can be given a job." />

  return (
    <>
      <ul className="space-y-2">
        {rows.map((e) => {
          const out = e.type === 'expense' || e.type === 'transfer_out'
          const funding = !!e.allocationId
          return (
            <li key={e.id}>
              <Panel className="flex items-center gap-3 !py-3">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/20 text-gold-dim">
                  {e.type.startsWith('transfer') ? <ArrowLeftRight className="h-4 w-4" /> : e.type === 'income' ? '↓' : '↑'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-parchment">{funding ? (e.description ?? 'Envelope funding') : e.type.startsWith('transfer') ? (e.description ?? 'Transfer') : e.category}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-caption text-parchment/55">
                    <span>{new Date(e.entryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    <span>{e.purse}</span>
                    {e.priority && !funding && <Badge>{e.priority}</Badge>}
                  </p>
                </div>
                <span className={cx('shrink-0 font-mono text-sm font-semibold tabular-nums', e.type === 'income' ? 'text-moss' : e.type.startsWith('transfer') ? 'text-parchment/70' : 'text-parchment')}>
                  {e.type === 'income' ? '+' : out && !e.type.startsWith('transfer') ? '-' : ''}{naira(e.amount)}
                </span>
                {!funding && (
                  <span className="flex shrink-0">
                    {(e.type === 'income' || e.type === 'expense') && <IconButton icon={Pencil} label={`Edit ${e.category}`} onClick={() => setEditing(e)} />}
                    <IconButton icon={Undo2} label={`Undo ${e.category}`} onClick={() => void undo(e)} />
                  </span>
                )}
              </Panel>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-center text-caption"><Link href="/transactions" className="text-gold underline-offset-2 hover:underline">All transactions, filters and reports</Link></p>
      <EditSheet entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />
    </>
  )
}

function EditSheet({ entry, onClose, onSaved }: { entry: Entry | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ amount: '', date: '', category: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (entry) { setV({ amount: String(entry.amount), date: day(entry.entryDate), category: entry.category, description: entry.description ?? '' }); setError(null) }
  }, [entry])
  if (!entry) return null
  const set = (k: keyof typeof v) => (ev: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: ev.target.value }))
  const save = async (ev: React.FormEvent) => {
    ev.preventDefault(); setBusy(true); setError(null)
    const r = await api('PATCH', '/api/financial', { id: entry.id, amount: v.amount, entryDate: v.date, category: v.category, description: v.description })
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'Could not save.'); return }
    onSaved()
  }
  const label = 'mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/55'
  return (
    <FinanceSheet open onClose={onClose} title={`Edit ${entry.type}`}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-caption text-parchment/60">Changing the amount or date keeps the original in your history and records the corrected entry beside it.</p>
        <label className="block"><span className={label}>Amount</span><input value={v.amount} onChange={set('amount')} inputMode="decimal" className={inputClass} required /></label>
        <label className="block"><span className={label}>Date</span><input type="date" value={v.date} onChange={set('date')} className={inputClass} required /></label>
        <label className="block"><span className={label}>Category</span><input value={v.category} onChange={set('category')} maxLength={60} className={inputClass} required /></label>
        <label className="block"><span className={label}>Description</span><input value={v.description} onChange={set('description')} maxLength={200} className={inputClass} /></label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button></div>
      </form>
    </FinanceSheet>
  )
}
