'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

/**
 * BottleMentionTextarea — a drop-in <textarea> replacement that understands
 * Challenge-Bottle @-mentions.
 *
 *   • Typing "@" opens a dropdown of every bottle; keep typing to filter,
 *     ↑/↓ + Enter (or click) to pick, and a new bottle can be minted inline.
 *   • A sentence like "I did @Workout 400 press-ups" pours 400 into the
 *     Workout bottle; "@Workout -100" deducts 100. The reflection text is the
 *     source of truth — deleting a mention (or changing its amount) removes
 *     or updates the pour automatically via a server-side reconcile, so the
 *     bottle always matches what the text currently says.
 */

export interface BottleSummary {
  id: string
  name: string
  emoji?: string | null
  unit?: string | null
  target?: number | null
  total?: number
  entryCount?: number
}

interface MentionState {
  start: number // index of the '@'
  query: string // text typed after the '@'
}

interface BottleMentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  rows?: number
  /** Identifies the reflection (e.g. "day-2026-09-01", "deed-<id>") — part of the dedupe key. */
  sourceRef?: string
  /** Show the subtle "@bottle amount" hint under the field. */
  showHint?: boolean
  onLogged?: (info: { bottleName: string; amount: number }) => void
}

const IDLE_MS = 1600

export function BottleMentionTextarea({
  value,
  onChange,
  placeholder,
  className = '',
  id,
  rows,
  sourceRef = 'reflection',
  showHint = true,
  onLogged,
}: BottleMentionTextareaProps) {
  const { showToast } = useToast()
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const bottlesRef = useRef<BottleSummary[]>([])
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pouringRef = useRef(false)
  const lastValueRef = useRef(value)
  const reconcileRef = useRef<(v: string) => void>(() => undefined)
  const touchedRef = useRef(false)

  const [bottles, setBottles] = useState<BottleSummary[]>([])
  const [mention, setMention] = useState<MentionState | null>(null)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    bottlesRef.current = bottles
  }, [bottles])

  const refreshBottles = useCallback(async () => {
    try {
      const res = await fetch('/api/bottles')
      if (!res.ok) return
      const data = await res.json()
      const list: BottleSummary[] = data.bottles || []
      bottlesRef.current = list
      setBottles(list)
    } catch {
      // dropdown simply shows nothing new — non-fatal
    }
  }, [])

  useEffect(() => {
    // Deferred so the state update lands in an async continuation, not the
    // effect body (avoids cascading-render lint error).
    const t = setTimeout(refreshBottles, 0)
    return () => clearTimeout(t)
  }, [refreshBottles])

  /* ── Mention detection ─────────────────────────────────────────────── */

  const detectMention = useCallback((text: string, caret: number): MentionState | null => {
    const before = text.slice(0, caret)
    const m = before.match(/(?:^|\s)@([^\s@]*)$/)
    if (!m) return null
    return { start: caret - m[1].length - 1, query: m[1] }
  }, [])

  const syncMention = useCallback(() => {
    const el = areaRef.current
    if (!el) return
    const found = detectMention(el.value, el.selectionStart ?? el.value.length)
    setMention(found)
    setHighlight(0)
  }, [detectMention])

  /* ── Dropdown options ──────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = (mention?.query || '').trim().toLowerCase()
    const list = bottles.filter(b => b.name.toLowerCase().includes(q))
    return list.slice(0, 8)
  }, [bottles, mention])

  const exactMatch = useMemo(() => {
    const q = (mention?.query || '').trim().toLowerCase()
    return bottles.some(b => b.name.toLowerCase() === q)
  }, [bottles, mention])

  const canCreate = Boolean(
    mention && mention.query.trim().length > 0 && mention.query.trim().length <= 24 && !exactMatch,
  )
  const optionCount = filtered.length + (canCreate ? 1 : 0)

  /* ── Inserting a selection ─────────────────────────────────────────── */

  const insertBottle = useCallback((name: string, create = false) => {
    const el = areaRef.current
    const state = mention
    if (!el || !state) return
    const before = el.value.slice(0, state.start)
    const after = el.value.slice(el.selectionStart ?? el.value.length)
    const next = `${before}@${name} ${after}`
    onChange(next)
    setMention(null)

    if (create) {
      // Mint the bottle immediately so the amount typed next has a home.
      fetch('/api/bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
        .then(async r => {
          const data = await r.json().catch(() => null)
          if (r.ok) {
            showToast(`New bottle "${name}" created — now type the amount`, 'success')
            await refreshBottles()
          } else if (r.status === 409) {
            // It already exists (created moments ago elsewhere) — just resync.
            await refreshBottles()
          } else {
            showToast((data && data.error) || 'Could not create the bottle', 'error')
          }
        })
        .catch(() => showToast('Could not create the bottle', 'error'))
    }

    requestAnimationFrame(() => {
      el.focus()
      const pos = before.length + name.length + 2
      el.setSelectionRange(pos, pos)
      setMention(detectMention(el.value, pos))
    })
  }, [mention, onChange, refreshBottles, detectMention, showToast])

  /* ── Syncing pours to the text ────────────────────────────────────── */
  // Every pour is a deduction-keyed entry. Reconcile makes the bottle match
  // the CURRENT text exactly: new mentions get poured, mentions that were
  // deleted (or their amount changed) are removed server-side. Editing or
  // deleting the text is therefore enough — no manual removal needed.

  const reconcileFromText = useCallback(async (text: string) => {
    if (pouringRef.current) return
    pouringRef.current = true
    try {
      const res = await fetch('/api/bottles/entries/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceRef, text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        showToast((data && data.error) || 'Could not sync bottle pours — try again', 'error')
        return
      }
      const data = await res.json()
      const added: Array<{ name: string; amount: number }> = data.added || []
      const removed: Array<{ name: string; amount: number }> = data.removed || []

      for (const pour of added) {
        const known = bottlesRef.current.find(b => b.name.toLowerCase() === pour.name.toLowerCase())
        const sign = pour.amount > 0 ? '+' : ''
        showToast(
          known
            ? `${sign}${pour.amount} → ${known.emoji ? known.emoji + ' ' : ''}${known.name} bottle`
            : `New bottle "${pour.name}" ${sign}${pour.amount}`,
          'success',
        )
        onLogged?.({ bottleName: pour.name, amount: pour.amount })
      }
      for (const pour of removed) {
        showToast(`Removed ${Math.abs(pour.amount)} from ${pour.name} bottle`, 'success')
      }
      if (added.length > 0 || removed.length > 0) refreshBottles()
    } finally {
      pouringRef.current = false
    }
  }, [sourceRef, showToast, onLogged, refreshBottles])

  const schedulePour = useCallback((text: string) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      void reconcileFromText(text)
    }, IDLE_MS)
  }, [reconcileFromText])

  // Keep the latest value + reconcile fn handy for the unmount sync.
  useEffect(() => {
    lastValueRef.current = value
    reconcileRef.current = reconcileFromText
  }, [value, reconcileFromText])

  // When the reflection's text loads (from the DB) or is otherwise set
  // programmatically while the field is NOT being typed in, sync pours to it:
  // retries pours that failed earlier and removes entries whose mention text
  // no longer exists. Skipped while the user is actively typing (that flow is
  // handled by the idle timer / blur) and for empty text.
  useEffect(() => {
    if (document.activeElement === areaRef.current) return
    if (!value.includes('@')) return
    const t = setTimeout(() => void reconcileFromText(value), 0)
    return () => clearTimeout(t)
  }, [value, sourceRef, reconcileFromText])

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    // Final sync before leaving: if the user edited this field (including
    // erasing a mention entirely), make sure pours match the last text — e.g.
    // they deleted "@Bottle 400" and navigated away without blurring.
    if (touchedRef.current) reconcileRef.current(lastValueRef.current)
  }, [])

  /* ── Event wiring ──────────────────────────────────────────────────── */

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    touchedRef.current = true
    onChange(next)
    const found = detectMention(next, e.target.selectionStart ?? next.length)
    setMention(found)
    setHighlight(0)
    schedulePour(next)
  }, [onChange, detectMention, schedulePour])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention || optionCount === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % optionCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h - 1 + optionCount) % optionCount)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (highlight < filtered.length) {
        insertBottle(filtered[highlight].name)
      } else if (canCreate) {
        insertBottle(mention.query.trim(), true)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMention(null)
    }
  }, [mention, optionCount, highlight, filtered, canCreate, insertBottle])

  const handleBlur = useCallback(() => {
    // Let option clicks land before closing (options use onMouseDown).
    setTimeout(() => setMention(null), 120)
    void reconcileFromText(areaRef.current?.value ?? value)
  }, [reconcileFromText, value])

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="relative">
      <textarea
        ref={areaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onKeyUp={syncMention}
        onClick={syncMention}
        onFocus={syncMention}
        placeholder={placeholder}
        className={className}
      />

      {mention && (optionCount > 0 || filtered.length === 0) && (
        <div
          className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-56 overflow-y-auto rounded-xl border border-mist bg-paper p-1.5 shadow-lg animate-fadeIn"
          role="listbox"
          aria-label="Challenge bottles"
        >
          {filtered.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseDown={e => { e.preventDefault(); insertBottle(b.name) }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                i === highlight ? 'bg-gold/15 text-gold' : 'text-ink hover:bg-mist'
              }`}
            >
              <span className="w-5 text-center text-base leading-none">{b.emoji || '🫙'}</span>
              <span className="min-w-0 flex-1 truncate font-medium">@{b.name}</span>
              {typeof b.total === 'number' && (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink/45">
                  {b.total}{b.unit ? ` ${b.unit}` : ''}
                </span>
              )}
            </button>
          ))}
          {canCreate && mention && (
            <button
              type="button"
              role="option"
              aria-selected={highlight === filtered.length}
              onMouseDown={e => { e.preventDefault(); insertBottle(mention.query.trim(), true) }}
              onMouseEnter={() => setHighlight(filtered.length)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                highlight === filtered.length ? 'bg-gold/15 text-gold' : 'text-ink/70 hover:bg-mist'
              }`}
            >
              <Plus className="h-4 w-4 shrink-0 text-gold" />
              <span className="min-w-0 flex-1 truncate">
                Create bottle <span className="font-semibold">@{mention.query.trim()}</span>
              </span>
            </button>
          )}
          <p className="px-3 pb-1 pt-1.5 font-mono text-[10px] text-ink/35">
            Pick a bottle, then type the amount — e.g. @Workout 400
          </p>
        </div>
      )}

      {showHint && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-ink/40">
          <AtSign className="h-3 w-3 text-gold-dim" />
          Type <span className="mx-0.5 font-mono text-gold-dim">@bottle amount</span> to fill a challenge bottle — e.g. @Workout 400
        </p>
      )}
    </div>
  )
}
