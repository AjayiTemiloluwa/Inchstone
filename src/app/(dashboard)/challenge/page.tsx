'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { AtSign, ChevronDown, Plus, X, Trash2, Check, Eye, Flag, Pencil, Target } from 'lucide-react'
import { BottleContentsModal } from '@/components/ui/BottleContentsModal'
import {
  Badge, Button, EmptyState, Field, IconButton, Page, PageHeader, Panel, RowActions, Section, Stat, StatGrid, cx, inputClass,
} from '@/components/ds'

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
    <Badge tone={daysLeft >= 0 ? 'gold' : 'ember'} className="mt-2">
      due {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {label}
    </Badge>
  )
}

/**
 * The bottle itself as an instrument: a vessel whose liquid level is the
 * fill against target. No target = an empty, dashed vessel (nothing to fill
 * against). The user's own emoji, if they gave one, sits on the glass.
 */
function BottleGauge({ pct, emoji }: { pct: number | null; emoji?: string | null }) {
  const level = pct ?? 0
  const full = level >= 100
  return (
    <span className="relative flex h-[4.5rem] w-12 shrink-0 flex-col items-center">
      <span aria-hidden="true" className={cx('h-2 w-5 rounded-t-sm border border-b-0', pct === null ? 'border-dashed border-gold/25' : 'border-gold/35')} />
      <span aria-hidden="true" className={cx(
        'relative w-full flex-1 overflow-hidden rounded-lg border bg-ink/30',
        pct === null ? 'border-dashed border-gold/25' : 'border-gold/35',
      )}>
        <span className={cx('absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out motion-reduce:transition-none', full ? 'bg-moss/60' : 'bg-gold/45')}
          style={{ height: `${level}%` }} />
        {[25, 50, 75].map(t => (
          <span key={t} className="absolute right-0 h-px w-2 bg-gold/25" style={{ bottom: `${t}%` }} />
        ))}
      </span>
      {emoji && <span className="absolute inset-x-0 top-1/2 -translate-y-1/4 text-center text-lg leading-none">{emoji}</span>}
    </span>
  )
}

const smallInput = 'h-11 rounded-lg border border-gold/20 bg-ink/40 px-3 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20 pointer-fine:h-9'

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
  const filledCount = bottles.filter(b => b.target && b.target > 0 && b.total >= b.target).length
  const challengeCount = bottles.filter(b => b.challenge).length

  return (
    <Page>
      <PageHeader
        eyebrow="Fill the bottles"
        title="Challenge"
        description="Name a bottle, set a target, and pour into it from here or from any reflection."
        actions={
          <Button variant="primary" icon={showCreate ? X : Plus} onClick={() => setShowCreate(v => !v)} data-cursor="Start a new bottle">
            {showCreate ? 'Close' : 'New Bottle'}
          </Button>
        }
      />

      <StatGrid cols={3}>
        <Stat label="Bottles" value={bottles.length} caption={`${filledCount} filled to target`} />
        <Stat label="Poured" value={grandTotal.toLocaleString()} tone="gold" caption="across every bottle" />
        <Stat label="Challenges" value={challengeCount} caption="bottles with a challenge set" className="col-span-2 sm:col-span-1" />
      </StatGrid>

      {/* Create form */}
      {showCreate && (
        <Section title="New bottle">
          <Panel className="space-y-5 animate-fadeIn">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Icon">
                <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="—" maxLength={4}
                  className={cx(inputClass, 'text-center text-lg')} aria-label="Emoji" />
              </Field>
              <Field label="Name">
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                  placeholder="e.g. Workout" className={inputClass} aria-label="Bottle name" />
              </Field>
              <div className="col-span-2 sm:col-span-1">
                <Field label="Unit">
                  <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="e.g. press-ups" className={inputClass} aria-label="Unit" />
                </Field>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Field label="Target" hint="Optional">
                  <input value={newTarget} onChange={e => setNewTarget(e.target.value)} inputMode="decimal" placeholder="e.g. 10000"
                    className={cx(inputClass, 'font-mono tabular-nums')} aria-label="Target amount" />
                </Field>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[11px] text-parchment/45">
                Reference it as <span className="text-gold">@{newName.trim() || 'Name'}</span> from any reflection.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowCreate(false)} aria-label="Cancel">Cancel</Button>
                <Button variant="secondary" icon={Check} onClick={handleCreate} disabled={saving}>
                  {saving ? 'Creating…' : 'Create Bottle'}
                </Button>
              </div>
            </div>
          </Panel>
        </Section>
      )}

      {/* Bottle wall */}
      <Section title="Bottles" id="bottles" action={<Badge>{bottles.length}</Badge>}>
        {bottles.length === 0 ? (
          <EmptyState
            title="No bottles yet"
            body={<>Start one with New Bottle, or type <span className="font-mono text-gold">@Name amount</span> straight into a reflection, e.g. <span className="font-mono text-gold">I did @Workout 400 press-ups</span>.</>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bottles.map(bottle => {
              const pct = bottle.target && bottle.target > 0 ? Math.min(100, Math.round((bottle.total / bottle.target) * 100)) : null
              const expanded = expandedId === bottle.id
              const unit = bottle.unit ? ` ${bottle.unit}` : ''
              return (
                <Panel key={bottle.id} className="group flex flex-col" padded={false}>
                  <div className="flex flex-col gap-4 p-4 sm:p-5">
                    {/* Instrument: vessel + level */}
                    <div className="flex items-start gap-4">
                      <button type="button" onClick={() => setViewingId(bottle.id)} title="See everything in this bottle" data-cursor="Open the bottle"
                        aria-label={`See everything in the ${bottle.name} bottle`}
                        className="shrink-0 rounded-lg p-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
                        <BottleGauge pct={pct} emoji={bottle.emoji} />
                      </button>
                      <div className="min-w-0 flex-1 cursor-pointer pt-1" onClick={() => setViewingId(bottle.id)} title="See everything in this bottle">
                        <p className="truncate text-sm font-semibold text-parchment">@{bottle.name}</p>
                        <p className={cx('mt-2 font-display text-[1.75rem] leading-none tabular-nums', pct !== null && pct >= 100 ? 'text-moss' : 'text-parchment')}>
                          {pct !== null ? `${pct}%` : bottle.total.toLocaleString()}
                        </p>
                        <p className="mt-1.5 truncate font-mono text-[11px] tabular-nums text-parchment/45">
                          {bottle.total.toLocaleString()}{unit}
                          {bottle.target ? ` / ${bottle.target.toLocaleString()}${unit}` : ''}
                        </p>
                        {pct !== null && (
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]">
                            {pct >= 100
                              ? <span className="text-moss">Filled</span>
                              : <span className="text-parchment/45">{Math.max(0, (bottle.target || 0) - bottle.total).toLocaleString()} to go</span>}
                          </p>
                        )}
                      </div>
                      <RowActions label={`Actions for ${bottle.name}`} actions={[
                        { label: 'Open bottle', icon: Eye, onSelect: () => setViewingId(bottle.id) },
                        { label: bottle.target != null ? 'Edit target' : 'Set a target', icon: Target, onSelect: () => openTargetEditor(bottle) },
                        { label: bottle.challenge ? 'Edit challenge' : 'Add a challenge', icon: Flag, onSelect: () => openChallengeEditor(bottle) },
                        { label: 'Delete bottle', icon: Trash2, destructive: true, onSelect: () => { void handleDeleteBottle(bottle) } },
                      ]} />
                    </div>

                    {/* Target — editable number on each bottle card */}
                    <div className="flex min-h-9 items-center gap-2">
                      {targetEditId === bottle.id ? (
                        <>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45">Target</span>
                          <input value={targetDraft} onChange={e => setTargetDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveTarget(bottle) }}
                            autoFocus inputMode="decimal" placeholder="e.g. 10000"
                            className={cx(smallInput, 'w-28 min-w-0 font-mono tabular-nums')} aria-label={`Target for ${bottle.name}`} />
                          <IconButton icon={Check} label="Save target" onClick={() => handleSaveTarget(bottle)} />
                          <IconButton icon={X} label="Cancel" onClick={() => setTargetEditId(null)} />
                        </>
                      ) : (
                        <button type="button" onClick={() => openTargetEditor(bottle)} title={bottle.target != null ? 'Edit target' : 'Set a target'}
                          className="group/target inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-gold/20 px-2.5 font-mono text-[11px] tabular-nums text-parchment/50 transition-colors hover:border-gold/50 hover:text-parchment/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
                          <Target aria-hidden="true" className="h-3.5 w-3.5 text-gold-dim" strokeWidth={1.75} />
                          <span>{bottle.target != null ? `Target ${bottle.target.toLocaleString()}${unit}` : 'Set target'}</span>
                          {bottle.target != null && <Pencil aria-hidden="true" className="h-3 w-3 opacity-0 transition-opacity group-hover/target:opacity-100" />}
                        </button>
                      )}
                    </div>

                    {/* Challenge attached to this bottle */}
                    {challengeEditId === bottle.id ? (
                      <div className="space-y-2 rounded-lg border border-gold/30 p-3">
                        <textarea value={challengeText} onChange={e => setChallengeText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveChallenge(bottle) }}
                          rows={2} autoFocus placeholder="e.g. Fill this to 10,000 before the month ends"
                          className="w-full resize-none rounded-lg border border-gold/20 bg-ink/40 p-2.5 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20"
                          aria-label={`Challenge for ${bottle.name}`} />
                        <div className="flex items-center gap-2">
                          <input type="date" value={challengeDue} onChange={e => setChallengeDue(e.target.value)}
                            className={cx(smallInput, 'min-w-0 flex-1 font-mono text-xs')} aria-label="Challenge due date" />
                          <IconButton icon={Check} label="Save challenge (Ctrl+Enter)" onClick={() => handleSaveChallenge(bottle)} />
                          <IconButton icon={X} label="Cancel" onClick={() => setChallengeEditId(null)} />
                        </div>
                      </div>
                    ) : bottle.challenge ? (
                      <div className="group/chal flex items-start gap-2.5 rounded-lg border border-gold/20 p-3">
                        <Flag aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-relaxed text-parchment/85">{bottle.challenge}</p>
                          {bottle.challengeDue && <ChallengeDue challengeDue={bottle.challengeDue} />}
                        </div>
                        <IconButton icon={Pencil} label="Edit challenge" onClick={() => openChallengeEditor(bottle)}
                          className="-my-1.5 -mr-1.5 can-hover:opacity-0 can-hover:group-hover/chal:opacity-100 focus-visible:opacity-100" />
                      </div>
                    ) : (
                      <button type="button" onClick={() => openChallengeEditor(bottle)}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-gold/20 px-3 text-left transition-colors hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
                        <Flag aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-parchment/35" strokeWidth={1.75} />
                        <span className="text-sm text-parchment/45">Add a challenge for this bottle…</span>
                      </button>
                    )}

                    {/* Quick pour */}
                    <div className="flex items-center gap-2">
                      <input value={quickAmount[bottle.id] || ''}
                        onChange={e => setQuickAmount(prev => ({ ...prev, [bottle.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(bottle) }}
                        inputMode="decimal" placeholder={bottle.unit ? `Amount (${bottle.unit})` : 'Amount'}
                        className={cx(inputClass, 'min-w-0 flex-1 font-mono tabular-nums')} aria-label={`Pour amount for ${bottle.name}`} />
                      <Button variant="secondary" onClick={() => handleQuickAdd(bottle)} disabled={saving}>Pour</Button>
                    </div>
                  </div>

                  {/* Pour log */}
                  <div className="border-t border-gold/10 px-4 pb-3 sm:px-5">
                    <button type="button" onClick={() => setExpandedId(expanded ? null : bottle.id)} aria-expanded={expanded}
                      data-cursor="See the pour log"
                      className="flex min-h-11 w-full items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45 transition-colors hover:text-gold focus-visible:outline-none focus-visible:text-gold">
                      <ChevronDown aria-hidden="true" className={cx('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
                      <span className="tabular-nums">{bottle.entryCount} pour{bottle.entryCount === 1 ? '' : 's'}</span>
                    </button>

                    {expanded && bottle.entries.length > 0 && (
                      <ul className="space-y-0.5 animate-fadeIn">
                        {bottle.entries.map(entry => (
                          <li key={entry.id} className="flex items-center gap-3 rounded-lg px-2 py-1 text-sm hover:bg-gold/[0.04]">
                            <span className="w-16 shrink-0 font-mono text-xs font-semibold tabular-nums text-gold">{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}</span>
                            <span className="min-w-0 flex-1 truncate text-parchment/60">{entry.note || (entry.sourceType === 'manual' ? 'Manual pour' : `From ${entry.sourceType}`)}</span>
                            <span className="shrink-0 font-mono text-[10px] tabular-nums text-parchment/35">
                              {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <IconButton icon={X} label="Remove pour" tone="danger" onClick={() => handleDeleteEntry(bottle.id, entry.id)} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {expanded && bottle.entries.length === 0 && (
                      <p className="pb-1 font-mono text-[11px] text-parchment/40">
                        No pours yet — pour above or @mention from a reflection.
                      </p>
                    )}
                  </div>
                </Panel>
              )
            })}
          </div>
        )}
      </Section>

      {/* How it works */}
      <Section title="How pouring works">
        <Panel className="flex items-start gap-3">
          <AtSign aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.75} />
          <div className="min-w-0 space-y-1 text-body text-parchment/70">
            <p className="font-medium text-parchment/90">Call a bottle from any reflection</p>
            <p className="leading-relaxed">
              In a day reflection or a deed&rsquo;s reflection, type <span className="font-mono text-gold">@</span> to summon the
              bottle list, pick one, then type the amount —{' '}
              <span className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-mono text-gold">I did @Workout 400 press-ups</span>{' '}
              pours 400 into the Workout bottle.{' '}
              <span className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-mono text-gold">@Workout -100</span>{' '}
              deducts 100. The text is the law: delete the mention (or change the number) and the bottle updates instantly.
            </p>
          </div>
        </Panel>
      </Section>

      {/* "What's in the bottle" — full contents view */}
      <BottleContentsModal bottleId={viewingId} onClose={() => setViewingId(null)} onChanged={fetchBottles} />
    </Page>
  )
}
