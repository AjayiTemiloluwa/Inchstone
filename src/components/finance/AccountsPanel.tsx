'use client'

import { useState } from 'react'
import { Archive, Pencil, Plus } from 'lucide-react'
import { Button, Panel, RowActions, inputClass } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'
import { Notice, PurseMark } from './ui'
import { api, naira } from './money'

export interface PurseData { id: string; name: string; icon: string; color: string; balance: number }

const PURSE_ICONS = ['👜', '🏦', '💰', '💳', '🐷', '📦', '🎯', '🌴', '🚗', '🏠', '📚', '✈️']

/** The places your money physically sits. Net worth is the sum of these; envelopes are funded by moving money between them. */
export function AccountsPanel({ purses, onChanged, onTransfer }: { purses: PurseData[]; onChanged: () => void; onTransfer: () => void }) {
  const { showToast, confirm } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('👜')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    const r = await api('POST', '/api/purses', { name, icon })
    if (!r.ok) { setError(r.error ?? 'Could not add that purse.'); return }
    showToast(`Purse "${name.trim()}" added`, 'success'); setName(''); setAdding(false); onChanged()
  }
  const rename = async (p: PurseData) => {
    setError(null)
    if (renameValue.trim() && renameValue.trim() !== p.name) {
      const r = await api('PUT', '/api/purses', { id: p.id, name: renameValue })
      if (!r.ok) { setError(r.error ?? 'Could not rename.'); return }
      onChanged()
    }
    setRenaming(null)
  }
  const archive = async (p: PurseData) => {
    if (!(await confirm(`Remove the purse "${p.name}"? Its history stays in your records.`))) return
    const r = await api('DELETE', '/api/purses', { id: p.id })
    if (!r.ok) { setError(r.error ?? 'Could not remove that purse.'); return }
    showToast(`"${p.name}" removed`, 'success'); onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {purses.map((p) => (
          <Panel key={p.id} className="flex items-center gap-3">
            <PurseMark name={p.name} color={p.color} />
            <div className="min-w-0 flex-1">
              {renaming === p.id ? (
                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={30} aria-label="Purse name"
                  onBlur={() => void rename(p)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null) }}
                  className={inputClass} />
              ) : (
                <p className="truncate text-sm font-semibold text-parchment">{p.icon} {p.name}</p>
              )}
              <p className="font-mono text-sm tabular-nums text-gold">{naira(p.balance)}</p>
            </div>
            {p.name !== 'Main' && renaming !== p.id && (
              <RowActions label={`${p.name} actions`} actions={[
                { label: 'Rename', icon: Pencil, onSelect: () => { setRenaming(p.id); setRenameValue(p.name) } },
                { label: 'Remove', icon: Archive, destructive: true, onSelect: () => { void archive(p) } },
              ]} />
            )}
          </Panel>
        ))}
      </div>
      {adding ? (
        <form onSubmit={add} className="flex flex-wrap items-stretch gap-2 animate-fadeIn">
          <select value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="Icon" className={`${inputClass} !w-20`}>{PURSE_ICONS.map((i) => <option key={i}>{i}</option>)}</select>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="e.g. Emergency, Trip fund" aria-label="New purse name" className={`${inputClass} min-w-0 flex-1`} />
          <Button type="submit" variant="primary" disabled={!name.trim()}>Add</Button>
          <Button type="button" variant="ghost" onClick={() => { setAdding(false); setError(null) }}>Cancel</Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" icon={Plus} onClick={() => setAdding(true)}>New purse</Button>
          <Button variant="ghost" onClick={onTransfer} disabled={purses.length < 2}>Move money between purses</Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
