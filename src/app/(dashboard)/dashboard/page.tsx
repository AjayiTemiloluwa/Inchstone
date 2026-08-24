'use client'

import { useEffect, useState, useMemo } from 'react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { useRouter } from 'next/navigation'
import { format, startOfYear, differenceInDays } from 'date-fns'
import { ArrowRight, Check, MessageSquare, Sun, X } from 'lucide-react'
import { Compass } from '@/components/ui/Compass'

interface Nudge {
  id: string
  message: string
  partner: { name: string }
  createdAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { items, completionMap, setItems, getFlatItems, updateItem } = useHierarchyStore()
  const [loading, setLoading] = useState(true)
  const [dailyScore, setDailyScore] = useState<{ totalTasks: number; completedTasks: number; score: number } | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [greeting, setGreeting] = useState('')
  const [showCompassSheet, setShowCompassSheet] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  const isCoarse = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches,
    []
  )

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    const today = new Date().toISOString()
    fetch(`/api/daily-score?date=${today}`)
      .then(r => r.json())
      .then(data => { if (data.dailyScore) setDailyScore(data.dailyScore) })
      .catch(() => {})

    fetch('/api/nudges')
      .then(r => r.json())
      .then(data => { if (data.nudges) setNudges(data.nudges) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          const itemMap = new Map()
          data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
          const tree: any[] = []
          data.items.forEach((item: any) => {
            if (item.parentId) {
              const parent = itemMap.get(item.parentId)
              if (parent) parent.children.push(itemMap.get(item.id))
            } else {
              tree.push(itemMap.get(item.id))
            }
          })
          setItems(tree)
        }
      })
      .finally(() => setLoading(false))
  }, [setItems])

  const flatItems = getFlatItems()
  const whyItem = flatItems.find(i => i.layer === 1)
  const totalCompletion = whyItem ? completionMap[whyItem.id] || 0 : 0

  const today = new Date()
  const todayDeeds = flatItems.filter(
    i => i.layer === 5 && i.startDate && format(new Date(i.startDate), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  )

  const dayOfYear = differenceInDays(today, startOfYear(today)) + 1
  const alignment = dailyScore?.score ?? Math.round(totalCompletion)
  const latestNudge = nudges[0]

  const handleCompass = () => {
    if (isCoarse) setShowCompassSheet(true)
    else router.push('/year')
  }

  const toggleDeed = (id: string, completed: boolean) => {
    updateItem(id, { completed })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-sm text-parchment/40 font-mono">Loading…</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
        <Compass alignment={0} size={120} className="opacity-80" />
        <div className="text-center max-w-sm space-y-2">
          <h1 className="text-h1 text-parchment">Inchstone</h1>
          <p className="text-body text-parchment/60">
            Start with your Why — the one sentence this year is really about.
          </p>
        </div>
        <button
          onClick={() => router.push('/year')}
          className="min-h-12 px-8 py-3 rounded-md bg-gold text-ink font-semibold text-body hover:bg-[#cbaa6f] transition-colors"
        >
          Build your Why
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 sm:px-6 pb-28 pt-4 sm:pt-8 space-y-8">
      {/* ── Compass hero ── */}
      <div className="flex flex-col items-center">
        <Compass
          alignment={alignment}
          ringProgress={totalCompletion}
          dayLabel={String(dayOfYear).padStart(3, '0')}
          primary={String(Math.round(alignment))}
          ringLabel="DAY"
          size={220}
          onClick={handleCompass}
          interactiveLabel="Open year view"
          className="sm:hidden"
        />
        <Compass
          alignment={alignment}
          ringProgress={totalCompletion}
          dayLabel={String(dayOfYear).padStart(3, '0')}
          primary={String(Math.round(alignment))}
          ringLabel="DAY"
          size={280}
          onClick={handleCompass}
          interactiveLabel="Open year view"
          className="hidden sm:inline-flex"
        />
        {whyItem && (
          <p className="mt-4 text-center text-caption text-parchment/55">
            {greeting},{' '}
            <span className="text-parchment/85">{String(whyItem.title).slice(0, 40)}</span>
            {String(whyItem.title).length > 40 ? '…' : ''}
          </p>
        )}
      </div>

      {/* ── Today's Deeds ── */}
      <section aria-labelledby="deeds-heading">
        <div className="flex items-center justify-between border-b hairline-bottom pb-3">
          <h2 id="deeds-heading" className="text-heading text-parchment">Today&apos;s Deeds</h2>
          <button
            onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
            className="text-sm font-medium text-parchment/70 hover:text-parchment transition-colors flex items-center gap-1"
          >
            Open day
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {todayDeeds.length > 0 ? (
          <ul className="mt-2">
            {todayDeeds.slice(0, 6).map(deed => {
              const pct = completionMap[deed.id] || 0
              const done = pct >= 100
              return (
                <li key={deed.id}>
                  <div
                    className="row-group group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 min-h-11 cursor-pointer transition-colors hover:bg-mist"
                    onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`Mark ${deed.title} ${done ? 'incomplete' : 'complete'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleDeed(deed.id, !done)
                      }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-200 ${
                        done ? 'border-moss bg-moss text-ink' : 'border-gold-dim/40 hover:border-gold'
                      }`}
                    >
                      {done && <Check className="h-4 w-4" strokeWidth={2.5} />}
                    </button>
                    <span className={`flex-1 min-w-0 text-sm ${done ? 'line-through text-parchment/45' : 'text-parchment'}`}>
                      {deed.title}
                    </span>
                    <span className="font-mono text-xs text-parchment/55 tabular-nums">
                      {Math.round(pct)}%
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-2 flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-parchment/55">No deeds set for today.</p>
            <button
              onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
              className="text-sm font-medium text-gold hover:text-gold/80 transition-colors"
            >
              Plan the day
            </button>
          </div>
        )}

        <div className="mt-2 flex justify-end">
          <button
            onClick={() => router.push('/year')}
            className="text-sm font-medium text-parchment/70 hover:text-parchment transition-colors flex items-center gap-1"
          >
            View all (year)
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── One quiet strip: nudge or reflect, never both ── */}
      {!nudgeDismissed && latestNudge ? (
        <div className="flex items-start gap-3 rounded-md border hairline p-4">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="text-caption text-parchment/45">Nudge from {latestNudge.partner.name}</p>
            <p className="mt-1 text-sm text-parchment/85 leading-relaxed">{latestNudge.message}</p>
          </div>
          <button
            onClick={() => router.push('/partners')}
            className="text-sm font-medium text-parchment/70 hover:text-parchment transition-colors shrink-0"
          >
            Reply
          </button>
          <button
            onClick={() => setNudgeDismissed(true)}
            aria-label="Dismiss nudge"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-parchment/45 hover:text-parchment transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => router.push('/reviews')}
          className="flex w-full items-center gap-3 rounded-md border hairline p-4 text-left transition-colors hover:border-gold/40"
        >
          <Sun className="h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.5} />
          <span className="flex-1 text-sm text-parchment/75">Take a quiet moment — reflect on today.</span>
          <ArrowRight className="h-4 w-4 text-parchment/45" />
        </button>
      )}

      {/* ── Mobile compass sheet (v2 D3) ── */}
      {showCompassSheet && (
        <div className="fixed inset-0 z-[60] flex items-end bg-ink/70" onClick={() => setShowCompassSheet(false)}>
          <div
            className="w-full rounded-t-[12px] border-t hairline-top bg-ink p-6 pb-12"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pb-5">
              <Compass
                alignment={alignment}
                ringProgress={totalCompletion}
                dayLabel={String(dayOfYear).padStart(3, '0')}
                primary={String(Math.round(alignment))}
                ringLabel="DAY"
                size={220}
              />
            </div>
            <button
              onClick={() => { setShowCompassSheet(false); router.push('/year') }}
              className="flex w-full items-center justify-center gap-2 rounded-md border hairline py-3 text-sm font-medium text-parchment transition-colors hover:border-gold/40"
            >
              View full year
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCompassSheet(false)}
              className="mt-2 w-full rounded-md py-2 text-sm text-parchment/55 hover:text-parchment transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
