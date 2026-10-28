'use client'

import { useHierarchyStore } from '@/stores/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Task } from '@/stores/hierarchyStore'

/** Scheduled length of a deed in minutes (start/end gap, else its estimate). */
function taskMinutes(t: Task): number {
  if (t.startTime && t.endTime) {
    const diff = (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 60000
    if (Number.isFinite(diff) && diff > 0) return diff
  }
  return t.estimatedDuration && t.estimatedDuration > 0 ? t.estimatedDuration : 0
}

function formatHours(minutes: number): string {
  const h = minutes / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
}

export default function WeekPage() {
  const { completionMap, getFlatItems } = useHierarchyStore()

  const [today] = useState(() => new Date())
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = addDays(startOfWeek(today), weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const flatItems = getFlatItems()
  // Layer 5 = Weekly Goals
  const weeklyGoals = flatItems.filter(i => i.layer === 5)
  // Layer 6 = Daily Goals
  const dailyGoals = flatItems.filter(i => i.layer === 6)

  // Calculate week overall progress (average of weekly goals, or based on their weights)
  const totalWeeklyWeight = weeklyGoals.reduce((sum, g) => sum + g.weight, 0)
  const earnedWeeklyScore = weeklyGoals.reduce((sum, g) => sum + (g.weight * ((completionMap[g.id] || 0) / 100)), 0)
  const weekProgress = totalWeeklyWeight > 0 ? (earnedWeeklyScore / totalWeeklyWeight) * 100 : 0

  // Real time totals from the deeds on this week's daily goals
  const weekTasks = weekDays.flatMap(date =>
    dailyGoals
      .filter(g => g.startDate && isSameDay(new Date(g.startDate), date))
      .flatMap(g => g.tasks || [])
  )
  const plannedMinutes = weekTasks.reduce((sum, t) => sum + taskMinutes(t), 0)
  const completedMinutes = weekTasks.filter(t => t.completed).reduce((sum, t) => sum + taskMinutes(t), 0)
  const completedCount = weekTasks.filter(t => t.completed).length
  const hasDurations = plannedMinutes > 0

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-mist pb-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink">Week View</h1>
          <div className="flex flex-wrap items-center gap-1 text-ink/60">
            <button onClick={() => setWeekOffset(o => o - 1)} aria-label="Previous week" className="p-2 -ml-2 rounded-lg hover:bg-ink/5 min-h-9 min-w-9 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            <p>{format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'MMMM d, yyyy')}</p>
            <button onClick={() => setWeekOffset(o => o + 1)} aria-label="Next week" className="p-2 rounded-lg hover:bg-ink/5 min-h-9 min-w-9 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="ml-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-mist text-ink hover:bg-ink/5">This week</button>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-1">Weekly Score</p>
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-mono">{Math.round(weekProgress)}%</span>
            <ProgressRing progress={weekProgress} size={48} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        
        {/* Left column: Weekly Goals & Breakdown */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-bold font-display">Weekly Goals</h2>
          <Card className="p-4 space-y-4">
            {weeklyGoals.map(goal => {
              const score = completionMap[goal.id] || 0
              return (
                <div key={goal.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-ink min-w-0 break-words pr-2">{goal.title}</span>
                    <span className="font-mono text-ink/70">{Math.round(score)}%</span>
                  </div>
                  <ProgressBar progress={score} colorClass="bg-sage" />
                  {/* Linked Parent info if any */}
                  {goal.parentId && (
                    <p className="text-[10px] text-ink/50 uppercase tracking-wider">
                      Linked: {flatItems.find(i => i.id === goal.parentId)?.title || 'Unknown'}
                    </p>
                  )}
                </div>
              )
            })}
            {weeklyGoals.length === 0 && (
              <p className="text-sm text-ink/50">No weekly goals defined.</p>
            )}
          </Card>

          {/* Time utilization from real deed data */}
          <h2 className="text-xl font-bold font-display pt-4">Time Utilization</h2>
          <Card className="p-4 space-y-3 text-sm">
            {hasDurations ? (
              <>
                <div className="flex justify-between text-ink/70">
                  <span>Planned Hours</span>
                  <span className="font-mono font-bold">{formatHours(plannedMinutes)}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Completed Hours</span>
                  <span className="font-mono font-bold text-sage">{formatHours(completedMinutes)}</span>
                </div>
                <ProgressBar progress={(completedMinutes / plannedMinutes) * 100} colorClass="bg-gold" />
              </>
            ) : (
              <>
                <div className="flex justify-between text-ink/70">
                  <span>Deeds Planned</span>
                  <span className="font-mono font-bold">{weekTasks.length}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Deeds Completed</span>
                  <span className="font-mono font-bold text-sage">{completedCount}</span>
                </div>
                <ProgressBar progress={weekTasks.length > 0 ? (completedCount / weekTasks.length) * 100 : 0} colorClass="bg-gold" />
              </>
            )}
          </Card>
        </div>

        {/* Right column: 7-Day Calendar View */}
        <div className="lg:col-span-3">
          <h2 className="text-xl font-bold font-display mb-4">Daily Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
            {weekDays.map(date => {
              const dayGoals = dailyGoals.filter(g => 
                g.startDate && isSameDay(new Date(g.startDate), date)
              )

              return (
                <Card key={date.toISOString()} className={`flex flex-col min-h-[180px] sm:min-h-[300px] min-w-0 overflow-hidden ${isSameDay(date, today) ? 'ring-2 ring-gold' : ''}`}>
                  <div className={`p-3 text-center border-b border-mist ${isSameDay(date, today) ? 'bg-gold text-surface' : 'bg-surface text-ink'}`}>
                    <p className="text-xs uppercase font-bold tracking-wider">{format(date, 'EEE')}</p>
                    <p className="text-xl font-mono">{format(date, 'd')}</p>
                  </div>
                  
                  <div className="p-3 flex-1 overflow-y-auto space-y-4 bg-paper text-sm" data-lenis-prevent>
                    {dayGoals.map(dg => {
                      const tasks = dg.tasks || []
                      return (
                        <div key={dg.id} className="space-y-2">
                          <div className="font-bold border-b border-mist/30 pb-1 flex justify-between">
                            <span className="text-ink/80 min-w-0 break-words">{dg.title}</span>
                            <span className="text-[10px] text-ink/50">{Math.round(completionMap[dg.id] || 0)}%</span>
                          </div>
                          
                          {tasks.map(t => (
                            <div key={t.id} className="flex items-start space-x-2 text-xs">
                              {t.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-ink/30 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0">
                                <p className={`break-words ${t.completed ? 'line-through text-ink/50' : 'text-ink'}`}>{t.title}</p>
                                {t.startTime && (
                                  <p className="text-[9px] font-mono text-gold">{format(new Date(t.startTime), 'HH:mm')}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {tasks.length === 0 && (
                            <p className="text-[10px] italic text-ink/40">No tasks scheduled.</p>
                          )}
                        </div>
                      )
                    })}
                    {dayGoals.length === 0 && (
                      <p className="text-xs italic text-ink/40 text-center mt-4">No daily goals</p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
