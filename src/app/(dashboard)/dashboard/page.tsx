'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useHierarchyStore, type Item } from '@/stores/hierarchyStore'
import { useRouter } from 'next/navigation'
import { format, startOfYear, differenceInDays } from 'date-fns'
import { ArrowRight, ArrowUpRight, Check, MessageSquare, Sun, X, Activity, Clock, Star, Sunrise, Sunset, Moon, CloudRain, CloudSnow, CloudFog, Cloud, Zap } from 'lucide-react'
import { WordRotator, Marquee, CountUp, RevealLines } from '@/components/ui/motion'
import { useCountdown, formatCountdown, compactCountdownLabel } from '@/lib/useCountdown'
import { useUser } from '@clerk/nextjs'
import { Loader } from '@/components/ui/Loader'
import { WorkClock } from '@/components/ui/WorkClock'
import { markNudgesSeen } from '@/lib/useUnread'
import { useAmbient, type TimeOfDay, type Weather } from '@/components/effects/atmosphere'
import { Float } from '@/components/effects/fluid'
import { Badge, Button, EmptyState, IconButton, Page, PageHeader, Panel, Section, Stat, StatGrid, cx } from '@/components/ds'

interface Nudge {
  id: string
  message: string
  partner: { name: string }
  createdAt: string
}

/* Time-of-day / weather ornament for the header's live clock read. */
function TodGlyph({ timeOfDay, weather, className }: { timeOfDay: TimeOfDay; weather: Weather; className?: string }) {
  if (weather === 'storm') return <Zap className={className} strokeWidth={1.5} aria-hidden="true" />
  if (weather === 'snow') return <CloudSnow className={className} strokeWidth={1.5} aria-hidden="true" />
  if (weather === 'rain') return <CloudRain className={className} strokeWidth={1.5} aria-hidden="true" />
  if (weather === 'haze') return <CloudFog className={className} strokeWidth={1.5} aria-hidden="true" />
  if (weather === 'clouds') return <Cloud className={className} strokeWidth={1.5} aria-hidden="true" />
  if (timeOfDay === 'dawn') return <Sunrise className={className} strokeWidth={1.5} aria-hidden="true" />
  if (timeOfDay === 'dusk') return <Sunset className={className} strokeWidth={1.5} aria-hidden="true" />
  if (timeOfDay === 'night') return <Moon className={className} strokeWidth={1.5} aria-hidden="true" />
  return <Sun className={className} strokeWidth={1.5} aria-hidden="true" />
}

/* A 3px hairline meter under a figure: the quiet instrument read. */
function Meter({ pct, tone = 'gold', className }: { pct: number; tone?: 'gold' | 'moss'; className?: string }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <span aria-hidden="true" className={cx('block h-[3px] w-full overflow-hidden rounded-full bg-parchment/10', className)}>
      <span
        className={cx('block h-full rounded-full transition-[width] duration-700 ease-out', tone === 'moss' ? 'bg-moss/80' : 'bg-gold/80')}
        style={{ width: `${clamped}%` }}
      />
    </span>
  )
}

/* Greeting from the local clock — an external value that changes outside
   React, so it's read with useSyncExternalStore: server snapshot renders
   empty (hydration-safe) and the client picks the real one after mount,
   with no setState-in-effect render cascade. */
const noopSubscribe = () => () => {}
function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const EYEBROW = 'font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoaded: userLoaded } = useUser()
  const { items, completionMap, setItems, getFlatItems, updateItem } = useHierarchyStore()
  const amb = useAmbient()
  const [loading, setLoading] = useState(true)
  const [dailyScore, setDailyScore] = useState<{ totalTasks: number; completedTasks: number; score: number } | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  // Hydration-safe "mounted" flag for the live clock: false during SSR and
  // the first paint, true after — no setState-in-effect render cascade.
  const clockReady = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false, // server snapshot — placeholder clock renders pre-hydration
  )
  const countdownNow = useCountdown()
  const greeting = useSyncExternalStore(
    noopSubscribe,
    () => greetingForHour(new Date().getHours()),
    () => '', // server snapshot — filled in right after hydration
  )

  const refreshDailyScore = useCallback(() => {
    // Local calendar day (yyyy-MM-dd) — the same anchor every other screen uses.
    // A full UTC ISO string here resolves to the wrong day for UTC− timezones
    // in the evening (e.g. 8pm in Lagos is already "tomorrow" in UTC).
    fetch(`/api/daily-score?date=${format(new Date(), 'yyyy-MM-dd')}`)
      .then(r => r.json())
      .then(data => { if (data.dailyScore) setDailyScore(data.dailyScore) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshDailyScore()

    fetch('/api/nudges')
      .then(r => r.json())
      .then(data => {
        if (!data.nudges) return
        setNudges(data.nudges)
        // The newest nudge is shown in full on this page, so it counts as seen.
        if (data.nudges[0]) void markNudgesSeen([data.nudges[0].id])
      })
      .catch(() => {})
  }, [refreshDailyScore])

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then((data: { items?: Item[] }) => {
        if (data.items) {
          const itemMap = new Map<string, Item>()
          data.items.forEach(item => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
          const tree: Item[] = []
          data.items.forEach(item => {
            if (item.parentId) {
              const parent = itemMap.get(item.parentId)
              const child = itemMap.get(item.id)
              if (parent && child) parent.children!.push(child)
            } else {
              const root = itemMap.get(item.id)
              if (root) tree.push(root)
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
    const candidates: { title: string; isImportant: boolean; parts: ReturnType<typeof formatCountdown> }[] = []
    for (const item of flatItems) {
      for (const t of item.tasks || []) {
        if (!t.startTime || t.completed) continue
        const d = new Date(t.date)
        if (format(d, 'yyyy-MM-dd') !== todayIso) continue
        candidates.push({
          title: t.title,
          isImportant: !!t.isImportant,
          parts: formatCountdown(countdownNow, new Date(t.startTime), t.endTime ? new Date(t.endTime) : null),
        })
      }
    }
    candidates.sort((a, b) => a.parts.totalSeconds - b.parts.totalSeconds)
    return candidates[0] || null
  })()

  const dayOfYear = differenceInDays(today, startOfYear(today)) + 1
  const alignment = dailyScore?.score ?? Math.round(totalCompletion)
  const deedsPct = todayDeeds.length > 0 ? Math.round((doneToday / todayDeeds.length) * 100) : 0
  const yearPct = Math.round((dayOfYear / 365) * 100)
  const latestNudge = nudges[0]
  // First name, else the first word of the full name, the username or the
  // email; blank (never "friend") while the account is still loading.
  const firstName =
    user?.firstName?.trim() ||
    user?.fullName?.trim().split(/\s+/)[0] ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    ''

  // Keep the dashboard in sync with the day page: a deed's completion lives on
  // its Task(s). The tasks API recalculates the deed's progress (and every
  // ancestor's) and daily-score is computed from task progress — toggling the
  // Item alone (the old behavior) left the checkbox, scores and rollups stale.
  const toggleDeed = (deed: Item, completed: boolean) => {
    const tasks = deed.tasks || []
    if (tasks.length > 0) {
      // Optimistic: flip the tasks in the local tree (same pattern as the day page)
      const updatedTasks = tasks.map(t => ({ ...t, completed }))
      const updateNode = (nodes: Item[]): Item[] => nodes.map(n => {
        if (n.id === deed.id) return { ...n, tasks: updatedTasks }
        if (n.children) return { ...n, children: updateNode(n.children) }
        return n
      })
      setItems(updateNode(items))

      // Persist each task; the API cascades progress up the hierarchy.
      Promise.all(tasks.map(t =>
        fetch(`/api/tasks/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed }),
        })
      )).then(() => refreshDailyScore()).catch(console.error)
    } else {
      // Taskless deed: completion lives on the item itself — set progress too so
      // rollups and the daily score's deed-progress fallback actually move.
      updateItem(deed.id, { completed, progress: completed ? 100 : 0 })
      refreshDailyScore()
    }
  }

  if (loading) {
    return <Loader label="Rolling out your dashboard…" routeKey="dashboard" />
  }

  /* ── First-run: no Why yet ── */
  if (items.length === 0) {
    return (
      <Page width="narrow">
        <div className="flex min-h-[70vh] flex-col justify-center gap-6" data-noreveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold-dim">Inchstone</p>
          <h1 className="text-display text-parchment">
            <RevealLines delay={120} lines={['Begin with', 'your Why.']} />
          </h1>
          <p className="max-w-md text-body text-parchment/60">
            One sentence for what this year is really about — every quarter, month,
            week and deed hangs from it.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push('/year')}
            data-cursor="Start with why"
            className="btn-shine mt-2 w-fit px-6"
          >
            Build your Why
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </Page>
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

  const dayHref = `/day/${format(today, 'yyyy-MM-dd')}`
  const nudgeShowing = !nudgeDismissed && !!latestNudge

  return (
    <Page className="pt-2 sm:pt-4">
      {/* ── 1. Header: date + live time, greeting, the two ways out ── */}
      <div data-noreveal>
        <PageHeader
          eyebrow={<span>{format(today, 'EEEE')} · {format(today, 'd MMM yyyy')}</span>}
          meta={
            <span title={todPhrase} className="inline-flex items-center gap-2">
              <TodGlyph timeOfDay={amb.timeOfDay} weather={amb.weather} className="h-3.5 w-3.5 text-gold-dim" />
              <span
                suppressHydrationWarning
                className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-bold tracking-[0.08em] text-gold"
              >
                {clockReady ? format(countdownNow, 'HH:mm:ss') : '--:--:--'}
              </span>
            </span>
          }
          title={
            // The greeting is the page: oversized, tight-set, the name in gold on its own line.
            // Sized from the card's own width (container units), so "Good afternoon,"
            // always fits on one line whether or not the sidebar is open.
            <Float delay={0.2} duration={10} amp={4} className="block w-full">
            <span className="block w-full whitespace-nowrap leading-[1.02] tracking-[-0.025em] [container-type:inline-size]">
              <span className="block text-parchment text-[clamp(1.25rem,10.5cqi,6.5rem)]">
                <RevealLines delay={80} fluid lines={[`${greeting},`]} />
              </span>
              <span className="block min-h-[1.02em] italic text-gold text-[clamp(1.25rem,10.5cqi,6.5rem)]">
                {userLoaded && <RevealLines delay={220} fluid lines={[firstName ? `${firstName}.` : 'friend.']} />}
              </span>
            </span>
            </Float>
          }
          description={
            <span className="font-mono text-mono uppercase tracking-[0.18em] text-parchment/50">
              Build{' '}
              <WordRotator
                className="font-semibold normal-case tracking-normal text-gold"
                words={[
                  'discipline', 'momentum', 'clarity', 'faith', 'streaks',
                  'consistency', 'purpose', 'courage', 'focus', 'gratitude',
                  'patience', 'strength',
                ]}
              />{' '}
              one day at a time
            </span>
          }
          actions={
            <>
              <Button variant="ghost" onClick={() => router.push('/year')} data-cursor="See the whole year">
                Open the full year
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="primary" onClick={() => router.push(dayHref)} data-cursor="Sketch the day">
                Plan today
              </Button>
            </>
          }
        />
      </div>

      {/* ── 2. The instrument: work clock + today's progress + next up ── */}
      <Section id="today" title="Today">
        <Panel className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8 lg:gap-12">
          {/* The signature instrument — a live work clock: today's ring around
              the dial, the real local time on the hands, and the day number +
              alignment as watch complications. A tap opens the full year. */}
          <Float delay={0.3} duration={9} amp={4} className="justify-self-center">
            <div data-cursor="Open the full year">
              <div className="hidden lg:block">
                <WorkClock
                  size={200}
                  progress={deedsPct}
                  dayLabel={String(dayOfYear).padStart(3, '0')}
                  primary={String(Math.round(alignment))}
                  ringLabel="TODAY"
                  onClick={() => router.push('/year')}
                />
              </div>
              <div className="lg:hidden">
                <WorkClock
                  size={148}
                  progress={deedsPct}
                  dayLabel={String(dayOfYear).padStart(3, '0')}
                  primary={String(Math.round(alignment))}
                  ringLabel="TODAY"
                  onClick={() => router.push('/year')}
                />
              </div>
            </div>
          </Float>

          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <p className={EYEBROW}>Today&apos;s progress</p>
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-display leading-none text-parchment">
                  <CountUp value={doneToday} duration={1100} format={n => `${Math.round(n)}/${todayDeeds.length}`} />
                </span>
                <span className="text-body text-parchment/55">deeds done</span>
              </p>
              <Meter pct={deedsPct} tone="moss" />
              <p className="text-caption text-parchment/50">
                {todayDeeds.length > 0
                  ? <><span className="font-mono tabular-nums">{deedsPct}%</span> of today&apos;s deeds complete</>
                  : 'Nothing set for today yet.'}
              </p>
            </div>

            {/* Next up — the next scheduled deed with a live countdown */}
            {nextScheduled && (
              <button
                onClick={() => router.push(dayHref)}
                className={cx(
                  'flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors animate-fadeIn',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                  nextScheduled.parts.state === 'live'
                    ? 'border-moss/25 bg-moss/[0.06] hover:border-moss/45'
                    : nextScheduled.parts.soon
                      ? 'border-ember/25 bg-ember/[0.06] hover:border-ember/45'
                      : 'border-gold/15 hover:border-gold/40',
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-parchment/[0.05]">
                  {nextScheduled.parts.state === 'live'
                    ? <Activity className="h-3.5 w-3.5 text-moss" />
                    : <Clock className="h-3.5 w-3.5 text-gold-dim" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block', EYEBROW)}>Next up</span>
                  <span className="mt-0.5 block break-words text-sm leading-snug">
                    {nextScheduled.isImportant && (
                      <Star aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5 fill-gold text-gold" />
                    )}
                    <span className={nextScheduled.parts.state === 'live' ? 'text-moss' : 'text-parchment/85'}>
                      {nextScheduled.title}
                    </span>
                  </span>
                </span>
                <span className={cx(
                  'shrink-0 font-mono text-mono tabular-nums',
                  nextScheduled.parts.state === 'live' ? 'text-moss' : nextScheduled.parts.soon ? 'text-ember' : 'text-gold',
                )}>
                  {nextScheduled.parts.state === 'live'
                    ? `● ${compactCountdownLabel(nextScheduled.parts)}`
                    : `in ${compactCountdownLabel(nextScheduled.parts)}`}
                </span>
              </button>
            )}
          </div>
        </Panel>
      </Section>

      {/* ── 3. Today's deeds: numbered index ── */}
      <Section
        id="deeds"
        title="Today's deeds"
        action={
          <>
            {todayDeeds.length > 0 && (
              <Badge tone={doneToday === todayDeeds.length ? 'moss' : 'gold'}>{doneToday}/{todayDeeds.length} done</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => router.push(dayHref)} data-cursor="Open today">
              Open day
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </>
        }
      >
        {todayDeeds.length > 0 ? (
          <Panel padded={false} className="py-1 sm:py-2">
            <ul>
              {todayDeeds.slice(0, 6).map((deed, i) => {
                const pct = completionMap[deed.id] || 0
                const done = pct >= 100
                return (
                  <li key={deed.id} className="border-b border-gold/10 last:border-b-0">
                    <div
                      className="group flex min-h-14 cursor-pointer items-center gap-3 px-3 py-1.5 transition-colors hover:bg-gold/[0.04] sm:px-5 pointer-fine:min-h-12"
                      onClick={() => router.push(dayHref)}
                    >
                      <span aria-hidden="true" className="w-6 shrink-0 font-mono text-mono tabular-nums text-gold-dim/80">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`Mark ${deed.title} ${done ? 'incomplete' : 'complete'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDeed(deed, !done)
                        }}
                        className="-mx-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 pointer-fine:h-9 pointer-fine:w-9"
                      >
                        <span
                          aria-hidden="true"
                          className={cx(
                            'flex h-6 w-6 items-center justify-center rounded-md border transition-colors duration-200',
                            done ? 'border-moss bg-moss text-ink' : 'border-gold-dim/40 hover:border-gold',
                          )}
                        >
                          {done && <Check className="h-4 w-4" strokeWidth={2.5} />}
                        </span>
                      </button>
                      <span className={cx('min-w-0 flex-1 break-words text-body', done ? 'text-parchment/40 line-through' : 'text-parchment')}>
                        {deed.title}
                      </span>
                      <span className="hidden shrink-0 font-mono text-mono tabular-nums text-parchment/45 min-[400px]:block">
                        {Math.round(pct)}%
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-parchment/25 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No deeds set for today."
            action={
              <Button variant="secondary" onClick={() => router.push(dayHref)} data-cursor="Sketch the day">
                Plan the day
              </Button>
            }
          />
        )}

        {/* Ambient deeds ticker */}
        <Marquee duration={36} className="mt-4 py-2">
          <span className="mx-6 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/35">
            {todayDeeds.length > 0
              ? todayDeeds.slice(0, 8).map(d => `${d.title} ✦`).join('  ')
              : 'Consistency compounds ✦ Small deeds, every day ✦ Inchstone ✦'}
          </span>
        </Marquee>
      </Section>

      {/* ── 4. Ledger: the standing figures ── */}
      <Section id="ledger" title="Ledger">
        <StatGrid cols={2}>
          <Stat
            label="Alignment"
            tone="gold"
            value={<CountUp value={Math.round(alignment)} duration={1100} format={n => `${Math.round(n)}%`} />}
            caption={
              <span className="block space-y-2.5">
                <Meter pct={alignment} tone="gold" />
                <span className="block">with your Why today</span>
              </span>
            }
          />
          <Stat
            label="The year"
            value={<CountUp value={dayOfYear} duration={1100} format={n => `${Math.round(n)}/365`} />}
            caption={
              <span className="block space-y-2.5">
                <Meter pct={yearPct} tone="gold" />
                <span className="block"><span className="font-mono tabular-nums">{yearPct}%</span> of the year gone</span>
              </span>
            }
          />
        </StatGrid>
      </Section>

      {/* ── 5. One quiet strip: nudge or reflect, never both ── */}
      <Section id="touchpoint" title={nudgeShowing ? 'From your partner' : 'Reflect'}>
        {nudgeShowing ? (
          <div className="glass-gold flex items-start gap-3 rounded-xl p-4 sm:px-6">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.5} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-parchment/45">Nudge from {latestNudge.partner.name}</p>
              <p className="mt-1 text-body text-parchment/85">{latestNudge.message}</p>
            </div>
            <IconButton icon={X} label="Dismiss nudge" onClick={() => setNudgeDismissed(true)} className="-my-2 -mr-2" />
          </div>
        ) : (
          <button
            onClick={() => router.push('/reviews')}
            data-cursor="Pause & reflect"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-gold/15 bg-surface-solid p-4 text-left transition-colors hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:px-6"
          >
            <Sun className="h-4 w-4 shrink-0 text-gold-dim" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex-1 text-body text-parchment/75">Take a quiet moment — reflect on today.</span>
            <ArrowRight className="h-4 w-4 text-parchment/45" aria-hidden="true" />
          </button>
        )}
      </Section>
    </Page>
  )
}
