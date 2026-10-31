'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Sparkles, X } from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays
} from 'date-fns'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { DayPanel } from '@/components/ui/DayPanel'
import { CountUp } from '@/components/ui/motion'
import { Loader } from '@/components/ui/Loader'
import { Page, PageHeader, Section, Panel, StatGrid, Stat, EmptyState, IconButton, Badge, cx } from '@/components/ds'
import { PeriodNav, Meter } from './_components/PeriodNav'

/* Ledger figure that counts up from its previous value (spec E). */
function Figure({ value, suffix = '' }: { value: number; suffix?: string }) {
  return <CountUp value={value} duration={1100} format={n => `${Math.round(n)}${suffix}`} />
}

export default function CalendarPage() {
  const { items, completionMap, setItems, getFlatItems } = useHierarchyStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const calendarRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = monthStart.getDay()
  const paddingDays = Array.from({ length: startDay }, (_, i) => addDays(monthStart, i - startDay))
  const monthDates = [...paddingDays, ...calendarDays]
  while (monthDates.length < 42) {
    monthDates.push(addDays(monthDates[monthDates.length - 1], 1))
  }

  // Fetch all data
  useEffect(() => {
    Promise.all([
      fetch('/api/items').then(r => r.json()),
    ]).then(([data]) => {
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
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [currentMonth, setItems])

  // Get deeds for a specific day
  const getDeedsForDay = useCallback((date: Date): Item[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const result: Item[] = []
    const collect = (nodes: Item[]) => {
      nodes.forEach(n => {
        if (n.layer === 5 && n.startDate) {
          const dStr = format(new Date(n.startDate), 'yyyy-MM-dd')
          if (dStr === dateStr) result.push(n)
        }
        if (n.children) collect(n.children)
      })
    }
    collect(items)
    return result
  }, [items])

  // Google events for the visible month — thin gold chips (pull-only)
  const [googleEvents, setGoogleEvents] = useState<{ id: string; title: string; startTime: string }[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const from = startOfMonth(currentMonth)
        const to = endOfMonth(currentMonth)
        const res = await fetch(`/api/calendar/events?timeMin=${from.toISOString()}&timeMax=${to.toISOString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.events)) setGoogleEvents(data.events)
      } catch {
        /* calendar is optional — never block the month view */
      }
    })()
    return () => { cancelled = true }
  }, [currentMonth])

  const getGoogleForDay = useCallback((date: Date): string[] => {
    const key = format(date, 'yyyy-MM-dd')
    return googleEvents
      .filter(e => format(new Date(e.startTime), 'yyyy-MM-dd') === key)
      .map(e => e.title)
  }, [googleEvents])

  const getMonthlyMilestones = useCallback((): Item[] => {
    const flatItems = getFlatItems()
    return flatItems.filter(n => n.layer === 3)
  }, [getFlatItems])

  const flatItems = getFlatItems()
  const monthlyMilestones = getMonthlyMilestones()
  const totalDeedCount = flatItems.filter(i => i.layer === 5).length
  const completedDeedCount = flatItems.filter(i => i.layer === 5 && (completionMap[i.id] || 0) >= 100).length
  const completionPct = totalDeedCount > 0 ? Math.round((completedDeedCount / totalDeedCount) * 100) : 0

  const navigate = (dir: 'prev' | 'next') => {
    setCurrentMonth(dir === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1))
  }

  const goToToday = () => setCurrentMonth(new Date())

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    window.location.reload()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (calendarRef.current && calendarRef.current.scrollTop === 0) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !calendarRef.current) return
    const diff = e.touches[0].clientY - touchStart.y
    if (diff > 0 && calendarRef.current.scrollTop === 0) {
      setPullDistance(Math.min(diff, 100))
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return
    const touchEnd = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const diffX = touchStart.x - touchEnd
    const diffY = touchStart.y - touchEndY
    const threshold = 50

    if (pullDistance > 80) {
      handleRefresh()
    } else if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) navigate('next')
      else navigate('prev')
    }

    setTouchStart(null)
    setPullDistance(0)
  }

  /* Select a day. Below the desktop split the detail sits under the grid, so
     bring it into view (instantly when the user prefers reduced motion). */
  const openDay = (date: Date) => {
    setSelectedDay(date)
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1023px)').matches) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }))
  }

  if (loading) return <Loader label="Spawning the calendar grid…" routeKey="calendar" />

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthLabel = format(currentMonth, 'MMMM yyyy')
  const notCurrentMonth = !isSameMonth(currentMonth, new Date())

  let activeDays = 0
  monthDates.forEach(d => {
    if (isSameMonth(d, currentMonth) && getDeedsForDay(d).length > 0) activeDays++
  })

  const closeDay = () => {
    setSelectedDay(null)
  }

  return (
    <Page width="wide" className="pb-28">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="flex items-center justify-center py-1" aria-hidden="true">
          <Sparkles className={cx('h-5 w-5 transition-colors', pullDistance > 80 ? 'text-gold' : 'text-parchment/30', isRefreshing && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.5} />
        </div>
      )}

      <PageHeader
        eyebrow={<>Calendar{notCurrentMonth && <span className="text-gold"> · off-month</span>}</>}
        title={monthLabel}
        meta={`${completionPct}% complete`}
        description="Select a day to open its deeds. On touch, swipe the grid to change months."
        actions={
          <PeriodNav
            label={format(currentMonth, 'MMM yyyy')}
            labelTitle="Jump to today"
            prevLabel="Previous month"
            nextLabel="Next month"
            onPrev={() => navigate('prev')}
            onNext={() => navigate('next')}
            onToday={goToToday}
            showToday={notCurrentMonth}
          />
        }
      />

      <Section title="This month" id="calendar-figures">
        <StatGrid cols={4}>
          <Stat label="Deeds" value={<Figure value={totalDeedCount} />} />
          <Stat label="Completed" tone="moss" value={<Figure value={completedDeedCount} suffix={`/${totalDeedCount}`} />} />
          <Stat label="Active days" value={<Figure value={activeDays} suffix={`/${calendarDays.length}`} />} />
          <Stat
            label="Complete"
            tone="gold"
            value={<Figure value={completionPct} suffix="%" />}
            caption={<Meter value={completionPct} tone="gold" className="mt-1" />}
          />
        </StatGrid>
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-6">
        {/* ── The grid ── */}
        <Section title="Month" id="calendar-grid">
          <Panel padded={false} className="overflow-hidden">
            <div
              ref={calendarRef}
              className="overflow-auto"
              data-lenis-prevent
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Weekday header */}
              <div className="grid grid-cols-7 border-b border-gold/10" aria-hidden="true">
                {weekDays.map(d => (
                  <div key={d} className="py-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/40">
                    <span className="sm:hidden">{d[0]}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div key={format(currentMonth, 'yyyy-MM')} className="grid grid-cols-7" role="group" aria-label={`${monthLabel} days`}>
                {monthDates.map((date, i) => {
                  const inMonth = isSameMonth(date, currentMonth)
                  const isSelected = !!(selectedDay && isSameDay(date, selectedDay))
                  const today = isToday(date)
                  const dayDeeds = getDeedsForDay(date)
                  const dayGoogle = getGoogleForDay(date)
                  const dayCompleted = dayDeeds.filter(d => (completionMap[d.id] || 0) >= 100).length
                  const dayScore = dayDeeds.length > 0
                    ? Math.round(dayDeeds.reduce((sum, d) => sum + (completionMap[d.id] || 0), 0) / dayDeeds.length)
                    : 0
                  const lastRow = i >= 35

                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-current={today ? 'date' : undefined}
                      aria-label={`${format(date, 'EEEE, MMMM d')}${dayDeeds.length > 0 ? `, ${dayCompleted} of ${dayDeeds.length} deeds done` : ', no deeds'}`}
                      style={{ animationDelay: `${Math.min(i * 12, 380)}ms` }}
                      className={cx(
                        'cal-pop group relative min-h-14 cursor-pointer p-1.5 text-left transition-colors duration-150 sm:min-h-[88px] sm:p-2 xl:min-h-[108px]',
                        'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/60',
                        i % 7 !== 6 && 'border-r border-gold/[0.07]',
                        !lastRow && 'border-b border-gold/[0.07]',
                        !inMonth && 'opacity-35',
                        isSelected ? 'bg-gold/[0.08]' : 'hover:bg-gold/[0.04]',
                      )}
                      onClick={() => openDay(date)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDay(date) }
                      }}
                    >
                      {isSelected && <span aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-gold" />}

                      <div className="flex items-start justify-between gap-1">
                        <span className={cx(
                          'grid h-7 w-7 place-items-center rounded-full font-mono text-mono tabular-nums',
                          today ? 'bg-gold font-semibold text-ink' : isSelected ? 'text-gold' : 'text-parchment/75',
                        )}>
                          {format(date, 'd')}
                        </span>
                        {dayDeeds.length > 0 && (
                          <span className="hidden pt-1 font-mono text-[10px] tabular-nums text-parchment/40 sm:block">
                            {dayCompleted}/{dayDeeds.length}
                          </span>
                        )}
                      </div>

                      {/* Phone: quiet dots */}
                      {dayDeeds.length > 0 && (
                        <div className="mt-1 flex min-h-1.5 flex-wrap items-center gap-1 sm:hidden" aria-hidden="true">
                          {dayDeeds.slice(0, 4).map(deed => {
                            const pct = completionMap[deed.id] || 0
                            return <span key={deed.id} className={cx('h-1.5 w-1.5 rounded-full', pct >= 100 ? 'bg-moss' : pct > 0 ? 'bg-gold' : 'bg-parchment/25')} />
                          })}
                          {dayDeeds.length > 4 && (
                            <span className="font-mono text-[8px] leading-none text-parchment/40">+{dayDeeds.length - 4}</span>
                          )}
                        </div>
                      )}

                      {/* Wider screens: hairline chips */}
                      <div className="mt-1.5 hidden space-y-1 sm:block" aria-hidden="true">
                        {dayDeeds.slice(0, 3).map(deed => {
                          const pct = completionMap[deed.id] || 0
                          const done = pct >= 100
                          return (
                            <div key={deed.id} title={deed.title}
                              className={cx(
                                'truncate border-l-2 pl-1.5 text-caption leading-tight',
                                done ? 'border-moss text-parchment/45 line-through' : pct > 0 ? 'border-gold text-parchment/90' : 'border-parchment/15 text-parchment/60',
                              )}>
                              {deed.title}
                            </div>
                          )
                        })}
                        {dayDeeds.length > 3 && (
                          <div className="pl-2 font-mono text-[10px] text-parchment/40">+{dayDeeds.length - 3} more</div>
                        )}
                      </div>

                      {/* Google events — gold-dim chips (non-checkable) */}
                      {dayGoogle.length > 0 && (
                        <div className="mt-1 hidden space-y-1 sm:block" aria-hidden="true">
                          {dayGoogle.slice(0, 2).map((title, idx) => (
                            <div key={idx} title={title}
                              className="truncate rounded-sm border-l-2 border-gold-dim/60 bg-gold/[0.05] pl-1.5 text-caption leading-tight text-gold-dim">
                              {title}
                            </div>
                          ))}
                          {dayGoogle.length > 2 && (
                            <div className="pl-2 font-mono text-[10px] text-parchment/40">+{dayGoogle.length - 2} more</div>
                          )}
                        </div>
                      )}

                      {/* Progress hairline */}
                      {dayDeeds.length > 0 && (
                        <div className="absolute inset-x-2 bottom-1.5 hidden h-px overflow-hidden bg-parchment/10 sm:block" aria-hidden="true">
                          <div
                            className={cx('h-full transition-[width] duration-500 motion-reduce:transition-none', dayScore >= 80 ? 'bg-moss' : dayScore >= 50 ? 'bg-gold' : 'bg-ember')}
                            style={{ width: `${dayScore}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </Panel>
        </Section>

        {/* ── Day detail + milestones: beside the grid on desktop, below it on phones ── */}
        <div className="min-w-0 space-y-8 lg:space-y-6">
          <div ref={detailRef} className="scroll-mt-20">
            <Section
              title={selectedDay ? format(selectedDay, 'EEE, MMM d') : 'Day'}
              id="calendar-day"
              action={selectedDay ? <IconButton icon={X} label="Close day" onClick={closeDay} /> : undefined}
            >
              {selectedDay ? (
                <Panel>
                  <DayPanel
                    date={selectedDay}
                    deeds={getDeedsForDay(selectedDay)}
                    onClose={() => {
                      setSelectedDay(null)
                    }}
                    onRefresh={() => {
                      fetch('/api/items').then(r => r.json()).then(data => {
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
                    }}
                  />
                </Panel>
              ) : (
                <EmptyState title="No day selected" body="Pick a date on the grid to see its deeds and add new ones." />
              )}
            </Section>
          </div>

          {/* ── Monthly milestones ── */}
          {monthlyMilestones.length > 0 && (
            <Section title="Milestones" id="calendar-milestones" action={<Badge>{monthlyMilestones.length}</Badge>}>
              <Panel padded={false}>
                <ul className="divide-y divide-gold/[0.07]">
                  {monthlyMilestones.slice(0, 4).map((ms, i) => {
                    const pct = Math.round(completionMap[ms.id] || 0)
                    return (
                      <li key={ms.id} className="flex min-h-11 items-center gap-3 px-4 py-3">
                        <span aria-hidden="true" className="w-6 shrink-0 font-mono text-mono tabular-nums text-gold-dim">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="truncate text-body text-parchment/85">{ms.title}</p>
                          <Meter value={pct} tone="moss" label={`${ms.title} progress`} />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-mono tabular-nums text-parchment/50">{pct}%</span>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </Section>
          )}
        </div>
      </div>
    </Page>
  )
}
