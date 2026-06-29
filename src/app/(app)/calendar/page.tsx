'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon,
  ListTodo, ListChecks, Plus, Trash2, CheckCircle2, Circle, Clock,
  ExternalLink, Eye, EyeOff
} from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, getHours,
  parse, startOfWeek, addDays
} from 'date-fns'
import { CalendarEvent, DayGoal } from '@/components/calendar/types'
import { DayPanel } from '@/components/calendar/DayPanel'

type ViewMode = 'events' | 'tasks'

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('events')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayGoals, setDayGoals] = useState<Map<string, DayGoal>>(new Map())
  const [dayReports, setDayReports] = useState<Map<string, string>>(new Map())
  const [tasks, setTasks] = useState<Map<string, CalendarEvent[]>>(new Map())
  const [dailyScores, setDailyScores] = useState<Map<string, { totalTasks: number, completedTasks: number, score: number }>>(new Map())
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskTime, setNewTaskTime] = useState('')
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null)
  const [showGoogle, setShowGoogle] = useState(true)
  const [showLocal, setShowLocal] = useState(true)
  const [showTasks, setShowTasks] = useState(true)

  // Calendar data for the month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = monthStart.getDay()
  const paddingDays = Array.from({ length: startDay }, (_, i) => addDays(monthStart, i - startDay))
  const monthDates = [...paddingDays, ...calendarDays]
  while (monthDates.length < 42) {
    monthDates.push(addDays(monthDates[monthDates.length - 1], 1))
  }

  // Google Calendar auth check
  useEffect(() => {
    fetch('/api/calendar/events?timeMin=2000-01-01T00:00:00Z&timeMax=2100-01-01T00:00:00Z')
      .then(r => r.json()).then(d => {
        if (d.needsAuth) setGoogleConnected(false)
        else { setGoogleConnected(true); setEvents(d.events || []) }
        setCheckingAuth(false)
      }).catch(() => { setGoogleConnected(false); setCheckingAuth(false) })
  }, [])

  const fetchGoogleEvents = useCallback(async () => {
    if (!googleConnected) return
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const r = await fetch(`/api/calendar/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`)
    const d = await r.json()
    if (!d.needsAuth) {
      setEvents(p => {
        const local = p.filter(e => e.source !== 'google')
        const google = (d.events || []).map((e: any) => ({
          id: e.id || `g-${Date.now()}`,
          title: e.summary || '(No title)',
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          source: 'google' as const,
          description: e.description || ''
        }))
        return [...local, ...google].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      })
      setGoogleConnected(true)
    }
  }, [currentMonth, googleConnected])

  const fetchLocalEvents = useCallback(async () => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const r = await fetch(`/api/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
    const d = await r.json()
    if (d.events) {
      const local: CalendarEvent[] = d.events
        .filter((e: any) => e.type !== 'task')
        .map((e: any) => ({
          id: e.id, title: e.title, start: e.startTime, end: e.endTime,
          source: 'local' as const, description: e.comment || '',
          type: e.type || 'event'
        }))
      const taskEvents: CalendarEvent[] = d.events
        .filter((e: any) => e.type === 'task')
        .map((e: any) => ({
          id: e.id, title: e.title, start: e.startTime, end: e.endTime,
          source: 'local' as const, type: 'task', completed: e.completed,
          scheduledTime: e.scheduledTime, score: e.score
        }))
      setEvents(p => [...p.filter(e => e.source !== 'local'), ...local].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()))
      // Group tasks by date
      const taskMap = new Map<string, CalendarEvent[]>()
      taskEvents.forEach(t => {
        const key = format(new Date(t.start), 'yyyy-MM-dd')
        const existing = taskMap.get(key) || []
        existing.push(t)
        taskMap.set(key, existing)
      })
      setTasks(taskMap)
    }
  }, [currentMonth])

  useEffect(() => {
    if (googleConnected) fetchGoogleEvents()
    fetchLocalEvents()
  }, [currentMonth, googleConnected, fetchGoogleEvents, fetchLocalEvents])

  // Fetch daily scores for visible month
  useEffect(() => {
    const fetchScores = async () => {
      const promises = monthDates.map(async (d) => {
        const key = format(d, 'yyyy-MM-dd')
        try {
          const r = await fetch(`/api/daily-score?date=${d.toISOString()}`)
          const data = await r.json()
          if (data.dailyScore) {
            return { key, score: data.dailyScore }
          }
        } catch { /* ignore */ }
        return { key, score: null }
      })
      const results = await Promise.all(promises)
      const scoreMap = new Map<string, { totalTasks: number, completedTasks: number, score: number }>()
      results.forEach(r => { if (r.score) scoreMap.set(r.key, r.score) })
      setDailyScores(scoreMap)
    }
    fetchScores()
  }, [currentMonth, tasks])

  const navigate = (dir: 'prev' | 'next') => {
    setCurrentMonth(dir === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1))
  }

  const goToToday = () => setCurrentMonth(new Date())

  const connectGoogle = () => {
    // Fetch auth URL from server then redirect
    fetch('/api/calendar/auth')
      .then(r => r.json())
      .then(data => {
        if (data.url) window.location.href = data.url
      })
      .catch(console.error)
  }

  const disconnectGoogle = async () => {
    if (!confirm('Disconnect Google Calendar?')) return
    await fetch('/api/calendar/disconnect', { method: 'POST' })
    setGoogleConnected(false)
    setEvents(p => p.filter(e => e.source !== 'google'))
  }

  const getVisibleEventsForDay = useCallback((date: Date) => {
    return events.filter(e => {
      if (e.source === 'google' && !showGoogle) return false
      if (e.source === 'local' && !showLocal) return false
      if (e.type === 'task' && !showTasks) return false
      const s = new Date(e.start), en = new Date(e.end)
      const ds = new Date(date); ds.setHours(0, 0, 0, 0)
      const de = new Date(ds); de.setDate(de.getDate() + 1)
      return s < de && en > ds
    })
  }, [events, showGoogle, showLocal, showTasks])

  const getTasksForDay = (date: Date): CalendarEvent[] => {
    const key = format(date, 'yyyy-MM-dd')
    return tasks.get(key) || []
  }

  const handleAddTask = async (date: Date) => {
    if (!newTaskText.trim()) return
    const ds = new Date(date); ds.setHours(0, 0, 0, 0)
    const de = new Date(ds); de.setDate(de.getDate() + 1)

    let scheduledTime: string | undefined
    if (newTaskTime) {
      const [hours, minutes] = newTaskTime.split(':')
      const st = new Date(date)
      st.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      scheduledTime = st.toISOString()
    }

    try {
      const r = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskText.trim(),
          startTime: ds.toISOString(),
          endTime: de.toISOString(),
          type: 'task',
          scheduledTime,
        })
      })
      const data = await r.json()
      if (data.success) {
        setNewTaskText('')
        setNewTaskTime('')
        setAddingTaskFor(null)
        await fetchLocalEvents()
      }
    } catch (e) { console.error(e) }
  }

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    try {
      await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, completed: !currentCompleted })
      })
      await fetchLocalEvents()
    } catch (e) { console.error(e) }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    try {
      await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId })
      })
      await fetchLocalEvents()
    } catch (e) { console.error(e) }
  }

  const handleAddEvent = async (date: Date) => {
    const title = prompt('Event title:')
    if (!title) return
    const ds = new Date(date); ds.setHours(9, 0, 0, 0)
    const de = new Date(date); de.setHours(10, 0, 0, 0)
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, startTime: ds.toISOString(), endTime: de.toISOString(), type: 'event' })
      })
      await fetchLocalEvents()
    } catch (e) { console.error(e) }
  }

  const openDayPanel = (date: Date) => setSelectedDay(date)
  const updateDayReport = (date: Date, text: string) => setDayReports(p => { const n = new Map(p); n.set(format(date, 'yyyy-MM-dd'), text); return n })
  const loadDayReport = (date: Date) => dayReports.get(format(date, 'yyyy-MM-dd')) || ''
  const getDayGoalFor = (date: Date): DayGoal | null => dayGoals.get(format(date, 'yyyy-MM-dd')) || null
  const setDayGoal = (date: Date, goal: DayGoal | null) => {
    const k = format(date, 'yyyy-MM-dd')
    if (goal) setDayGoals(p => { const n = new Map(p); n.set(k, goal); return n })
    else { const n = new Map(dayGoals); n.delete(k); setDayGoals(n) }
  }

  if (checkingAuth) return <div className="flex items-center justify-center h-full"><span className="text-ink/60">Loading calendar...</span></div>

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthLabel = format(currentMonth, 'MMMM yyyy')

  const dayScoreColor = (score: number) => {
    if (score >= 80) return 'bg-sage/20 text-sage border-sage/40'
    if (score >= 50) return 'bg-gold/20 text-gold border-gold/40'
    if (score > 0) return 'bg-coral/20 text-coral border-coral/40'
    return ''
  }

  const ToggleSwitch = ({ label, checked, onChange, color }: { label: string; checked: boolean; onChange: (v: boolean) => void; color: string }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center space-x-2 w-full px-3 py-2 rounded-lg text-sm transition ${checked ? `${color} font-medium` : 'text-ink/50 hover:text-ink'
        }`}
    >
      <div className={`w-8 h-4 rounded-full relative transition-colors ${checked ? 'bg-gold' : 'bg-mist'}`}>
        <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span>{label}</span>
      <span className="ml-auto text-xs">{checked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</span>
    </button>
  )

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-72 bg-surface border-r border-mist p-4 flex flex-col shrink-0 overflow-y-auto">
        {/* Month navigation */}
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

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-mist overflow-hidden mb-4">
          <button
            onClick={() => setViewMode('events')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 text-sm font-medium transition ${viewMode === 'events' ? 'bg-gold text-surface' : 'bg-surface text-ink hover:bg-mist'
              }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Events</span>
          </button>
          <button
            onClick={() => setViewMode('tasks')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 text-sm font-medium transition ${viewMode === 'tasks' ? 'bg-gold text-surface' : 'bg-surface text-ink hover:bg-mist'
              }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>Tasks</span>
          </button>
        </div>

        {/* Source toggles */}
        <div className="border-t border-mist pt-4 space-y-1">
          <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-2 px-3">Show Sources</p>
          <ToggleSwitch
            label="Google Calendar"
            checked={showGoogle}
            onChange={setShowGoogle}
            color="text-blue-600"
          />
          <ToggleSwitch
            label="Local Events"
            checked={showLocal}
            onChange={setShowLocal}
            color="text-gold"
          />
          <ToggleSwitch
            label="Tasks"
            checked={showTasks}
            onChange={setShowTasks}
            color="text-sage"
          />
        </div>

        {/* Google Calendar connect */}
        <div className="mt-4 border-t border-mist pt-4 space-y-2">
          {!googleConnected ? (
            <>
              <p className="text-xs text-ink/60 px-3">Connect to see your real Google Calendar events</p>
              <button onClick={connectGoogle} className="w-full py-2 text-sm font-medium text-white bg-[#4285F4] rounded-lg hover:opacity-90 transition flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                <span>Connect Google Calendar</span>
              </button>
            </>
          ) : (
            <div className="space-y-2 px-3">
              <div className="flex items-center space-x-2 text-xs text-sage">
                <div className="w-2 h-2 rounded-full bg-sage animate-pulse" />
                <span className="font-medium">Google Calendar connected</span>
              </div>
              <div className="flex space-x-2">
                <button onClick={fetchGoogleEvents} className="flex-1 flex items-center justify-center space-x-1 py-1.5 text-xs border border-mist rounded-lg hover:bg-mist transition">
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
                <button onClick={disconnectGoogle} className="flex-1 py-1.5 text-xs text-coral border border-coral/30 rounded-lg hover:bg-coral/10 transition">
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main calendar area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Month header */}
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
          <div className="flex items-center space-x-3 text-sm">
            <span className="text-ink/60">{viewMode === 'events' ? 'Calendar Events' : 'Daily Tasks'}</span>
            {/* Active filters indicator */}
            <div className="flex space-x-1">
              {!showGoogle && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">G off</span>}
              {!showLocal && <span className="text-[10px] px-1.5 py-0.5 bg-gold/20 text-ink rounded">L off</span>}
              {!showTasks && <span className="text-[10px] px-1.5 py-0.5 bg-sage/20 text-sage-700 rounded">T off</span>}
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-ink/50 uppercase tracking-wider py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-px bg-mist/30 rounded-xl overflow-hidden border border-mist/30">
            {monthDates.map((date, i) => {
              const key = format(date, 'yyyy-MM-dd')
              const inMonth = isSameMonth(date, currentMonth)
              const isSelected = selectedDay && isSameDay(date, selectedDay)
              const today = isToday(date)
              const dayEvents = getVisibleEventsForDay(date)
              const dayTasks = getTasksForDay(date)
              const score = dailyScores.get(key)
              const isAdding = addingTaskFor === key

              return (
                <div
                  key={i}
                  className={`min-h-[120px] bg-surface p-2 border-b border-r border-mist/20 transition-colors cursor-pointer hover:bg-mist/10 ${!inMonth ? 'opacity-40' : ''
                    } ${isSelected ? 'ring-2 ring-gold ring-inset' : ''}`}
                  onClick={() => !isAdding && openDayPanel(date)}
                >
                  {/* Date header */}
                  <div className="flex items-start justify-between mb-1">
                    <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${today ? 'bg-gold text-surface' : 'text-ink'
                      }`}>
                      {format(date, 'd')}
                    </div>
                    {/* Daily score indicator for tasks mode */}
                    {viewMode === 'tasks' && score && score.totalTasks > 0 && (
                      <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${dayScoreColor(score.score)}`}>
                        {score.score}%
                      </div>
                    )}
                  </div>

                  {viewMode === 'events' ? (
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(evt => (
                        <div
                          key={evt.id}
                          className={`text-[11px] px-1.5 py-0.5 rounded truncate ${evt.source === 'google'
                              ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500'
                              : evt.type === 'task'
                                ? 'bg-sage/20 text-sage-700 border-l-2 border-sage'
                                : 'bg-gold/20 text-ink border-l-2 border-gold'
                            }`}
                          title={evt.title}
                        >
                          {evt.source === 'google' && format(new Date(evt.start), 'h:mm') + ' '}
                          {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-ink/50 pl-1.5">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                      {dayEvents.length === 0 && (
                        <div className="text-[10px] text-ink/20 pl-1.5" onClick={(e) => { e.stopPropagation(); handleAddEvent(date) }}>
                          + Add event
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {isAdding ? (
                        <div className="space-y-1" onClick={e => e.stopPropagation()}>
                          <input
                            value={newTaskText}
                            onChange={e => setNewTaskText(e.target.value)}
                            placeholder="Task..."
                            className="w-full text-[11px] px-1.5 py-1 bg-paper border border-mist rounded focus:outline-none focus:border-gold"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleAddTask(date); if (e.key === 'Escape') { setAddingTaskFor(null); setNewTaskText(''); setNewTaskTime('') } }}
                          />
                          <div className="flex items-center space-x-1">
                            <input
                              type="time"
                              value={newTaskTime}
                              onChange={e => setNewTaskTime(e.target.value)}
                              className="text-[10px] px-1 py-0.5 bg-paper border border-mist rounded w-16 focus:outline-none focus:border-gold"
                            />
                            <button onClick={() => handleAddTask(date)} className="text-[10px] px-1.5 py-0.5 bg-gold text-surface rounded">Add</button>
                            <button onClick={() => { setAddingTaskFor(null); setNewTaskText(''); setNewTaskTime('') }} className="text-[10px] px-1.5 py-0.5 text-ink/50 hover:text-ink">X</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {dayTasks.slice(0, 3).map(task => (
                            <div
                              key={task.id}
                              className="flex items-center space-x-1 group"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleToggleTask(task.id!, task.completed!)}
                                className="shrink-0"
                              >
                                {task.completed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-sage" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 text-ink/40 group-hover:text-gold" />
                                )}
                              </button>
                              <span className={`text-[11px] flex-1 truncate ${task.completed ? 'line-through text-ink/40' : 'text-ink'}`}>
                                {task.scheduledTime && format(new Date(task.scheduledTime), 'h:mm') + ' '}
                                {task.title}
                              </span>
                              <button
                                onClick={() => handleDeleteTask(task.id!)}
                                className="opacity-0 group-hover:opacity-100 text-ink/30 hover:text-coral transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-[10px] text-ink/50 pl-5">
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                          {dayTasks.length === 0 && (
                            <div
                              className="text-[10px] text-ink/20 pl-1.5 hover:text-gold"
                              onClick={e => { e.stopPropagation(); setAddingTaskFor(key); setNewTaskText(''); setNewTaskTime('') }}
                            >
                              + Add task
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Day Panel */}
      {selectedDay && (
        <DayPanel
          date={selectedDay}
          events={getVisibleEventsForDay(selectedDay)}
          dayGoal={getDayGoalFor(selectedDay)}
          reportText={loadDayReport(selectedDay)}
          onClose={() => setSelectedDay(null)}
          onSetGoal={(g) => setDayGoal(selectedDay, g)}
          onUpdateReport={(t) => updateDayReport(selectedDay, t)}
          onRefreshLocalEvents={fetchLocalEvents}
        />
      )}
    </div>
  )
}