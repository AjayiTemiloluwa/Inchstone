'use client'

import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button, Field, inputClass } from '@/components/ds'
import { Notice } from './ui'
import { api, naira, newRequestId } from './money'

interface PurseOpt { name: string; balance: number }

/** Move money between two of your own purses. Both sides are written together or not at all. */
export function TransferForm({ purses, onDone }: { purses: PurseOpt[]; onDone: () => void }) {
  const [from, setFrom] = useState(purses.find((p) => p.name === 'Main')?.name ?? purses[0]?.name ?? '')
  const [to, setTo] = useState(purses.find((p) => p.name !== from)?.name ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(newRequestId()) // reused if the same transfer is retried, so it can never post twice
  const available = purses.find((p) => p.name === from)?.balance ?? 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const r = await api('PUT', '/api/financial', { amount, from, to, description: note, requestId: requestId.current })
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'Could not transfer.'); return }
    requestId.current = newRequestId()
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Field label="From">
          <select value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value === to) setTo(purses.find((p) => p.name !== e.target.value)?.name ?? '') }} className={inputClass}>
            {purses.map((p) => <option key={p.name} value={p.name}>{p.name} · {naira(p.balance)}</option>)}
          </select>
        </Field>
        <ArrowRight className="mx-auto hidden h-5 w-5 text-gold-dim sm:mb-3 sm:block" aria-hidden />
        <Field label="To">
          <select value={to} onChange={(e) => setTo(e.target.value)} className={inputClass}>
            {purses.filter((p) => p.name !== from).map((p) => <option key={p.name} value={p.name}>{p.name} · {naira(p.balance)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Amount" hint={`Available in ${from}: ${naira(available)}`}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus className={inputClass} required />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="What is this for?" className={inputClass} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy || !to || !amount}>{busy ? 'Moving…' : 'Move money'}</Button>
    </form>
  )
}
