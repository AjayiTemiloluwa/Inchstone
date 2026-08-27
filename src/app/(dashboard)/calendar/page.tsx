'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays
} from 'date-fns'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { DayPanel } from '@/components/ui/DayPanel'
import { CountUp, RevealLines } from '@/components/ui/motion'
import { Loader } from '@/components/ui/Loader'
import { Float } from '@/components/effects/fluid'

/* One editorial figure in the stat strip. */
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

export default function CalendarPage() {
  const { items, completionMap, setItems, getFlatItems } = useHierarchyStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const calendarRef = useRef<HTMLDivElement>(null)

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

  if (loading) return <Loader label="Spawning the calendar grid…" routeKey="calendar" />

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthLabel = format(currentMonth, 'MMMM yyyy')
  const notCurrentMonth = !isSameMonth(currentMonth, new Date())

  let activeDays = 0
  monthDates.forEach(d => {
    if (isSameMonth(d, currentMonth) && getDeedsForDay(d).length > 0) activeDays++
  })

  return (
    <div className="mx-auto max-w-[1100px] space-y-8 px-1 pb-28 pt-2 sm:pt-4">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="flex items-center justify-center py-1 transition-all">
          <Sparkles className={`h-5 w-5 ${pullDistance > 80 ? 'text-gold' : 'text-parchment/30'} ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

      {/* ── Meta strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-white/5 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-parchment/40">
          {monthLabel} · {totalDeedCount} deeds · {completedDeedCount} done
          {notCurrentMonth && <span className="text-gold"> · off-month</span>}
        </p>
        <div className="flex items-center gap-1.5 rounded-lg bg-black/20 border border-white/10 px-1.5 py-1">
          <button onClick={() => navigate('prev')} aria-label="Previous month"
            className="w-7 h-7 grid place-items-center rounded-md text-parchment/50 hover:text-parchment hover:bg-white/5 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={goToToday} title="Jump to today"
            className="min-w-[8.5rem] text-center text-xs font-mono text-parchment/80 tabular-nums transition-colors hover:text-parchment">
            {monthLabel}
          </button>
          <button onClick={() => navigate('next')} aria-label="Next month"
            className="w-7 h-7 grid place-items-center rounded-md text-parchment/50 hover:text-parchment hover:bg-white/5 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          {notCurrentMonth && (
            <button onClick={goToToday}
              className="ml-1 px-2 py-1 rounded-md bg-gold/15 border border-gold/30 text-[10px] font-bold uppercase tracking-wider text-gold hover:bg-gold/25 transition-colors">
              Today
            </button>
          )}
        </div>
      </div>

      {/* ── Hero: the month, set in type ── */}
      <header data-noreveal>
        <h1 className="font-display text-[clamp(2.7rem,7vw,4.9rem)] leading-[1.02] text-parchment">
          <RevealLines
            delay={80}
            fluid
            lines={[
              `${format(currentMonth, 'MMMM')}.`,
              format(currentMonth, 'yyyy'),
            ]}
          />
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span aria-hidden="true" className="h-px w-12 shrink-0 bg-gold/60" />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-parchment/50">
            {completionPct}% complete{notCurrentMonth ? ' — viewing another month' : ''}
          </p>
        </div>
      </header>

      {/* ── Figures strip ── */}
      <Float delay={0.5} duration={10} amp={6}>
        <section aria-label="Month figures" className="grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] py-6">
          <Stat label="Deeds" value={totalDeedCount} />
          <Stat label="Completed" value={completedDeedCount} suffix={`/${totalDeedCount}`} />
          <Stat label="Active days" value={activeDays} suffix={`/${calendarDays.length}`} />
        </section>
      </Float>

      {/* ── Monthly milestones ── */}
      {monthlyMilestones.length > 0 && (
        <Float delay={1} duration={11} amp={5}>
          <section aria-label="Monthly milestones">
            <h2 className="pb-3 font-mono text-[11px] uppercase tracking-[0.26em] text-parchment/40">
              Milestones
            </h2>
            <ul className="-mx-2">
              {monthlyMilestones.slice(0, 4).map((ms, i) => {
                const pct = Math.round(completionMap[ms.id] || 0)
                return (
                  <li key={ms.id}
                    className="flex items-center gap-3 border-b border-white/[0.04] px-2 py-2.5 last:border-b-0">
                    <span aria-hidden="true" className="w-7 shrink-0 font-mono text-xs tabular-nums text-gold-dim/80">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-parchment/85">{ms.title}</span>
                    <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-moss transition-all duration-700" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-parchment/45">{pct}%</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </Float>
      )}

      {/* ── The grid ── */}
      <Float delay={1.4} duration={12} amp={5}>
        <section aria-label="Calendar grid"
          ref={calendarRef}
          className="overflow-auto rounded-[10px] border border-white/[0.06]"
          data-lenis-prevent
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {weekDays.map(d => (
              <div key={d} className="py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/35">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>

          {/* Cells */}
          <div key={format(currentMonth, 'yyyy-MM')} className="grid grid-cols-7">
            {monthDates.map((date, i) => {
              const inMonth = isSameMonth(date, currentMonth)
              const isSelected = selectedDay && isSameDay(date, selectedDay)
              const today = isToday(date)
              const dayDeeds = getDeedsForDay(date)
              const dayCompleted = dayDeeds.filter(d => (completionMap[d.id] || 0) >= 100).length
              const dayScore = dayDeeds.length > 0
                ? Math.round(dayDeeds.reduce((sum, d) => sum + (completionMap[d.id] || 0), 0) / dayDeeds.length)
                : 0

              return (
                <div
                  key={i}
                  style={{ animationDelay: `${Math.min(i * 12, 380)}ms` }}
                  className={`cal-pop group relative min-h-[56px] border-b border-r border-white/[0.04] bg-black/10 p-1.5 transition-colors sm:min-h-[84px] sm:p-2 lg:min-h-[112px] ${i % 7 === 6 ? 'border-r-0' : ''
                    } cursor-pointer hover:bg-white/[0.05] ${!inMonth ? 'opacity-35' : ''} ${isSelected ? 'bg-gold/[0.08]' : ''}`}
                  onClick={() => setSelectedDay(date)}
                >
                  {isSelected && <span aria-hidden="true" className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold" />}

                  <div className="flex items-start justify-between">
                    <span className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] tabular-nums sm:h-7 sm:w-7 sm:text-xs ${today ? 'bg-gold font-bold text-ink' : isSelected ? 'text-gold' : 'text-parchment/75'
                      }`}>
                      {format(date, 'd')}
                    </span>
                    {dayDeeds.length > 0 && (
                      <span className="hidden font-mono text-[10px] tabular-nums text-parchment/40 sm:block">
                        {dayCompleted}/{dayDeeds.length}
                      </span>
                    )}
                  </div>

                  {/* Mobile dots */}
                  {dayDeeds.length > 0 && (
                    <div className="mt-1 flex min-h-[6px] flex-wrap items-center gap-1 sm:hidden">
                      {dayDeeds.slice(0, 4).map(deed => {
                        const pct = completionMap[deed.id] || 0
                        return <span key={deed.id} className={`h-1.5 w-1.5 rounded-full ${pct >= 100 ? 'bg-moss' : pct > 0 ? 'bg-gold' : 'bg-white/20'}`} />
                      })}
                      {dayDeeds.length > 4 && (
                        <span className="font-mono text-[8px] leading-none text-parchment/40">+{dayDeeds.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Desktop chips — hairline rows */}
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {dayDeeds.slice(0, 3).map(deed => {
                      const pct = completionMap[deed.id] || 0
                      const done = pct >= 100
                      return (
                        <div key={deed.id} title={deed.title}
                          className={`truncate rounded-[4px] border-l-2 bg-white/[0.03] px-1.5 py-0.5 text-[11px] leading-tight ${done
                            ? 'border-moss text-parchment/50 line-through'
                            : pct > 0
                              ? 'border-gold text-parchment'
                              : 'border-white/15 text-parchment/55'
                            }`}>
                          {deed.title}
                        </div>
                      )
                    })}
                    {dayDeeds.length > 3 && (
                      <div className="pl-1 text-[10px] text-parchment/35">+{dayDeeds.length - 3} more</div>
                    )}
                    {dayDeeds.length === 0 && inMonth && (
                      <div className="pl-1 text-[10px] text-parchment/20">—</div>
                    )}
                  </div>

                  {/* Progress hairline */}
                  {dayDeeds.length > 0 && (
                    <div className="absolute inset-x-1.5 bottom-1 hidden h-px overflow-hidden bg-white/10 sm:block">
                      <div
                        className={`h-full transition-all duration-500 ${dayScore >= 80 ? 'bg-moss' : dayScore >= 50 ? 'bg-gold' : 'bg-ember'}`}
                        style={{ width: `${dayScore}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </Float>

      <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/30">
        Select a day to open its deeds · swipe months on touch
      </p>

      {selectedDay && (
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
      )}
    </div>
  )
}