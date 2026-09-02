'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { AtSign, ChevronDown, Plus, X, Trash2, Check, Eye, Flag, Pencil } from 'lucide-react'
import { BottleContentsModal } from '@/components/ui/BottleContentsModal'
import { Scramble } from '@/components/ui/motion'

/**
 * Challenge — the bottle wall.
 * A bottle is a named accumulator ("Workout", "Reading"…) that fills up as
 * you pour amounts into it. Pours come from two places:
 *   1. Any reflection on the schedule — type @ + bottle + amount
 *      (e.g. "I did @Workout 400 press-ups"), and
 *   2. The quick-add on each bottle card below.
 */

interface BottleEntry {
  id: string
  amount: number
  note?: string | null
  sourceType?: string | null
  sourceRef?: string | null
  createdAt: string
}

interface Bottle {
  id: string
  name: string
  emoji?: string | null
  unit?: string | null
  target?: number | null
  challenge?: string | null
  challengeDue?: string | null
  total: number
  entryCount: number
  entries: BottleEntry[]
}

/** Captured once per module load — the chip is day-granularity, so it doesn't need per-render freshness. */
const NOW_MS = Date.now()

/** Deadline chip for a bottle's challenge — days left, due today, or overdue. */
function ChallengeDue({ challengeDue }: { challengeDue: string }) {
  const due = new Date(challengeDue)
  if (isNaN(due.getTime())) return null
  const daysLeft = Math.ceil((due.getTime() - NOW_MS) / 86400000)
  const label =
    daysLeft > 1 ? `${daysLeft}d left`
    : daysLeft === 1 ? 'due tomorrow'
    : daysLeft === 0 ? 'due today'
    : `${Math.abs(daysLeft)}d overdue`
  return (
    <p className={`mt-1 font-mono text-[10px] ${daysLeft >= 0 ? 'text-gold/80' : 'text-[#e0a093]'}`}>
      due {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {label}
    </p>
  )
}

export default function ChallengePage() {
  const { showToast, confirm } = useToast()
  const [loading, setLoading] = useState(true)
  const [bottles, setBottles] = useState<Bottle[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [quickAmount, setQuickAmount] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [challengeEditId, setChallengeEditId] = useState<string | null>(null)
  const [challengeText, setChallengeText] = useState('')
  const [challengeDue, setChallengeDue] = useState('')
  const [targetEditId, setTargetEditId] = useState<string | null>(null)
  const [targetDraft, setTargetDraft] = useState('')

  const fetchBottles = useCallback(async () => {
    try {
      const res = await fetch('/api/bottles')
      if (res.ok) {
        const data = await res.json()
        setBottles(data.bottles || [])
      }
    } catch (e) {
      console.error('Failed to fetch bottles', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load — deferred to a timer callback so state updates happen in an
  // async continuation, not synchronously within the effect body
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(fetchBottles, 0)
    return () => clearTimeout(t)
  }, [fetchBottles])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) {
      showToast('Give the bottle a name', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          emoji: newEmoji.trim() || undefined,
          unit: newUnit.trim() || undefined,
          target: newTarget.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`Bottle "${name}" created`, 'success')
        setNewName(''); setNewEmoji(''); setNewUnit(''); setNewTarget('')
        setShowCreate(false)
        fetchBottles()
      } else {
        showToast(data.error || 'Failed to create bottle', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleQuickAdd = async (bottle: Bottle) => {
    const raw = (quickAmount[bottle.id] || '').trim()
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount === 0) {
      showToast('Enter an amount to pour', 'error')
      return
    }
    try {
      const res = await fetch('/api/bottles/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bottleId: bottle.id,
          amount,
          sourceType: 'manual',
          sourceRef: 'challenge-page',
        }),
      })
      if (res.ok) {
        const sign = amount > 0 ? '+' : ''
        showToast(`${sign}${amount} → ${bottle.emoji ? bottle.emoji + ' ' : ''}${bottle.name} bottle`, 'success')
        setQuickAmount(prev => ({ ...prev, [bottle.id]: '' }))
        fetchBottles()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to add', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  const handleDeleteEntry = async (bottleId: string, entryId: string) => {
    const ok = await confirm('Remove this pour from the bottle?')
    if (!ok) return
    try {
      const res = await fetch(`/api/bottles/entries/${entryId}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Pour removed', 'success')
        fetchBottles()
      } else {
        showToast('Failed to remove', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  const handleDeleteBottle = async (bottle: Bottle) => {
    const ok = await confirm(`Delete the "${bottle.name}" bottle? Its ${bottle.entryCount} pours are removed with it.`)
    if (!ok) return
    try {
      const res = await fetch(`/api/bottles/${bottle.id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Bottle deleted', 'success')
        if (expandedId === bottle.id) setExpandedId(null)
        fetchBottles()
      } else {
        showToast('Failed to delete bottle', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  // ── Challenge attached to a bottle ──
  const openChallengeEditor = (bottle: Bottle) => {
    setChallengeEditId(bottle.id)
    setChallengeText(bottle.challenge || '')
    setChallengeDue(bottle.challengeDue ? bottle.challengeDue.slice(0, 10) : '')
  }

  const handleSaveChallenge = async (bottle: Bottle) => {
    const challenge = challengeText.trim() || null
    const due = challengeDue || null
    try {
      const res = await fetch(`/api/bottles/${bottle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, challengeDue: due }),
      })
      if (res.ok) {
        // Optimistic local update — the card reflects it instantly, no refetch
        setBottles(prev => prev.map(b => (b.id === bottle.id ? { ...b, challenge, challengeDue: due } : b)))
        showToast(challenge ? 'Challenge set — now go fill it' : 'Challenge cleared', 'success')
        setChallengeEditId(null)
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to save challenge', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  const openTargetEditor = (bottle: Bottle) => {
    setTargetEditId(bottle.id)
    setTargetDraft(bottle.target != null ? String(bottle.target) : '')
  }

  const handleSaveTarget = async (bottle: Bottle) => {
    const raw = targetDraft.trim()
    let target: number | null = null
    if (raw !== '') {
      const parsed = Number(raw)
      if (!Number.isFinite(parsed) || parsed < 0) {
        showToast('Target must be a positive number (or empty to clear)', 'error')
        return
      }
      target = parsed
    }
    try {
      const res = await fetch(`/api/bottles/${bottle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      })
      if (res.ok) {
        // Optimistic local update — instant, no reload
        setBottles(prev => prev.map(b => (b.id === bottle.id ? { ...b, target } : b)))
        showToast(target != null ? `Target set to ${target.toLocaleString()}` : 'Target cleared', 'success')
        setTargetEditId(null)
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to save target', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  if (loading) return <Loader routeKey="challenge" />

  const grandTotal = bottles.reduce((s, b) => s + b.total, 0)

  return (
    <div className="max-w-[720px] mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-parchment"><Scramble text="Challenge" mono={false} /></h1>
          <p className="mt-1 font-mono text-xs text-parchment/50">
            Fill the bottles · {bottles.length} bottle{bottles.length === 1 ? '' : 's'} · {grandTotal.toLocaleString()} poured
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          data-cursor="Start a new bottle"
          className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#cbaa6f] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          <span>New Bottle</span>
        </button>
      </div>

      {/* How it works */}
      <Card className="border-gold-dim/25 bg-gold/[0.04]">
        <div className="flex items-start gap-3">
          <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
          <div className="min-w-0 text-sm text-parchment/70">
            <p className="font-medium text-parchment/85">Call a bottle from any reflection</p>
            <p className="mt-1 leading-relaxed">
              In a day reflection or a deed&rsquo;s reflection, type <span className="font-mono text-gold">@</span> to summon the
              bottle list, pick one, then type the amount —{' '}
              <span className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12px] text-gold">I did @Workout 400 press-ups</span>{' '}
              pours 400 into the Workout bottle.{' '}
              <span className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[12px] text-gold">@Workout -100</span>{' '}
              deducts 100. The text is the law: delete the mention (or change the number) and the bottle updates instantly.
            </p>
          </div>
        </div>
      </Card>

      {/* Create form */}
      {showCreate && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-parchment/50">New bottle</p>
            <button onClick={() => setShowCreate(false)} className="p-1 rounded-md text-parchment/45 hover:text-parchment transition" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[64px_1fr_1fr_1fr] gap-2">
            <input
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              placeholder="🏋️"
              maxLength={4}
              className="rounded-md border hairline bg-transparent px-3 py-2 text-center text-lg"
              aria-label="Emoji"
            />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Name — e.g. Workout"
              className="rounded-md border hairline bg-transparent px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold focus:outline-none"
              aria-label="Bottle name"
            />
            <input
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              placeholder="Unit — e.g. press-ups"
              className="rounded-md border hairline bg-transparent px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold focus:outline-none"
              aria-label="Unit"
            />
            <input
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              inputMode="decimal"
              placeholder="Target (optional)"
              className="rounded-md border hairline bg-transparent px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold focus:outline-none"
              aria-label="Target amount"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-[#cbaa6f] transition-colors disabled:opacity-60"
          >
            <Check className="w-4 h-4" strokeWidth={1.5} />
            <span>{saving ? 'Creating…' : 'Create Bottle'}</span>
          </button>
          <p className="font-mono text-[11px] text-parchment/40">
            Reference it as <span className="text-gold">@{newName.trim() || 'Name'}</span> from any reflection.
          </p>
        </Card>
      )}
{/* Bottle wall */}
      {bottles.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl opacity-70">🫙</span>
          <p className="text-sm font-medium text-parchment/70">No bottles yet</p>
          <p className="max-w-xs font-mono text-[11px] leading-relaxed text-parchment/40">
            Start one above, or type <span className="text-gold">@Name amount</span> straight into a
            reflection — e.g. <span className="text-gold">I did @Workout 400 press-ups</span>.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bottles.map(bottle => {
            const pct = bottle.target && bottle.target > 0 ? Math.min(100, Math.round((bottle.total / bottle.target) * 100)) : null
            const expanded = expandedId === bottle.id
            return (
              <Card key={bottle.id} className="flex flex-col gap-3">
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewingId(bottle.id)}
                    title="See everything in this bottle"
                    data-cursor="Open the bottle"
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gold-dim/30 bg-gold/10 text-2xl transition hover:border-gold/60"
                  >
                    {bottle.emoji || '🫙'}
                  </button>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => setViewingId(bottle.id)}
                    title="See everything in this bottle"
                  >
                    <p className="truncate text-sm font-bold text-parchment">@{bottle.name}</p>
                    <p className="font-mono text-[11px] text-parchment/45">
                      {bottle.total.toLocaleString()}{bottle.unit ? ` ${bottle.unit}` : ''}
                      {bottle.target ? ` / ${bottle.target.toLocaleString()}${bottle.unit ? ` ${bottle.unit}` : ''}` : ''}
                    </p>
                  </div>
                  <ChevronDown
                    onClick={() => setExpandedId(expanded ? null : bottle.id)}
                    className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-180 text-gold' : 'text-parchment/40'}`}
                  />
                </div>

                {/* Progress vs target */}
                {pct !== null && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-parchment/50">
                      <span>{pct}% full</span>
                      {pct >= 100 ? <span className="text-sage">filled ✦</span> : <span>{Math.max(0, (bottle.target || 0) - bottle.total).toLocaleString()} to go</span>}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink/60">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-sage' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {/* Target box — editable number on each bottle card */}
                <div className="flex items-center gap-2">
                  {targetEditId === bottle.id ? (
                    <>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-parchment/45">Target</span>
                      <input
                        value={targetDraft}
                        onChange={e => setTargetDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveTarget(bottle) }}
                        autoFocus
                        inputMode="decimal"
                        placeholder="e.g. 10000"
                        className="w-24 rounded-md border border-ink/40 bg-ink/50 px-2 py-1 font-mono text-xs text-parchment placeholder:text-parchment/25 focus:border-gold focus:outline-none"
                        aria-label={`Target for ${bottle.name}`}
                      />
                      <button
                        onClick={() => handleSaveTarget(bottle)}
                        className="rounded-md bg-gold p-1 text-ink transition hover:bg-[#cbaa6f]"
                        title="Save target"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTargetEditId(null)}
                        className="rounded-md p-1 text-parchment/45 transition hover:bg-white/10 hover:text-parchment"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openTargetEditor(bottle)}
                      className="group/target flex items-center gap-1.5 rounded-md border border-dashed border-white/15 px-2 py-1 font-mono text-[10px] text-parchment/45 transition hover:border-gold/50 hover:text-parchment/70"
                      title={bottle.target != null ? 'Edit target' : 'Set a target'}
                    >
                      <span className="text-parchment/50">🎯</span>
                      <span>
                        {bottle.target != null
                          ? `Target: ${bottle.target.toLocaleString()}${bottle.unit ? ` ${bottle.unit}` : ''}`
                          : 'Set target'}
                      </span>
                      {bottle.target != null && (
                        <Pencil className="h-2.5 w-2.5 opacity-0 transition group-hover/target:opacity-100" />
                      )}
                    </button>
                  )}
                </div>

                {/* Challenge attached to this bottle */}
                {challengeEditId === bottle.id ? (
                  <div className="space-y-2 rounded-lg border border-gold/40 bg-gold/5 p-2.5">
                    <textarea
                      value={challengeText}
                      onChange={e => setChallengeText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveChallenge(bottle) }}
                      rows={2}
                      autoFocus
                      placeholder="e.g. Fill this to 10,000 before the month ends"
                      className="w-full resize-none rounded-md border border-ink/40 bg-ink/50 p-2 text-xs text-parchment placeholder:text-parchment/25 focus:border-gold focus:outline-none"
                      aria-label={`Challenge for ${bottle.name}`}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={challengeDue}
                        onChange={e => setChallengeDue(e.target.value)}
                        className="flex-1 rounded-md border border-ink/40 bg-ink/50 px-2 py-1.5 font-mono text-[11px] text-parchment/80 focus:border-gold focus:outline-none"
                        aria-label="Challenge due date"
                      />
                      <button
                        onClick={() => handleSaveChallenge(bottle)}
                        className="rounded-md bg-gold p-1.5 text-ink transition hover:bg-[#cbaa6f]"
                        title="Save challenge (Ctrl+Enter)"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setChallengeEditId(null)}
                        className="rounded-md p-1.5 text-parchment/45 transition hover:bg-white/10 hover:text-parchment"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : bottle.challenge ? (
                  <div className="group/chal flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/5 p-2.5">
                    <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-parchment/85">{bottle.challenge}</p>
                      {bottle.challengeDue && <ChallengeDue challengeDue={bottle.challengeDue} />}
                    </div>
                    <button
                      onClick={() => openChallengeEditor(bottle)}
                      className="shrink-0 rounded p-1 text-parchment/30 opacity-0 transition group-hover/chal:opacity-100 hover:bg-white/10 hover:text-gold"
                      title="Edit challenge"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openChallengeEditor(bottle)}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 p-2.5 text-left transition hover:border-gold/50 hover:bg-gold/5"
                  >
                    <Flag className="h-3.5 w-3.5 shrink-0 text-parchment/35" />
                    <span className="text-xs text-parchment/45">Add a challenge for this bottle…</span>
                  </button>
                )}

                {/* Quick pour */}
                <div className="flex items-center gap-2">
                  <input
                    value={quickAmount[bottle.id] || ''}
                    onChange={e => setQuickAmount(prev => ({ ...prev, [bottle.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(bottle) }}
                    inputMode="decimal"
                    placeholder={bottle.unit ? `Amount (${bottle.unit})` : 'Amount'}
                    className="min-w-0 flex-1 rounded-lg border border-ink/40 bg-ink/50 px-3 py-2 font-mono text-xs text-parchment placeholder:text-parchment/25 focus:border-gold focus:outline-none"
                    aria-label={`Pour amount for ${bottle.name}`}
                  />
                  <button
                    onClick={() => handleQuickAdd(bottle)}
                    disabled={saving}
                    className="shrink-0 rounded-lg bg-gold px-3.5 py-2 text-xs font-bold text-ink hover:bg-[#cbaa6f] transition disabled:opacity-60"
                  >
                    Pour
                  </button>
                </div>

{/* Entries + delete */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setExpandedId(expanded ? null : bottle.id)}
                    className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-parchment/45 transition hover:text-gold"
                    data-cursor="See the pour log"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    {bottle.entryCount} pour{bottle.entryCount === 1 ? '' : 's'}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setViewingId(bottle.id)}
                      className="rounded-md p-1.5 text-parchment/35 transition hover:bg-white/10 hover:text-gold"
                      title="See everything in this bottle"
                      data-cursor="Open the bottle"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBottle(bottle)}
                      className="rounded-md p-1.5 text-parchment/35 transition hover:bg-ember/15 hover:text-[#e0a093]"
                      title="Delete bottle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Entry log */}
                {expanded && bottle.entries.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border border-white/10 bg-ink/40 p-2">
                    {bottle.entries.map(entry => (
                      <div key={entry.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white/5">
                        <span className="shrink-0 font-mono font-bold text-gold tabular-nums">{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}</span>
                        <span className="min-w-0 flex-1 truncate text-parchment/60">{entry.note || (entry.sourceType === 'manual' ? 'Manual pour' : `From ${entry.sourceType}`)}</span>
                        <span className="shrink-0 font-mono text-[9px] text-parchment/30">
                          {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          onClick={() => handleDeleteEntry(bottle.id, entry.id)}
                          className="shrink-0 rounded p-1 text-parchment/30 transition hover:bg-ember/15 hover:text-[#e0a093]"
                          title="Remove pour"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {expanded && bottle.entries.length === 0 && (
                  <p className="rounded-lg border border-dashed border-white/10 px-3 py-2 font-mono text-[10px] text-parchment/30">
                    No pours yet — pour above or @mention from a reflection.
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* "What's in the bottle" — full contents view */}
      <BottleContentsModal bottleId={viewingId} onClose={() => setViewingId(null)} onChanged={fetchBottles} />
    </div>
  )
}