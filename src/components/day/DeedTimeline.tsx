'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, Circle, Star, Trash2 } from 'lucide-react'
import type { Item, Task } from '@/stores/hierarchyStore'
import { CountdownChip } from './CountdownChip'
import type { GoogleEventView } from './types'

export const HOUR_HEIGHT = 64
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

type TimelineEntry = Task | GoogleEventView

function isGoogleEntry(e: TimelineEntry): e is GoogleEventView {
  return 'type' in e && e.type === 'google'
}

type Positioned<T> = { task: T; top: number; height: number; left: number; width: number }

/** Lay overlapping blocks side by side (greedy column packing per overlap group). */
export function getPositionedTasks<T extends { startTime: string | null; endTime: string | null }>(tasks: T[]): Positioned<T>[] {
  const scheduled = tasks
    .filter(t => t.startTime && t.endTime)
    .map(t => {
      const start = new Date(t.startTime!)
      const end = new Date(t.endTime!)
      const startHour = start.getHours() + start.getMinutes() / 60
      const endHour = Math.max(startHour + 0.5, end.getHours() + end.getMinutes() / 60)
      return { task: t, startHour, endHour }
    })
  scheduled.sort((a, b) => a.startHour - b.startHour)
  const groups: Array<typeof scheduled> = []
  let currentGroup: typeof scheduled = []
  let groupEnd = 0
  scheduled.forEach(item => {
    if (currentGroup.length === 0) {
      currentGroup.push(item)
      groupEnd = item.endHour
    } else if (item.startHour < groupEnd) {
      currentGroup.push(item)
      groupEnd = Math.max(groupEnd, item.endHour)
    } else {
      groups.push(currentGroup)
      currentGroup = [item]
      groupEnd = item.endHour
    }
  })
  if (currentGroup.length > 0) groups.push(currentGroup)
  const result: Positioned<T>[] = []
  groups.forEach(group => {
    const columns: Array<number[]> = []
    const placements: Array<{ item: (typeof scheduled)[0]; colIndex: number }> = []
    group.forEach(item => {
      let placed = false
      for (let i = 0; i < columns.length; i++) {
        const lastEndHour = columns[i][columns[i].length - 1]
        if (item.startHour >= lastEndHour) {
          columns[i].push(item.endHour)
          placements.push({ item, colIndex: i })
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([item.endHour])
        placements.push({ item, colIndex: columns.length - 1 })
      }
    })
    const numCols = columns.length
    placements.forEach(({ item, colIndex }) => {
      result.push({
        task: item.task,
        top: item.startHour * HOUR_HEIGHT,
        height: (item.endHour - item.startHour) * HOUR_HEIGHT,
        left: colIndex * (96 / numCols) + 2,
        width: 94 / numCols,
      })
    })
  })
  return result
}

/** The 24-hour grid (sm and up). Phones get the agenda list instead. */
export function DeedTimeline({
  dateStr,
  tasks,
  googleEvents,
  showGoogle,
  categories,
  countdownNow,
  onOpen,
  onToggle,
  onDelete,
  onWeightChange,
  onProgressChange,
  onCreateAt,
}: {
  dateStr: string
  tasks: Task[]
  googleEvents: GoogleEventView[]
  showGoogle: boolean
  categories: Item[]
  countdownNow: Date
  onOpen: (task: Task) => void
  onToggle: (task: Task) => void
  onDelete: (e: React.MouseEvent, taskId: string) => void
  onWeightChange: (task: Task, weight: number) => void
  onProgressChange: (task: Task, progress: number) => void
  onCreateAt: (start: string, end: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [now, setNow] = useState(() => new Date())

  // Re-read the clock once a minute for the "now" line.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])

  const isToday = dateStr === format(now, 'yyyy-MM-dd')
  const nowLineTop: number | null = isToday ? (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT : null

  // Auto-scroll the 24h timeline to the current hour when today opens.
  useEffect(() => {
    if (dateStr !== format(new Date(), 'yyyy-MM-dd')) return
    const t = window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: Math.max(0, new Date().getHours() * HOUR_HEIGHT - 150),
        behavior: 'smooth',
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [dateStr])

  const entries = useMemo<TimelineEntry[]>(
    () => [...tasks, ...(showGoogle ? googleEvents : [])],
    [tasks, googleEvents, showGoogle],
  )

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.task-block')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top + e.currentTarget.scrollTop
    const clickedHour = Math.max(0, Math.min(23, Math.floor(clickY / HOUR_HEIGHT)))
    onCreateAt(
      `${String(clickedHour).padStart(2, '0')}:00`,
      `${String(Math.min(23, clickedHour + 1)).padStart(2, '0')}:00`,
    )
  }

  return (
            <div className="hidden sm:flex glass rounded-[8px] overflow-hidden select-none animate-fadeIn border border-white/10">
              <div ref={scrollRef} className="overflow-y-auto flex w-full" data-lenis-prevent style={{ maxHeight: 'min(1536px, 65dvh)' }}>
              <div className="w-14 sm:w-20 shrink-0 border-r border-white/10 bg-black/20 relative z-10" style={{ height: `${24 * 64}px` }}>
                {HOURS.map(hour => (
                  <div key={hour} className="absolute left-0 right-0 text-right pr-1.5 sm:pr-3 text-[10px] font-mono text-ink/40" style={{ top: `${hour * 64 + 6}px`, height: '64px' }}>
                    {formatHourLabel(hour)}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0 relative cursor-crosshair" style={{ height: `${24 * 64}px` }} onClick={handleGridClick}>
                {HOURS.map(hour => (
                  <div key={hour} className="absolute left-0 right-0 border-b border-white/5" style={{ top: `${hour * 64}px`, height: '64px' }} />
                ))}
                {nowLineTop !== null && (
                  <div className="absolute left-0 right-0 flex items-center z-20 pointer-events-none" style={{ top: `${nowLineTop}px` }}>
                    <div className="w-2 h-2 rounded-full bg-ember -ml-1" />
                    <div className="flex-1 h-0.5 bg-ember" />
                  </div>
                )}
                {getPositionedTasks(entries).map(({ task, top, height, left, width }) => {
                  // Google events — gold-dim, non-checkable (no checkbox,
                  // weight, progress or delete; just an informational block).
                  if (isGoogleEntry(task)) {
                    return (
                      <div
                        key={task.id}
                        className="absolute rounded-xl border p-2.5 text-left text-xs select-none overflow-hidden"
                        style={{ top: `${top + 2}px`, height: `${height - 4}px`, left: `${left}%`, width: `${width}%`, zIndex: 9, borderLeft: '3px solid rgb(var(--gold-rgb) / 0.55)', borderColor: 'rgb(var(--gold-rgb) / 0.25)', background: 'rgb(var(--gold-rgb) / 0.08)' }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold truncate text-gold/90">{task.title}</span>
                          <span className="shrink-0 font-mono text-[8px] uppercase tracking-wider text-gold/50">Google</span>
                        </div>
                        {task.startTime && task.endTime && (
                          <span className="mt-1 block text-[10px] font-mono text-gold/50">
                            {format(new Date(task.startTime), 'h:mm a')} - {format(new Date(task.endTime), 'h:mm a')}
                          </span>
                        )}
                      </div>
                    )
                  }
                  // Untagged deeds fall back to the theme accent. That has to be the
                  // var (not a hex) so it follows the chosen accent — and since a hex
                  // alpha suffix can't be appended to a variable, the translucent
                  // variants go through color-mix, which renders user colours identically.
                  const taskBorderColor = task.color || (task.completed ? '#8fbc8f' : 'var(--gold)')
                  return (
                    <div
                      key={task.id}
                      onClick={(e) => { e.stopPropagation(); onOpen(task) }}
                      className={`absolute rounded-xl border p-2.5 text-left text-xs flex flex-col justify-between transition-all cursor-pointer group/task select-none overflow-hidden task-block ${task.completed ? 'glass text-ink/50 opacity-80' : 'text-ink hover:-translate-y-0.5'}`}
                      style={{ top: `${top + 2}px`, height: `${height - 4}px`, left: `${left}%`, width: `${width}%`, zIndex: 10, borderLeft: `4px solid ${taskBorderColor}`, borderColor: task.completed ? `color-mix(in srgb, ${taskBorderColor} 25%, transparent)` : taskBorderColor, background: task.completed ? `color-mix(in srgb, ${taskBorderColor} 13%, transparent)` : `color-mix(in srgb, ${taskBorderColor} 21%, transparent)` }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <button onClick={(e) => { e.stopPropagation(); onToggle(task) }} className="shrink-0">
                            {task.completed ? <CheckCircle2 className="w-3.5 h-3.5 text-sage" /> : <Circle className="w-3.5 h-3.5 text-ink/30" />}
                          </button>
                          <span className={`font-semibold truncate ${task.completed ? 'line-through' : ''}`}>{task.title}</span>
                          {task.isImportant && <Star className="w-3 h-3 shrink-0 fill-gold text-gold" />}
                        </div>
                        <button onClick={(e) => onDelete(e, task.id)} className="shrink-0 p-0.5 opacity-0 group-hover/task:opacity-100 hover:bg-ember/15 rounded transition text-ink/30 hover:text-[#cf8f78]" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {task.startTime && task.endTime && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-ink/40 font-mono">
                              {format(new Date(task.startTime), 'h:mm a')} - {format(new Date(task.endTime), 'h:mm a')}
                            </span>
                            <CountdownChip task={task} now={countdownNow} />
                          </div>
                        )}
                        {task.categoryId && (() => {
                          const category = categories.find(i => i.id === task.categoryId)
                          return category ? (
                            <span className="inline-block text-[8px] font-bold uppercase tracking-wider bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                              {category.title}
                            </span>
                          ) : null
                        })()}
                        <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                          <span className="text-[9px] text-ink/40">Wt</span>
                          <input
                            type="number" min="1" max="100" value={task.weight}
                            onChange={e => onWeightChange(task, parseFloat(e.target.value) || 1)}
                            className="w-8 px-0.5 py-0.5 bg-transparent rounded border border-transparent hover:border-mist focus:bg-paper focus:border-gold outline-none text-right font-mono text-[10px]"
                          />
                          <span className="text-[9px] text-ink/40">%</span>
                        </div>
                        <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                          <span className="text-[9px] text-ink/40">Prog</span>
                          <input
                            type="range" min="0" max="100" step="1" value={Math.round(task.progress)}
                            onChange={e => onProgressChange(task, parseFloat(e.target.value) || 0)}
                            className="flex-1 h-1 bg-mist rounded-full appearance-none cursor-pointer accent-gold"
                          />
                          <span className="text-[9px] font-mono text-ink/40 w-6 text-right">{Math.round(task.progress)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
  )
}
