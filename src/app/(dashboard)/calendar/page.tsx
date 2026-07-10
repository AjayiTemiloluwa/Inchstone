'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Target, BarChart3, ListTodo, Sparkles
} from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays
} from 'date-fns'
import { useHierarchyStore, Item } from '@/stores/hierarchyStore'
import { DayPanel } from '@/components/ui/DayPanel'

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

  // Get monthly milestone for this month
  const getMonthlyMilestones = useCallback((): Item[] => {
    const flatItems = getFlatItems()
    return flatItems.filter(n => n.layer === 3)
  }, [getFlatItems])

  const flatItems = getFlatItems()
  const monthlyMilestones = getMonthlyMilestones()
  const totalDeedCount = flatItems.filter(i => i.layer === 5).length
  const completedDeedCount = flatItems.filter(i => i.layer === 5 && (completionMap[i.id] || 0) >= 100).length

  const navigate = (dir: 'prev' | 'next') => {
    setCurrentMonth(dir === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1))
  }

  const goToToday = () => setCurrentMonth(new Date())

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    window.location.reload()
  }

  // Swipe gesture handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (calendarRef.current && calendarRef.current.scrollTop === 0) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !calendarRef.current) return

    const touchY = e.touches[0].clientY
    const diff = touchY - touchStart.y

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

    // Pull to refresh
    if (pullDistance > 80) {
      handleRefresh()
    }
    // Horizontal swipe navigation
    else if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        navigate('next')
      } else {
        navigate('prev')
      }
    }

    setTouchStart(null)
    setPullDistance(0)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><span className="text-ink/60">Loading...</span></div>

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthLabel = format(currentMonth, 'MMMM yyyy')

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="lg:hidden flex items-center justify-center py-2 transition-all">
          <div className={`transition-all duration-200 ${pullDistance > 80 ? 'text-gold' : 'text-ink/30'}`}>
            <Sparkles className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}

      {/* Mobile Month Navigator - sticky header on mobile */}
      <div className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-mist bg-surface/95 backdrop-blur-sm">
        <button
          onClick={() => navigate('prev')}
          className="p-2.5 -ml-2 active:scale-90 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-6 h-6 text-ink/70" />
        </button>
        <div className="text-center flex-1">
          <h2 className="text-lg font-display font-bold text-ink">{monthLabel}</h2>
          <button
            onClick={goToToday}
            className="text-xs text-gold font-semibold mt-0.5 active:opacity-70 transition px-3 py-1 rounded-full hover:bg-gold/10"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigate('next')}
          className="p-2.5 -mr-2 active:scale-90 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Next month"
        >
          <ChevronRight className="w-6 h-6 text-ink/70" />
        </button>
      </div>

      {/* Left sidebar - desktop only */}
      <div className="hidden lg:flex w-72 bg-surface border-r border-mist p-4 flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('prev')} className="p-2 hover:bg-mist rounded-full transition active:scale-90">
            <ChevronLeft className="w-5 h-5 text-ink/70" />
          </button>
          <h2 className="text-lg font-display font-bold text-ink">{monthLabel}</h2>
          <button onClick={() => navigate('next')} className="p-2 hover:bg-mist rounded-full transition active:scale-90">
            <ChevronRight className="w-5 h-5 text-ink/70" />
          </button>
        </div>

        <button onClick={goToToday} className="w-full py-2 mb-4 text-sm font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition active:scale-95">
          Today
        </button>

        {/* Monthly Milestones */}
        <div className="border-t border-mist pt-4 mb-4">
          <h3 className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-3 flex items-center">
            <Target className="w-3.5 h-3.5 mr-1.5" />
            Monthly Milestones
          </h3>
          {monthlyMilestones.length === 0 ? (
            <p className="text-xs text-ink/40 px-2">No milestones this month</p>
          ) : (
            <div className="space-y-2">
              {monthlyMilestones.map(ms => (
                <div key={ms.id} className="px-2 py-1.5 rounded-lg bg-mist/20 active:bg-mist/30 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-ink truncate">{ms.title}</span>
                    <span className="text-[10px] font-mono text-ink/50 ml-2">
                      {Math.round(completionMap[ms.id] || 0)}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-mist rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-sage rounded-full transition-all"
                      style={{ width: `${completionMap[ms.id] || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="border-t border-mist pt-4">
          <h3 className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-3 flex items-center">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
            This Month
          </h3>
          <div className="space-y-1 text-xs text-ink/60 px-2">
            <div className="flex justify-between">
              <span>Total Deeds</span>
              <span className="font-medium">{totalDeedCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Completed</span>
              <span className="font-medium text-sage">{completedDeedCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Completion</span>
              <span className="font-medium">
                {totalDeedCount > 0 ? Math.round((completedDeedCount / totalDeedCount) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main calendar area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between px-4 sm:px-6 py-3 border-b border-mist bg-surface">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-display font-bold text-ink">{monthLabel}</h2>
            <div className="flex items-center space-x-1">
              <button onClick={() => navigate('prev')} className="p-2 hover:bg-mist rounded-full transition active:scale-90">
                <ChevronLeft className="w-5 h-5 text-ink/70" />
              </button>
              <button onClick={() => navigate('next')} className="p-2 hover:bg-mist rounded-full transition active:scale-90">
                <ChevronRight className="w-5 h-5 text-ink/70" />
              </button>
            </div>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition active:scale-95">
              Today
            </button>
          </div>
          <div className="text-sm text-ink/60">
            {totalDeedCount} deeds this month
          </div>
        </div>

        {/* Mobile stats bar */}
        <div className="lg:hidden px-4 py-2 bg-surface/50 border-b border-mist/50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-ink/50">Total:</span>
                <span className="font-semibold ml-1">{totalDeedCount}</span>
              </div>
              <div>
                <span className="text-ink/50">Done:</span>
                <span className="font-semibold ml-1 text-sage">{completedDeedCount}</span>
              </div>
              <div>
                <span className="text-ink/50">Score:</span>
                <span className="font-semibold ml-1 text-gold">
                  {totalDeedCount > 0 ? Math.round((completedDeedCount / totalDeedCount) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar grid with swipe and pull-to-refresh support */}
        <div
          ref={calendarRef}
          className="flex-1 overflow-auto p-2 sm:p-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile-optimized: full width, minimal padding */}
          <div className="w-full min-w-0 lg:min-w-[480px]">
            <div className="grid grid-cols-7 mb-1 lg:mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-center text-[10px] lg:text-xs font-semibold text-ink/50 uppercase tracking-wider py-1.5 lg:py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 lg:gap-px bg-mist/30 rounded-xl lg:rounded-2xl overflow-hidden border border-mist/30">
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
                    className={`
                      min-h-[60px] lg:min-h-[110px] bg-surface p-1 lg:p-2 border-b border-r border-mist/20
                      transition-all duration-200 cursor-pointer
                      active:scale-95 active:bg-mist/20 touch-manipulation
                      ${!inMonth ? 'opacity-30 lg:opacity-40' : ''}
                      ${isSelected ? 'ring-2 ring-gold ring-inset bg-gold/5' : ''}
                      hover:bg-mist/10 lg:hover:bg-mist/10
                    `}
                    onClick={() => setSelectedDay(date)}
                  >
                    <div className="flex items-start justify-between mb-0.5 lg:mb-1">
                      <div className={`
                        text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                        active:scale-110 transition-transform
                        ${today ? 'bg-gold text-surface' : 'text-ink'}
                      `}>
                        {format(date, 'd')}
                      </div>
                      {dayDeeds.length > 0 && (
                        <div className="text-[10px] font-mono text-ink/50">{dayCompleted}/{dayDeeds.length}</div>
                      )}
                    </div>

                    {/* Mobile: show only 2 items, Desktop: show 3 */}
                    <div className="space-y-0.5 hidden sm:block">
                      {dayDeeds.slice(0, 3).map(deed => {
                        const pct = completionMap[deed.id] || 0
                        const tasks = deed.tasks || []
                        const taskDone = tasks.filter(t => t.completed).length

                        return (
                          <div
                            key={deed.id}
                            className={`text-[11px] px-1.5 py-0.5 rounded truncate flex items-center space-x-1 ${pct >= 100
                              ? 'bg-sage/20 text-sage border-l-2 border-sage'
                              : pct > 0
                                ? 'bg-gold/20 text-ink border-l-2 border-gold'
                                : 'bg-mist/30 text-ink/60 border-l-2 border-mist'
                              }`}
                            title={deed.title}
                          >
                            {pct >= 100 ? (
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                            ) : (
                              <Circle className="w-3 h-3 shrink-0" />
                            )}
                            <span className="truncate">{deed.title}</span>
                            {tasks.length > 0 && (
                              <span className="text-[9px] opacity-60 shrink-0">({taskDone}/{tasks.length})</span>
                            )}
                          </div>
                        )
                      })}
                      {dayDeeds.length > 3 && (
                        <div className="text-[10px] text-ink/50 pl-1.5">+{dayDeeds.length - 3} more</div>
                      )}
                      {dayDeeds.length === 0 && inMonth && (
                        <div className="text-[10px] text-ink/20 pl-1.5">No deeds</div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {dayDeeds.length > 0 && (
                      <div className="w-full h-1 bg-mist rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${dayScore >= 80 ? 'bg-sage' : dayScore >= 50 ? 'bg-gold' : 'bg-coral'
                            }`}
                          style={{ width: `${dayScore}%` }}
                        />
                      </div>
                    )}

                    {/* Mobile: show count badge if deeds exist */}
                    {dayDeeds.length > 0 && (
                      <div className="sm:hidden mt-0.5">
                        <span className="text-[9px] font-mono text-ink/50">
                          {dayCompleted}/{dayDeeds.length}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

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