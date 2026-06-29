'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Target, BarChart3, ListTodo
} from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, addDays
} from 'date-fns'
import { useHierarchyStore, Item, Task } from '@/store/hierarchyStore'
import { DayPanel } from '@/components/calendar/DayPanel'

export default function CalendarPage() {
  const { items, completionMap, setItems, setUserCategories } = useHierarchyStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

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
      if (data.categories) setUserCategories(data.categories)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [currentMonth, setItems, setUserCategories])

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
    const result: Item[] = []
    const collect = (nodes: Item[]) => {
      nodes.forEach(n => {
        if (n.layer === 3) result.push(n)
        if (n.children) collect(n.children)
      })
    }
    collect(items)
    return result
  }, [items])

  const monthlyMilestones = getMonthlyMilestones()
  const totalDeedCount = items.filter(i => i.layer === 5).length
  const completedDeedCount = items.filter(i => i.layer === 5 && (completionMap[i.id] || 0) >= 100).length

  const navigate = (dir: 'prev' | 'next') => {
    setCurrentMonth(dir === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1))
  }

  const goToToday = () => setCurrentMonth(new Date())

  if (loading) return <div className="flex items-center justify-center h-full"><span className="text-ink/60">Loading...</span></div>

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthLabel = format(currentMonth, 'MMMM yyyy')

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-72 bg-surface border-r border-mist p-4 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('prev')} className="p-2 hover:bg-mist rounded-full transition">
            <ChevronLeft className="w-5 h-5 text-ink/70" />
          </button>
          <h2 className="text-lg font-display font-bold text-ink">{monthLabel}</h2>
          <button onClick={() => navigate('next')} className="p-2 hover:bg-mist rounded-full transition">
            <ChevronRight className="w-5 h-5 text-ink/70" />
          </button>
        </div>

        <button onClick={goToToday} className="w-full py-2 mb-4 text-sm font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition">
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
                <div key={ms.id} className="px-2 py-1.5 rounded-lg bg-mist/20">
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
        <div className="flex items-center justify-between px-6 py-3 border-b border-mist bg-surface">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-display font-bold text-ink">{monthLabel}</h2>
            <div className="flex items-center space-x-1">
              <button onClick={() => navigate('prev')} className="p-2 hover:bg-mist rounded-full transition">
                <ChevronLeft className="w-5 h-5 text-ink/70" />
              </button>
              <button onClick={() => navigate('next')} className="p-2 hover:bg-mist rounded-full transition">
                <ChevronRight className="w-5 h-5 text-ink/70" />
              </button>
            </div>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition">
              Today
            </button>
          </div>
          <div className="text-sm text-ink/60">
            {totalDeedCount} deeds this month
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-ink/50 uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-mist/30 rounded-xl overflow-hidden border border-mist/30">
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
                  className={`min-h-[110px] bg-surface p-2 border-b border-r border-mist/20 transition-colors cursor-pointer hover:bg-mist/10 ${!inMonth ? 'opacity-40' : ''} ${isSelected ? 'ring-2 ring-gold ring-inset' : ''}`}
                  onClick={() => setSelectedDay(date)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${today ? 'bg-gold text-surface' : 'text-ink'}`}>
                      {format(date, 'd')}
                    </div>
                    {dayDeeds.length > 0 && (
                      <div className="text-[10px] font-mono text-ink/50">{dayCompleted}/{dayDeeds.length}</div>
                    )}
                  </div>

                  <div className="space-y-0.5">
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

                  {/* Mini progress bar */}
                  {dayDeeds.length > 0 && (
                    <div className="w-full h-1 bg-mist rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${dayScore >= 80 ? 'bg-sage' : dayScore >= 50 ? 'bg-gold' : 'bg-coral'
                          }`}
                        style={{ width: `${dayScore}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {selectedDay && (
        <DayPanel
          date={selectedDay}
          deeds={getDeedsForDay(selectedDay)}
          onClose={() => setSelectedDay(null)}
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