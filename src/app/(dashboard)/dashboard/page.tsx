'use client'

import { useEffect, useState } from 'react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { useRouter } from 'next/navigation'
import { format, startOfYear, differenceInDays } from 'date-fns'
import { ArrowRight, ArrowUpRight, Check, MessageSquare, Sun, X, Activity, Clock } from 'lucide-react'
import { WordRotator, Marquee, CountUp, RevealLines } from '@/components/ui/motion'
import { useCountdown, formatCountdown, compactCountdownLabel } from '@/lib/useCountdown'
import { useUser } from '@clerk/nextjs'
import { Loader } from '@/components/ui/Loader'
import { useAmbient } from '@/components/effects/atmosphere'
import { Float } from '@/components/effects/fluid'

interface Nudge {
  id: string
  message: string
  partner: { name: string }
  createdAt: string
}

/* One editorial figure in the stat strip (replaces the compass widget). */
function Stat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="min-w-0 px-4 first:pl-0 last:pr-0 sm:px-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">{label}</p>
      <p className="mt-2.5 font-display text-[2rem] leading-none text-parchment tabular-nums sm:text-[2.6rem]">
        <CountUp value={value} duration={1100} format={n => `${Math.round(n)}${suffix}`} />
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useUser()
  const { items, completionMap, setItems, getFlatItems, updateItem } = useHierarchyStore()
  const amb = useAmbient()
  const [loading, setLoading] = useState(true)
  const [dailyScore, setDailyScore] = useState<{ totalTasks: number; completedTasks: number; score: number } | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [greeting, setGreeting] = useState('')
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const countdownNow = useCountdown()

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    const todayIso = new Date().toISOString()
    fetch(`/api/daily-score?date=${todayIso}`)
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
  const todayIso = format(today, 'yyyy-MM-dd')
  const todayDeeds = flatItems.filter(
    i => i.layer === 5 && i.startDate && format(new Date(i.startDate), 'yyyy-MM-dd') === todayIso
  )
  const doneToday = todayDeeds.filter(d => (completionMap[d.id] || 0) >= 100).length

  // ── Next scheduled deed countdown ─────────────────────────────────
  // Scans every task across today's goals for the soonest scheduled deed
  // (startTime set, not completed) and surfaces a subtle countdown chip.
  const nextScheduled = (() => {
    const candidates: { title: string; parts: ReturnType<typeof formatCountdown> }[] = []
    for (const item of flatItems) {
      for (const t of item.tasks || []) {
        if (!t.startTime || t.completed) continue
        const d = new Date(t.date)
        if (format(d, 'yyyy-MM-dd') !== todayIso) continue
        candidates.push({
          title: t.title,
          parts: formatCountdown(countdownNow, new Date(t.startTime), t.endTime ? new Date(t.endTime) : null),
        })
      }
    }
    candidates.sort((a, b) => a.parts.totalSeconds - b.parts.totalSeconds)
    return candidates[0] || null
  })()

  const dayOfYear = differenceInDays(today, startOfYear(today)) + 1
  const alignment = dailyScore?.score ?? Math.round(totalCompletion)
  const latestNudge = nudges[0]
  const firstName = user?.firstName?.trim() || ''

  const toggleDeed = (id: string, completed: boolean) => {
    updateItem(id, { completed })
  }

  if (loading) {
    return <Loader label="Rolling out your dashboard…" routeKey="dashboard" />
  }

  /* ── First-run: no Why yet ── */
  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-[880px] flex-col justify-center px-1" data-noreveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-parchment/40">Inchstone</p>
        <h1 className="mt-4 font-display text-[clamp(2.6rem,7vw,4.75rem)] leading-[1.03] text-parchment">
          <RevealLines delay={120} lines={['Begin with', 'your Why.']} />
        </h1>
        <p className="mt-6 max-w-md text-body leading-relaxed text-parchment/60">
          One sentence for what this year is really about — every quarter, month,
          week and deed hangs from it.
        </p>
        <button
          onClick={() => router.push('/year')}
          className="btn-shine mt-9 inline-flex w-fit items-center gap-2 rounded-md bg-gold px-7 py-3 text-sm font-semibold text-ink transition-colors hover:bg-[#cbaa6f]"
        >
          Build your Why
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const todWord = amb.timeOfDay.charAt(0).toUpperCase() + amb.timeOfDay.slice(1)
  const todPhrase =
    amb.timeOfDay === 'dawn'
      ? 'First light'
      : amb.timeOfDay === 'dusk'
        ? 'Last light'
        : amb.timeOfDay === 'noon'
          ? 'High noon'
          : amb.timeOfDay === 'night'
            ? 'Night'
            : todWord

  return (
    <div className="mx-auto max-w-[880px] space-y-10 px-1 pb-28 pt-2 sm:pt-4">
      {/* ── Meta strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-white/5 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-parchment/40">
          {format(today, 'EEEE')} · {format(today, 'd MMM yyyy')}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-parchment/40">
          Day {String(dayOfYear).padStart(3, '0')} · {todPhrase}
        </p>
      </div>

      {/* ── Hero: masked line reveal, dion-style ── */}
      <Float delay={0.3} duration={9} amp={5}>
      <header data-noreveal>
        <h1 className="font-display text-[clamp(2.7rem,7vw,4.9rem)] leading-[1.04] text-parchment">
          <RevealLines
            delay={80}
            fluid
            lines={[
              `${greeting},`,
              firstName ? `${firstName}.` : 'friend.',
            ]}
          />
        </h1>
        <div className="mt-6 flex items-center gap-4">
          <span aria-hidden="true" className="h-px w-12 shrink-0 bg-gold/60" />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-parchment/50">
            Build{' '}
            <WordRotator
              className="font-semibold normal-case tracking-normal text-gold"
              words={['discipline', 'momentum', 'clarity', 'faith', 'streaks']}
            />{' '}
            one day at a time
          </p>
        </div>
      </header>
      </Float>

      {/* ── Figures strip (the compass, translated into type) ── */}
      <Float delay={0.7} duration={10} amp={6}>
      <section aria-label="Progress" className="grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] py-6">
        <Stat label="Alignment" value={Math.round(alignment)} suffix="%" />
        <Stat label="Done today" value={doneToday} suffix={`/${todayDeeds.length}`} />
        <Stat label="Day of year" value={dayOfYear} suffix="/365" />
      </section>
      </Float>

      <Float delay={1.2} duration={11} amp={5}>
      {/* ── Today's deeds: numbered index ── */}
      <section aria-labelledby="deeds-heading">
        <div className="flex items-center justify-between pb-3">
          <h2 id="deeds-heading" className="font-mono text-[11px] uppercase tracking-[0.26em] text-parchment/40">
            Today&rsquo;s deeds
          </h2>
          <button
            onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
            className="flex items-center gap-1 font-mono text-xs uppercase tracking-[0.18em] text-parchment/45 transition-colors hover:text-parchment"
          >
            Open day
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Subtle live countdown to the next scheduled deed */}
        {nextScheduled && (
          <button
            onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
            className={`-mx-2 mb-3 flex w-[calc(100%+16px)] items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors animate-fadeIn ${
              nextScheduled.parts.state === 'live'
                ? 'border-moss/25 bg-moss/[0.06] hover:border-moss/45'
                : nextScheduled.parts.soon
                  ? 'border-ember/25 bg-ember/[0.06] hover:border-ember/45'
                  : 'border-gold-dim/20 bg-white/[0.02] hover:border-gold/40'
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
              {nextScheduled.parts.state === 'live'
                ? <Activity className="h-3.5 w-3.5 text-sage" />
                : <Clock className="h-3.5 w-3.5 text-gold-dim" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className={nextScheduled.parts.state === 'live' ? 'text-sage' : 'text-parchment/85'}>
                {nextScheduled.title}
              </span>
            </span>
            <span className={`shrink-0 font-mono text-xs tabular-nums ${
              nextScheduled.parts.state === 'live' ? 'text-sage' : nextScheduled.parts.soon ? 'text-[#e0a093]' : 'text-gold'
            }`}>
              {nextScheduled.parts.state === 'live'
                ? `● ${compactCountdownLabel(nextScheduled.parts)}`
                : `in ${compactCountdownLabel(nextScheduled.parts)}`}
            </span>
          </button>
        )}

        {todayDeeds.length > 0 ? (
          <ul className="-mx-2">
            {todayDeeds.slice(0, 6).map((deed, i) => {
              const pct = completionMap[deed.id] || 0
              const done = pct >= 100
              return (
                <li key={deed.id}>
                  <div
                    className="group -mx-2 flex cursor-pointer items-center gap-3 rounded-md border-b border-white/[0.04] px-2 py-3 transition-colors last:border-b-0 hover:bg-white/[0.04]"
                    onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
                  >
                    <span aria-hidden="true" className="w-7 shrink-0 font-mono text-xs tabular-nums text-gold-dim/80">
                      {String(i + 1).padStart(2, '0')}
                    </span>
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
                    <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-parchment/40 line-through' : 'text-parchment'}`}>
                      {deed.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-parchment/45">
                      {Math.round(pct)}%
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-parchment/25 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <p className="text-sm text-parchment/55">No deeds set for today.</p>
            <button
              onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
              className="text-sm font-medium text-gold transition-colors hover:text-gold/80"
            >
              Plan the day
            </button>
          </div>
        )}
      </section>
      </Float>

      {/* Ambient deeds ticker */}
      <Marquee duration={36} className="-mx-4 border-y border-white/5 py-2.5 sm:-mx-6">
        <span className="mx-6 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/35">
          {todayDeeds.length > 0
            ? todayDeeds.slice(0, 8).map(d => `${d.title} ✦`).join('  ')
            : 'Consistency compounds ✦ Small deeds, every day ✦ Inchstone ✦'}
        </span>
      </Marquee>

      {/* ── One quiet strip: nudge or reflect, never both ── */}
      {!nudgeDismissed && latestNudge ? (
        <div className="flex items-start gap-3 rounded-md border border-white/[0.06] p-4">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-parchment/45">Nudge from {latestNudge.partner.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-parchment/85">{latestNudge.message}</p>
          </div>
          <button
            onClick={() => setNudgeDismissed(true)}
            aria-label="Dismiss nudge"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-parchment/45 transition-colors hover:text-parchment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => router.push('/reviews')}
          className="flex w-full items-center gap-3 rounded-md border border-white/[0.06] p-4 text-left transition-colors hover:border-gold/40"
        >
          <Sun className="h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.5} />
          <span className="flex-1 text-sm text-parchment/75">Take a quiet moment — reflect on today.</span>
          <ArrowRight className="h-4 w-4 text-parchment/45" />
        </button>
      )}

      {/* ── Closing CTA ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-7">
        <button
          onClick={() => router.push('/year')}
          className="group inline-flex items-center gap-2 font-display text-2xl text-parchment transition-colors hover:text-gold"
        >
          Open the full year
          <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
        <button
          onClick={() => router.push(`/day/${format(today, 'yyyy-MM-dd')}`)}
          className="font-mono text-xs uppercase tracking-[0.18em] text-parchment/45 transition-colors hover:text-parchment"
        >
          Plan today
        </button>
      </div>
    </div>
  )
}