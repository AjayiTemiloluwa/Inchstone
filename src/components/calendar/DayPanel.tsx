'use client'

import { useState, useEffect } from 'react'
import { CalendarEvent, DayGoal } from './types'
import { format, addDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, getHours } from 'date-fns'
import { X, Target, FileText, ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, Circle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface DayPanelProps {
  date: Date
  events: CalendarEvent[]
  dayGoal: DayGoal | null
  reportText: string
  onClose: () => void
  onSetGoal: (goal: DayGoal | null) => void
  onUpdateReport: (text: string) => void
  onRefreshLocalEvents: () => void
}

export function DayPanel({ date, events, dayGoal, reportText, onClose, onSetGoal, onUpdateReport, onRefreshLocalEvents }: DayPanelProps) {
  const [showGoalPicker, setShowGoalPicker] = useState(false)
  const [goalTitle, setGoalTitle] = useState(dayGoal?.title || '')
  const [goalDesc, setGoalDesc] = useState(dayGoal?.description || '')
  const [report, setReport] = useState(reportText)
  const [currentMonth, setCurrentMonth] = useState(date)
  const [tasks, setTasks] = useState<CalendarEvent[]>([])
  const [dailyScore, setDailyScore] = useState<{ totalTasks: number, completedTasks: number, score: number } | null>(null)
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskTime, setNewTaskTime] = useState('')

  useEffect(() => {
    setReport(reportText)
    setGoalTitle(dayGoal?.title || '')
    setGoalDesc(dayGoal?.description || '')
    setCurrentMonth(date)
    fetchDayData()
  }, [date, reportText, dayGoal])

  const fetchDayData = async () => {
    try {
      const r = await fetch(`/api/daily-score?date=${date.toISOString()}`)
      const data = await r.json()
      if (data.tasks) {
        setTasks(data.tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          start: date.toISOString(),
          end: date.toISOString(),
          source: 'local' as const,
          type: 'task' as const,
          completed: t.completed,
          scheduledTime: t.scheduledTime,
          score: t.score,
        })))
      }
      if (data.dailyScore) setDailyScore(data.dailyScore)
    } catch { /* ignore */ }
  }

  const saveGoal = () => {
    if (!goalTitle.trim()) { onSetGoal(null) } else { onSetGoal({ itemId: dayGoal?.itemId || `goal-${date.toISOString()}`, title: goalTitle.trim(), description: goalDesc.trim() || undefined }) }
    setShowGoalPicker(false)
  }

  const handleReportChange = (val: string) => { setReport(val); onUpdateReport(val) }

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    try {
      await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, completed: !currentCompleted })
      })
      await fetchDayData()
      onRefreshLocalEvents()
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
      await fetchDayData()
      onRefreshLocalEvents()
    } catch (e) { console.error(e) }
  }

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return
    const ds = new Date(date); ds.setHours(0, 0, 0, 0)
    const de = new Date(ds); de.setDate(de.getDate() + 1)

    let scheduledTime: string | undefined
    if (newTaskTime) {
      const parts = newTaskTime.split(':')
      const hours = parseInt(parts[0] || '0', 10)
      const minutes = parseInt(parts[1] || '0', 10)
      const st = new Date(date)
      st.setHours(hours, minutes, 0, 0)
      scheduledTime = st.toISOString()
    }

    try {
      await fetch('/api/events', {
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
      setNewTaskText('')
      setNewTaskTime('')
      await fetchDayData()
      onRefreshLocalEvents()
    } catch (e) { console.error(e) }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = monthStart.getDay()
  const paddingDays = Array.from({ length: startDay }, (_, i) => i)
  const monthDates = [...paddingDays.map(i => addDays(monthStart, i - startDay)), ...calendarDays]
  while (monthDates.length < 42) monthDates.push(addDays(monthDates[monthDates.length - 1], 1))

  const getEventsForHour = (hour: number) => {
    return events.filter(e => {
      if (e.type === 'task') return false
      const start = new Date(e.start)
      const end = new Date(e.end)
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      if (start >= dayEnd || end <= dayStart) return false
      const slotStart = new Date(date)
      slotStart.setHours(hour, 0, 0, 0)
      const slotEnd = new Date(date)
      slotEnd.setHours(hour + 1, 0, 0, 0)
      return start < slotEnd && end > slotStart
    })
  }

  const completedTasks = tasks.filter(t => t.completed).length
  const totalTasks = tasks.length
  const scorePercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-mist">
          <div>
            <h2 className="text-2xl font-display font-bold text-ink">{format(date, 'EEEE, MMMM d, yyyy')}</h2>
            <p className="text-sm text-ink/60 mt-1">
              {isToday(date) ? 'Today' : ''}
              {totalTasks > 0 && ` • ${completedTasks}/${totalTasks} tasks done (${scorePercent}%)`}
              {events.filter(e => e.type !== 'task').length > 0 && ` • ${events.filter(e => e.type !== 'task').length} event(s)`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-mist rounded-full transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 border-r border-mist p-6">
              {/* Daily Score Bar */}
              {totalTasks > 0 && (
                <div className="mb-4 p-3 bg-mist/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-ink/60 uppercase">Daily Progress</span>
                    <span className="text-sm font-bold">{scorePercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-mist rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${scorePercent >= 80 ? 'bg-sage' : scorePercent >= 50 ? 'bg-gold' : 'bg-coral'
                        }`}
                      style={{ width: `${scorePercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-ink/40">
                    <span>{completedTasks} completed</span>
                    <span>{totalTasks - completedTasks} remaining</span>
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-ink mb-3 flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-sage" />
                  Tasks
                </h3>
                <div className="space-y-1">
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-center space-x-2 group py-1.5 px-2 rounded-lg hover:bg-mist/20 transition">
                      <button onClick={() => handleToggleTask(task.id!, task.completed!)} className="shrink-0">
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-sage" />
                        ) : (
                          <Circle className="w-5 h-5 text-ink/30 group-hover:text-gold transition" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${task.completed ? 'line-through text-ink/40' : 'text-ink'}`}>
                          {task.title}
                        </span>
                        {task.scheduledTime && (
                          <span className="ml-2 text-[10px] text-ink/40 font-mono">
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            {format(new Date(task.scheduledTime), 'h:mm a')}
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleDeleteTask(task.id!)} className="opacity-0 group-hover:opacity-100 p-1 text-ink/30 hover:text-coral transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Add task inline */}
                <div className="mt-2 flex items-center space-x-2">
                  <input
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    placeholder="Add a task..."
                    className="flex-1 px-3 py-2 bg-paper border border-mist rounded-lg text-sm focus:outline-none focus:border-gold"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddTask() }}
                  />
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={e => setNewTaskTime(e.target.value)}
                    className="px-2 py-2 bg-paper border border-mist rounded-lg text-sm w-24 focus:outline-none focus:border-gold"
                  />
                  <button onClick={handleAddTask} className="px-3 py-2 bg-gold text-surface rounded-lg text-sm font-medium hover:bg-gold/90 transition">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Hourly Activities (events only) */}
              <h3 className="text-lg font-bold text-ink mb-4 flex items-center"><Target className="w-5 h-5 mr-2 text-gold" />Hourly Activities</h3>
              {dayGoal ? (
                <div className="mb-4 p-3 bg-gold/10 border border-gold/30 rounded-lg">
                  <div className="text-xs font-mono text-gold uppercase mb-1">Day Goal</div>
                  <div className="font-bold text-ink">{dayGoal.title}</div>
                  {dayGoal.description && <div className="text-sm text-ink/70 mt-1">{dayGoal.description}</div>}
                </div>
              ) : (
                <button onClick={() => setShowGoalPicker(true)} className="w-full mb-4 py-2 border-2 border-dashed border-mist rounded-lg text-sm text-ink/50 hover:border-gold hover:text-gold transition">
                  <Plus className="w-4 h-4 inline mr-1" /> Set day goal
                </button>
              )}
              {showGoalPicker && (
                <div className="mb-4 p-3 border border-mist rounded-lg space-y-2">
                  <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="w-full px-3 py-2 bg-paper border border-mist rounded-lg text-sm focus:outline-none focus:border-gold" placeholder="Goal title..." />
                  <textarea value={goalDesc} onChange={e => setGoalDesc(e.target.value)} className="w-full px-3 py-2 bg-paper border border-mist rounded-lg text-sm focus:outline-none focus:border-gold h-16 resize-none" placeholder="Description (optional)..." />
                  <div className="flex space-x-2">
                    <button onClick={saveGoal} className="px-3 py-1 bg-gold text-surface rounded text-sm">Save</button>
                    <button onClick={() => setShowGoalPicker(false)} className="px-3 py-1 border border-mist rounded text-sm">Cancel</button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {hours.map(hour => {
                  const hourEvents = getEventsForHour(hour)
                  const isCurrentHour = isToday(date) && getHours(new Date()) === hour
                  return (
                    <div key={hour} className={`flex border-b border-mist/50 ${isCurrentHour ? 'bg-gold/5' : ''}`}>
                      <div className="w-16 shrink-0 py-3 pr-3 text-right text-xs font-mono text-ink/50">
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </div>
                      <div className="flex-1 py-2 min-h-[40px]">
                        {hourEvents.length === 0 ? (
                          <div className="h-full text-xs text-ink/20 italic">—</div>
                        ) : (
                          <div className="space-y-1">
                            {hourEvents.map(evt => (
                              <div key={evt.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${evt.source === 'google' ? 'bg-blue-50 border border-blue-200' : 'bg-gold/20 border border-gold/40'
                                }`}>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-ink truncate">{evt.title}</div>
                                  <div className="text-xs text-ink/50">
                                    {format(new Date(evt.start), 'h:mm a')} – {format(new Date(evt.end), 'h:mm a')}
                                  </div>
                                  {evt.description && <div className="text-xs text-ink/60 mt-1 line-clamp-2">{evt.description}</div>}
                                </div>
                                {evt.source === 'local' && (
                                  <button onClick={() => {
                                    fetch('/api/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: evt.id }) })
                                      .then(() => onRefreshLocalEvents())
                                  }} className="p-1 text-ink/30 hover:text-coral transition">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Calendar</h3>
                  <div className="flex space-x-1">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-mist rounded"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-mist rounded"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="text-sm font-bold text-ink mb-2">{format(currentMonth, 'MMMM yyyy')}</div>
                <div className="grid grid-cols-7 text-center text-xs text-ink/60 mb-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 text-center text-sm">
                  {monthDates.map((d, i) => {
                    const inMonth = isSameMonth(d, currentMonth)
                    const isSelected = isSameDay(d, date)
                    return (
                      <div key={i} className={`py-1.5 rounded-md transition ${!inMonth ? 'text-ink/20' : 'text-ink hover:bg-mist'
                        } ${isSelected ? 'bg-gold text-surface font-bold' : ''} ${isToday(d) && !isSelected ? 'text-gold font-bold' : ''}`}>
                        {d.getDate()}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-sage" />Daily Report
                </h3>
                <Card className="h-64">
                  <textarea
                    value={report}
                    onChange={e => handleReportChange(e.target.value)}
                    className="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-ink placeholder-ink/40"
                    placeholder={`Reflections for ${format(date, 'MMM d')}:\n- What went well?\n- What could be improved?\n- Key wins…`}
                  />
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}