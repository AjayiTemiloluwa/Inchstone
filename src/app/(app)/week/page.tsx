'use client'

import { useHierarchyStore } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { CheckCircle2, Circle } from 'lucide-react'

export default function WeekPage() {
  const { completionMap, getFlatItems } = useHierarchyStore()

  // For this example, we assume we are looking at the current week.
  // In a real app, you'd use state/params to select the week.
  const today = new Date()
  const weekStart = startOfWeek(today)
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

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center border-b border-mist pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">Week View</h1>
          <p className="text-ink/60">{format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'MMMM d, yyyy')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-1">Weekly Score</p>
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-mono">{Math.round(weekProgress)}%</span>
            <ProgressRing progress={weekProgress} size={48} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left column: Weekly Goals & Breakdown */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-bold font-display">Weekly Goals</h2>
          <Card className="p-4 space-y-4">
            {weeklyGoals.map(goal => {
              const score = completionMap[goal.id] || 0
              return (
                <div key={goal.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-ink">{goal.title}</span>
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

          {/* Time utilization mock */}
          <h2 className="text-xl font-bold font-display pt-4">Time Utilization</h2>
          <Card className="p-4 space-y-3 text-sm">
             <div className="flex justify-between text-ink/70">
               <span>Planned Hours</span>
               <span className="font-mono font-bold">24h</span>
             </div>
             <div className="flex justify-between text-ink/70">
               <span>Completed Hours</span>
               <span className="font-mono font-bold text-sage">16h</span>
             </div>
             <ProgressBar progress={(16/24)*100} colorClass="bg-gold" />
          </Card>
        </div>

        {/* Right column: 7-Day Calendar View */}
        <div className="lg:col-span-3">
          <h2 className="text-xl font-bold font-display mb-4">Daily Schedule</h2>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDays.map(date => {
              const dayGoals = dailyGoals.filter(g => 
                g.startDate && isSameDay(new Date(g.startDate), date)
              )

              return (
                <Card key={date.toISOString()} className={`flex flex-col min-h-[300px] overflow-hidden ${isSameDay(date, today) ? 'ring-2 ring-gold' : ''}`}>
                  <div className={`p-3 text-center border-b border-mist ${isSameDay(date, today) ? 'bg-gold text-surface' : 'bg-surface text-ink'}`}>
                    <p className="text-xs uppercase font-bold tracking-wider">{format(date, 'EEE')}</p>
                    <p className="text-xl font-mono">{format(date, 'd')}</p>
                  </div>
                  
                  <div className="p-3 flex-1 overflow-y-auto space-y-4 bg-paper text-sm">
                    {dayGoals.map(dg => {
                      const tasks = dg.tasks || []
                      return (
                        <div key={dg.id} className="space-y-2">
                          <div className="font-bold border-b border-mist/30 pb-1 flex justify-between">
                            <span className="text-ink/80">{dg.title}</span>
                            <span className="text-[10px] text-ink/50">{Math.round(completionMap[dg.id] || 0)}%</span>
                          </div>
                          
                          {tasks.map(t => (
                            <div key={t.id} className="flex items-start space-x-2 text-xs">
                              {t.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-ink/30 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className={t.completed ? 'line-through text-ink/50' : 'text-ink'}>{t.title}</p>
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
