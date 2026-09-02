'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/ToastProvider'
import { X, Search, Trash2 } from 'lucide-react'

interface Entry {
  id: string
  amount: number
  note?: string | null
  sourceType?: string | null
  sourceRef?: string | null
  createdAt: string
}

interface BottleInfo {
  id: string
  name: string
  emoji?: string | null
  unit?: string | null
  target?: number | null
}

interface Stats {
  total: number
  entryCount: number
  largestPour: number
  avgPour: number
  firstPourAt: string | null
  lastPourAt: string | null
  bySource: Record<string, number>
}

const sourceLabel = (e: Entry) =>
  e.note ||
  (e.sourceType === 'manual'
    ? 'Manual pour'
    : e.sourceType === 'reflection'
      ? 'From a reflection'
      : `From ${e.sourceType || 'pour'}`)

/**
 * BottleContentsModal — "open the bottle" view.
 * Fetches GET /api/bottles/[id] for the bottle, its FULL pour history (the
 * wall list is capped, this isn't), and summary stats. Supports search and
 * per-pour removal; day-grouped, newest first.
 */
export function BottleContentsModal({
  bottleId,
  onClose,
  onChanged,
}: {
  bottleId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { showToast, confirm } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [bottle, setBottle] = useState<BottleInfo | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [query, setQuery] = useState('')
  const [removing, setRemoving] = useState(false)

  // True while the first fetch for the open bottle is still in flight.
  const loading = !!bottleId && !bottle && !error

  const apply = useCallback(
    (data: { bottle: BottleInfo; entries: Entry[]; stats: Stats | null }) => {
      setBottle(data.bottle)
      setEntries(data.entries || [])
      setStats(data.stats || null)
      setError(null)
    },
    []
  )

  const fetchContents = useCallback(async (id: string) => {
    const res = await fetch(`/api/bottles/${id}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to open bottle')
    return data as { bottle: BottleInfo; entries: Entry[]; stats: Stats | null }
  }, [])

  // Refresh after a removal — event-handler driven, so sync setState is fine.
  const reload = useCallback(
    async (id: string) => {
      try {
        apply(await fetchContents(id))
      } catch {
        // keep showing the current contents if a refresh fails
      }
    },
    [apply, fetchContents]
  )

  // Reset search + stale contents whenever a different bottle is opened — done
  // at render time (the React-recommended adjustment) instead of in an effect.
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null)
  if (bottleId !== lastOpenedId) {
    setLastOpenedId(bottleId)
    setQuery('')
    if (bottleId) {
      setBottle(null)
      setEntries([])
      setStats(null)
      setError(null)
    }
  }

  // Initial load: state updates land inside the fetch callbacks (async
  // continuation), not synchronously in the effect body.
  useEffect(() => {
    if (!bottleId) return
    let cancelled = false
    fetchContents(bottleId)
      .then(data => {
        if (!cancelled) apply(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Network error')
      })
    return () => {
      cancelled = true
    }
  }, [bottleId, fetchContents, apply])

  // Esc to close + scroll lock while open
  useEffect(() => {
    if (!bottleId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [bottleId, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      e =>
        (e.note || '').toLowerCase().includes(q) ||
        String(e.amount).includes(q) ||
        (e.sourceType || '').toLowerCase().includes(q)
    )
  }, [entries, query])

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>()
    filtered.forEach(e => {
      const label = new Date(e.createdAt).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
      const list = map.get(label)
      if (list) list.push(e)
      else map.set(label, [e])
    })
    return Array.from(map.entries())
  }, [filtered])

  const handleRemove = async (entry: Entry) => {
    const ok = await confirm(`Remove the ${entry.amount.toLocaleString()} pour from this bottle?`)
    if (!ok || !bottleId) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/bottles/entries/${entry.id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Pour removed', 'success')
        await reload(bottleId)
        onChanged()
      } else {
        showToast('Failed to remove', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setRemoving(false)
    }
  }

  if (!bottleId) return null

  const pct =
    bottle?.target && bottle.target > 0
      ? Math.min(100, Math.round(((stats?.total || 0) / bottle.target) * 100))
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[8px] border border-gold-dim/25 bg-surface-solid text-parchment shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-white/10 px-6 pt-6 pb-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold-dim/30 bg-gold/10 text-2xl">
            {bottle?.emoji || '🫙'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">@{bottle?.name || '…'}</p>
            <p className="font-mono text-[11px] text-parchment/45">
              {loading
                ? 'Opening…'
                : `${stats?.entryCount ?? 0} pour${(stats?.entryCount ?? 0) === 1 ? '' : 's'} · ${(stats?.total || 0).toLocaleString()}${bottle?.unit ? ` ${bottle.unit}` : ''} inside`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-parchment/40 transition hover:bg-white/10 hover:text-parchment"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + Stats */}
        <div className="border-b border-white/10 px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-parchment/35" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search pours by note, amount, or source…"
              className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          {stats && !loading && (
            <div className="mt-3 flex flex-wrap gap-2">
              {pct !== null && (
                <span className="rounded-full border border-gold-dim/30 bg-gold/10 px-2.5 py-1 font-mono text-[11px] text-gold">
                  {pct}% of {bottle?.target?.toLocaleString()}{bottle?.unit ? ` ${bottle.unit}` : ''} goal
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-parchment/60">
                Largest: {stats.largestPour.toLocaleString()}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-parchment/60">
                Avg: {stats.avgPour.toLocaleString()}
              </span>
              {Object.entries(stats.bySource).map(([src, count]) => (
                <span key={src} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-parchment/60">
                  {src === 'reflection' ? 'From reflections' : src === 'manual' ? 'Manual' : src}: {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pour history */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="py-8 text-center text-sm text-parchment/40">Opening the bottle…</p>}
          {!loading && error && <p className="py-8 text-center text-sm text-[#cf8f78]">{error}</p>}
          {!loading && !error && groups.length === 0 && (
            <p className="py-8 text-center text-sm text-parchment/40">
              {query ? 'No pours match your search.' : 'This bottle is empty — pour something in!'}
            </p>
          )}
          {!loading && !error && groups.map(([day, dayEntries]) => (
            <div key={day} className="mb-4 last:mb-0">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-parchment/35">{day}</p>
              <div className="space-y-1.5">
                {dayEntries.map(e => (
                  <div
                    key={e.id}
                    className="group flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                  >
                    <span className="w-14 shrink-0 text-right font-mono text-sm font-bold text-gold">
                      {e.amount.toLocaleString()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-parchment/80">{sourceLabel(e)}</span>
                    <span className="shrink-0 font-mono text-[10px] text-parchment/35">
                      {new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleRemove(e)}
                      disabled={removing}
                      className="shrink-0 rounded-md p-1 text-parchment/25 opacity-0 transition hover:bg-ember/15 hover:text-[#cf8f78] focus:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                      aria-label="Remove pour"
                      title="Remove pour"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-3">
          <p className="text-center font-mono text-[11px] text-parchment/35">
            {query
              ? `${filtered.length} of ${entries.length} pours shown`
              : `${entries.length} pour${entries.length === 1 ? '' : 's'} on record`}
          </p>
        </div>
      </div>
    </div>
  )
}

