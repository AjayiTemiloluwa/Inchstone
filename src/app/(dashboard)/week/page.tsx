'use client'

import { useHierarchyStore } from '@/stores/hierarchyStore'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { CheckCircle2, Circle } from 'lucide-react'
import { useState } from 'react'
import type { Task } from '@/stores/hierarchyStore'
import { Page, PageHeader, Section, Panel, StatGrid, Stat, EmptyState, Badge, cx } from '@/components/ds'
import { PeriodNav, Meter } from '../calendar/_components/PeriodNav'

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

  const weekEnd = addDays(weekStart, 6)
  const utilisation = hasDurations
    ? (completedMinutes / plannedMinutes) * 100
    : weekTasks.length > 0 ? (completedCount / weekTasks.length) * 100 : 0

  return (
    <Page width="wide" className="pb-12">
      <PageHeader
        eyebrow={`Week · ${format(weekStart, 'MMMM d')} – ${format(weekEnd, 'MMMM d, yyyy')}`}
        title={weekOffset === 0 ? 'This week' : 'Week view'}
        meta={`${Math.round(weekProgress)}% weekly score`}
        actions={
          <PeriodNav
            label={`${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`}
            labelTitle="Jump to this week"
            prevLabel="Previous week"
            nextLabel="Next week"
            onPrev={() => setWeekOffset(o => o - 1)}
            onNext={() => setWeekOffset(o => o + 1)}
            onToday={() => setWeekOffset(0)}
            todayLabel="This week"
            showToday={weekOffset !== 0}
          />
        }
      />

      {/* ── Weekly summary: score + time utilization from real deed data ── */}
      <Section title="Summary" id="week-summary">
        <StatGrid cols={4}>
          <Stat
            label="Weekly score"
            tone="gold"
            value={`${Math.round(weekProgress)}%`}
            caption={<Meter value={weekProgress} tone="gold" className="mt-1" />}
          />
          {hasDurations ? (
            <>
              <Stat label="Planned hours" value={formatHours(plannedMinutes)} />
              <Stat label="Completed hours" tone="moss" value={formatHours(completedMinutes)} />
            </>
          ) : (
            <>
              <Stat label="Deeds planned" value={weekTasks.length} />
              <Stat label="Deeds completed" tone="moss" value={completedCount} />
            </>
          )}
          <Stat
            label={hasDurations ? 'Time used' : 'Deeds done'}
            value={`${Math.round(utilisation)}%`}
            caption={<Meter value={utilisation} tone="gold" className="mt-1" />}
          />
        </StatGrid>
      </Section>

      {/* ── The seven days, read as one board ── */}
      <Section title="Daily schedule" id="week-days">
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7 xl:gap-2">
          {weekDays.map(date => {
            const dayGoals = dailyGoals.filter(g =>
              g.startDate && isSameDay(new Date(g.startDate), date)
            )
            const isCurrent = isSameDay(date, today)

            return (
              <li key={date.toISOString()} className="min-w-0" aria-current={isCurrent ? 'date' : undefined}>
                <Panel
                  padded={false}
                  className={cx('flex h-full min-w-0 flex-col overflow-hidden xl:min-h-[300px]', isCurrent && 'border-gold/60')}
                >
                  <div className={cx('flex items-baseline justify-between gap-2 border-b px-4 py-3 xl:flex-col xl:items-center xl:gap-1 xl:px-2 xl:text-center', isCurrent ? 'border-gold/30 bg-gold/[0.06]' : 'border-gold/10')}>
                    <p className={cx('font-mono text-[11px] uppercase tracking-[0.2em]', isCurrent ? 'text-gold' : 'text-parchment/50')}>{format(date, 'EEE')}</p>
                    <div className="flex items-baseline gap-2 xl:flex-col xl:items-center xl:gap-1">
                      <p className={cx('font-display text-heading tabular-nums', isCurrent ? 'text-gold' : 'text-parchment')}>{format(date, 'd')}</p>
                      {isCurrent && <Badge tone="gold">Today</Badge>}
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-4 xl:p-3" data-lenis-prevent>
                    {dayGoals.map(dg => {
                      const tasks = dg.tasks || []
                      return (
                        <div key={dg.id} className="space-y-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 break-words text-caption font-semibold text-parchment/85">{dg.title}</span>
                            <span className="shrink-0 font-mono text-[10px] tabular-nums text-parchment/45">{Math.round(completionMap[dg.id] || 0)}%</span>
                          </div>

                          <ul className="space-y-1.5">
                            {tasks.map(t => (
                              <li key={t.id} className="flex items-start gap-2 text-caption">
                                {t.completed ? (
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" strokeWidth={1.5} aria-label="Done" />
                                ) : (
                                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-parchment/30" strokeWidth={1.5} aria-label="Open" />
                                )}
                                <div className="min-w-0">
                                  <p className={cx('break-words', t.completed ? 'text-parchment/45 line-through' : 'text-parchment/85')}>{t.title}</p>
                                  {t.startTime && (
                                    <p className="font-mono text-[10px] tabular-nums text-gold-dim">{format(new Date(t.startTime), 'HH:mm')}</p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                          {tasks.length === 0 && (
                            <p className="text-caption text-parchment/35">No tasks scheduled.</p>
                          )}
                        </div>
                      )
                    })}
                    {dayGoals.length === 0 && (
                      <p className="text-caption text-parchment/35 xl:pt-4 xl:text-center">No daily goals</p>
                    )}
                  </div>
                </Panel>
              </li>
            )
          })}
        </ol>
      </Section>

      {/* ── Weekly goals ── */}
      <Section title="Weekly goals" id="week-goals" action={weeklyGoals.length > 0 ? <Badge>{weeklyGoals.length}</Badge> : undefined}>
        {weeklyGoals.length > 0 ? (
          <Panel padded={false}>
            <ul className="divide-y divide-gold/[0.07]">
              {weeklyGoals.map(goal => {
                const score = completionMap[goal.id] || 0
                return (
                  <li key={goal.id} className="space-y-2 px-4 py-4 sm:px-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words text-body font-medium text-parchment">{goal.title}</span>
                      <span className="shrink-0 font-mono text-mono tabular-nums text-parchment/60">{Math.round(score)}%</span>
                    </div>
                    <Meter value={score} tone="moss" label={`${goal.title} progress`} />
                    {/* Linked Parent info if any */}
                    {goal.parentId && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-parchment/40">
                        Linked: {flatItems.find(i => i.id === goal.parentId)?.title || 'Unknown'}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>
        ) : (
          <EmptyState title="No weekly goals defined." />
        )}
      </Section>
    </Page>
  )
}
