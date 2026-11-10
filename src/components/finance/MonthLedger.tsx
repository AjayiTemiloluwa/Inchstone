'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { Badge, Panel, cx } from '@/components/ds'
import { api, naira } from './money'

export interface Reconciliation {
  rows: { name: string; opening: number; income: number; spent: number; transfersIn: number; transfersOut: number; closing: number }[]
  openingNetWorth: number
  closingNetWorth: number
  reconciles: boolean
}

interface Entry { id: string; type: string; amount: number; category: string; description: string | null; purse: string; entryDate: string; allocationId: string | null; createdAt: string }

/** Every entry of the month in order with a running balance, framed by the opening and closing balance, plus the per-purse proof. */
export function MonthLedger({ month, recon, income, spent, refreshKey }: { month: string; recon: Reconciliation; income: number; spent: number; refreshKey: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    let live = true
    const [y, m] = month.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
    const end = new Date(Date.UTC(y, m, 1) - 1).toISOString()
    void api('GET', `/api/financial?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&limit=1000`).then((r) => {
      if (live && r.ok) setEntries(((r.data?.entries as Entry[]) ?? []).slice().sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt)))
    })
    return () => { live = false }
  }, [month, refreshKey])

  // Transfers move money between purses, so they never change the running net worth; only income and spending do.
  let running = recon.openingNetWorth
  const lines = (entries ?? []).filter((e) => e.type !== 'transfer_in').map((e) => {
    if (e.type === 'income') running += e.amount
    else if (e.type === 'expense') running -= e.amount
    return { e, balance: running }
  })

  const th = 'px-2 py-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-parchment/55'
  const td = 'px-2 py-2 text-right font-mono text-xs tabular-nums text-parchment/85'

  return (
    <div className="space-y-4">
      <Panel className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-parchment">
            {recon.reconciles ? <ShieldCheck className="h-4 w-4 text-moss" aria-hidden /> : <TriangleAlert className="h-4 w-4 text-ember" aria-hidden />}
            {recon.reconciles ? 'Every sum is accounted for' : 'These figures do not reconcile'}
          </p>
          <Badge tone={recon.reconciles ? 'moss' : 'ember'}>{naira(recon.openingNetWorth)} + {naira(income)} − {naira(spent)} = {naira(recon.closingNetWorth)}</Badge>
        </div>
        <div className="-mx-1 overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[34rem] border-collapse">
            <thead>
              <tr className="border-b border-gold/10">
                <th scope="col" className={cx(th, 'text-left')}>Purse</th>
                <th scope="col" className={th}>Opening</th>
                <th scope="col" className={th}>Income</th>
                <th scope="col" className={th}>Spent</th>
                <th scope="col" className={th}>Moved in</th>
                <th scope="col" className={th}>Moved out</th>
                <th scope="col" className={th}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {recon.rows.map((r) => (
                <tr key={r.name} className="border-b border-gold/5">
                  <th scope="row" className="px-2 py-2 text-left text-sm font-medium text-parchment">{r.name}</th>
                  <td className={td}>{naira(r.opening)}</td>
                  <td className={cx(td, 'text-moss')}>{r.income ? `+${naira(r.income)}` : '–'}</td>
                  <td className={td}>{r.spent ? `-${naira(r.spent)}` : '–'}</td>
                  <td className={td}>{r.transfersIn ? naira(r.transfersIn) : '–'}</td>
                  <td className={td}>{r.transfersOut ? naira(r.transfersOut) : '–'}</td>
                  <td className={cx(td, 'font-semibold text-gold')}>{naira(r.closing)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-2 py-2 text-left text-sm font-semibold text-parchment">Total</th>
                <td className={td}>{naira(recon.openingNetWorth)}</td>
                <td className={cx(td, 'text-moss')}>+{naira(income)}</td>
                <td className={td}>-{naira(spent)}</td>
                <td className={td} colSpan={2}>moves cancel out</td>
                <td className={cx(td, 'font-semibold text-gold')}>{naira(recon.closingNetWorth)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel padded={false} className="overflow-hidden">
        <ul className="divide-y divide-gold/10">
          <li className="flex items-center justify-between gap-3 bg-gold/[0.04] px-4 py-2.5 text-caption text-parchment/70"><span>Opening balance</span><span className="font-mono tabular-nums">{naira(recon.openingNetWorth)}</span></li>
          {entries === null && <li className="px-4 py-3 text-caption text-parchment/55">Loading the month…</li>}
          {entries !== null && lines.length === 0 && <li className="px-4 py-3 text-caption text-parchment/55">Nothing was recorded this month.</li>}
          {lines.map(({ e, balance }) => {
            const isTransfer = e.type === 'transfer_out'
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-parchment/55">{new Date(e.entryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-parchment">{e.allocationId || isTransfer ? (e.description ?? 'Transfer') : e.category}</span>
                  <span className="block text-caption text-parchment/55">{e.purse}{isTransfer ? ' · between your purses' : ''}</span>
                </span>
                <span className={cx('shrink-0 font-mono text-sm tabular-nums', e.type === 'income' ? 'text-moss' : 'text-parchment')}>{isTransfer ? naira(e.amount) : `${e.type === 'income' ? '+' : '-'}${naira(e.amount)}`}</span>
                <span className="hidden w-28 shrink-0 text-right font-mono text-xs tabular-nums text-parchment/60 sm:block" title="Running balance">{isTransfer ? '' : naira(balance)}</span>
              </li>
            )
          })}
          <li className="flex items-center justify-between gap-3 bg-gold/[0.04] px-4 py-2.5 text-caption font-semibold text-parchment"><span>Closing balance</span><span className="font-mono tabular-nums text-gold">{naira(recon.closingNetWorth)}</span></li>
        </ul>
      </Panel>
    </div>
  )
}
