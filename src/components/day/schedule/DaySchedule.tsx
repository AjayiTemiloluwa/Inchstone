'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Bell, Check, Repeat, Star } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'
import { cx } from '@/components/ds'
import { clampDay, label12, layoutColumns, snap } from '@/lib/schedule/layout'

/**
 * The day as a calendar (v2): 24 hour rows, deeds and events as blocks.
 *
 *   click an empty slot        → quick-create an hour there
 *   drag across empty time     → quick-create exactly that range (mouse/pen)
 *   drag a deed                → move it (15-minute snap)
 *   drag a deed's bottom edge  → change how long it runs
 *   tap a block                → open it
 *
 * Overlapping blocks sit side by side (Google Calendar packing). Events from
 * Google and Inchstone are read-only blocks; deeds carry a tick box.
 */

export interface ScheduleEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  source: 'google' | 'inchstone'
}

export const HOUR_PX = 60
const MIN_BLOCK = 15

const minutesOf = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

type Drag =
  | { kind: 'select'; from: number; to: number; pointerId: number }
  | { kind: 'move' | 'resize'; task: Task; start: number; end: number; grab: number; moved: boolean; pointerId: number }

export function DaySchedule({
  tasks,
  events,
  isToday,
  nowMs,
  onCreate,
  onRetime,
  onOpenTask,
  onOpenEvent,
  onToggle,
  pending,
}: {
  tasks: Task[]
  events: ScheduleEvent[]
  isToday: boolean
  nowMs: number
  onCreate: (start: number, end: number, anchorTop: number) => void
  onRetime: (task: Task, start: number, end: number) => void
  onOpenTask: (task: Task) => void
  onOpenEvent: (ev: ScheduleEvent) => void
  onToggle: (task: Task) => void
  /** A range being created (quick-create open): drawn as a ghost block. */
  pending?: { start: number; end: number } | null
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const touchTap = useRef(false)

  const blocks = useMemo(() => {
    const spans = [
      ...tasks
        .filter((t) => t.startTime)
        .map((t) => {
          const start = minutesOf(t.startTime!)
          const rawEnd = t.endTime ? minutesOf(t.endTime) : start + (t.estimatedDuration || 30)
          const end = Math.max(start + MIN_BLOCK, rawEnd <= start ? 24 * 60 : rawEnd)
          return { id: `t:${t.id}`, start, end, task: t as Task | null, event: null as ScheduleEvent | null }
        }),
      ...events.map((e) => {
        const start = minutesOf(e.startTime)
        const rawEnd = minutesOf(e.endTime)
        return { id: `e:${e.id}`, start, end: Math.max(start + MIN_BLOCK, rawEnd <= start ? 24 * 60 : rawEnd), task: null, event: e }
      }),
    ]
    // While dragging, lay the dragged deed out at its live position.
    const live = spans.map((sp) =>
      drag && drag.kind !== 'select' && sp.task?.id === drag.task.id ? { ...sp, start: drag.start, end: drag.end } : sp,
    )
    return layoutColumns(live)
  }, [tasks, events, drag])

  const nowMin = useMemo(() => {
    const d = new Date(nowMs)
    return d.getHours() * 60 + d.getMinutes()
  }, [nowMs])

  // Open near "now" on today, else near the first block (or 8am).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const first = blocks.length ? Math.min(...blocks.map((b) => b.item.start)) : 8 * 60
    const target = isToday ? nowMin - 90 : first - 45
    el.scrollTo({ top: Math.max(0, (target / 60) * HOUR_PX), behavior: 'auto' })
    // Only on mount / day change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday])

  const minuteAt = (clientY: number) => {
    const rect = grid.current!.getBoundingClientRect()
    return clampDay(((clientY - rect.top) / HOUR_PX) * 60)
  }

  // ── Empty-slot gestures ──
  const onGridDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-block]')) return
    const m = minuteAt(e.clientY)
    if (e.pointerType === 'touch') {
      // Touch scrolls; a clean tap creates (handled on pointerup).
      setDrag({ kind: 'select', from: Math.floor(m / 30) * 30, to: Math.floor(m / 30) * 30 + 60, pointerId: -e.pointerId })
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    const from = Math.floor(m / 15) * 15
    setDrag({ kind: 'select', from, to: from, pointerId: e.pointerId })
  }

  const onGridMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    if (drag.kind === 'select') {
      if (drag.pointerId < 0) { setDrag(null); return } // touch moved: it is a scroll
      if (drag.pointerId !== e.pointerId) return
      setDrag({ ...drag, to: snap(minuteAt(e.clientY)) })
      return
    }
    if (drag.pointerId !== e.pointerId) return
    const m = minuteAt(e.clientY)
    if (drag.kind === 'move') {
      const len = drag.end - drag.start
      const start = Math.min(24 * 60 - len, Math.max(0, snap(m - drag.grab)))
      if (start !== drag.start || drag.moved) setDrag({ ...drag, start, end: start + len, moved: drag.moved || start !== drag.start })
    } else {
      const end = Math.max(drag.start + MIN_BLOCK, snap(m))
      setDrag({ ...drag, end: Math.min(24 * 60, end), moved: true })
    }
  }

  const onGridUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    if (drag.kind === 'select') {
      const a = Math.min(drag.from, drag.to)
      const b = Math.max(drag.from, drag.to)
      const [start, end] = b - a >= 15 ? [a, b] : [a, a + 60]
      setDrag(null)
      onCreate(start, Math.min(24 * 60, end), (start / 60) * HOUR_PX)
      return
    }
    if (drag.pointerId !== e.pointerId) return
    const d = drag
    setDrag(null)
    if (d.moved) onRetime(d.task, d.start, d.end)
    else if (d.kind === 'move') onOpenTask(d.task)
  }

  const startBlockDrag = (e: RPointerEvent, task: Task, start: number, end: number, kind: 'move' | 'resize') => {
    e.stopPropagation()
    if ((e.target as HTMLElement).closest('[data-tick]')) return
    touchTap.current = e.pointerType === 'touch'
    if (e.pointerType === 'touch' && kind === 'move') return // touch: tap opens; dragging scrolls
    grid.current?.setPointerCapture(e.pointerId)
    setDrag({ kind, task, start, end, grab: minuteAt(e.clientY) - start, moved: false, pointerId: e.pointerId })
  }

  const selecting = drag?.kind === 'select' && drag.pointerId >= 0 ? { start: Math.min(drag.from, drag.to), end: Math.max(drag.from, drag.to) } : null
  const ghost = selecting && selecting.end - selecting.start >= 15 ? selecting : pending ?? null

  return (
    <div ref={scroller} className="relative max-h-[min(74dvh,880px)] overflow-y-auto overscroll-contain rounded-2xl border border-gold/15 bg-surface-solid" data-lenis-prevent>
      <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
        {/* Hour gutter */}
        <div className="relative w-14 shrink-0 select-none border-r border-gold/10 sm:w-16" aria-hidden>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] tabular-nums text-parchment/40" style={{ top: h * HOUR_PX }}>
              {h === 0 ? '' : label12(h * 60)}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div
          ref={grid}
          className={cx('relative flex-1', drag && drag.kind !== 'select' ? 'cursor-grabbing' : 'cursor-crosshair')}
          style={{ touchAction: drag && drag.kind !== 'select' ? 'none' : 'pan-y' }}
          onPointerDown={onGridDown}
          onPointerMove={onGridMove}
          onPointerUp={onGridUp}
          onPointerCancel={() => setDrag(null)}
          role="grid"
          aria-label="Day schedule. Click an empty time to add a deed."
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-gold/[0.08]" style={{ top: h * HOUR_PX }}>
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gold/[0.04]" />
            </div>
          ))}

          {/* Ghost of the range being created */}
          {ghost && (
            <div className="pointer-events-none absolute left-1 right-1 z-20 rounded-lg border-2 border-dashed border-gold/60 bg-gold/[0.12] px-2 py-1"
              style={{ top: (ghost.start / 60) * HOUR_PX, height: Math.max(18, ((ghost.end - ghost.start) / 60) * HOUR_PX) }}>
              <span className="font-mono text-[11px] font-semibold text-gold">{label12(ghost.start)} – {label12(ghost.end)}</span>
            </div>
          )}

          {blocks.map(({ item, col, cols }) => {
            const top = (item.start / 60) * HOUR_PX
            const height = Math.max(20, ((item.end - item.start) / 60) * HOUR_PX - 2)
            const style = { top, height, left: `calc(${(col / cols) * 100}% + 4px)`, width: `calc(${100 / cols}% - 8px)` }
            const compact = height < 40
            if (item.event) {
              const ev = item.event
              return (
                <button key={item.id} data-block type="button" onClick={() => onOpenEvent(ev)} style={style}
                  className="absolute z-10 overflow-hidden rounded-lg border border-parchment/15 bg-parchment/[0.06] px-2 py-1 text-left transition-colors hover:border-parchment/35">
                  <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-parchment/40" />
                  <span className="flex items-center gap-1.5 pl-1">
                    <span className="rounded bg-parchment/15 px-1 font-mono text-[9px] font-bold text-parchment/70">{ev.source === 'google' ? 'G' : 'EV'}</span>
                    <span className="truncate text-xs font-medium text-parchment/85">{ev.title}</span>
                  </span>
                  {!compact && <span className="block pl-1 font-mono text-[10px] text-parchment/45">{label12(item.start)} – {label12(item.end)}</span>}
                </button>
              )
            }
            const t = item.task!
            const dragging = drag && drag.kind !== 'select' && drag.task.id === t.id
            return (
              <div key={item.id} data-block role="button" tabIndex={0} style={style}
                onPointerDown={(e) => startBlockDrag(e, t, item.start, item.end, 'move')}
                onClick={(e) => { if (e.detail === 0 || touchTap.current) { touchTap.current = false; onOpenTask(t) } }}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpenTask(t) }}
                className={cx(
                  'group absolute z-10 select-none overflow-hidden rounded-lg border px-2 py-1 text-left transition-[box-shadow,background-color]',
                  'pointer-fine:cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
                  t.completed ? 'border-moss/30 bg-moss/[0.12]' : 'border-gold/30 bg-gold/[0.14] hover:bg-gold/[0.2]',
                  dragging && 'z-30 shadow-[0_12px_30px_rgba(0,0,0,0.4)] ring-2 ring-gold/60',
                )}
              >
                <span className={cx('absolute inset-y-1 left-0 w-[3px] rounded-full', t.completed ? 'bg-moss' : t.isFrog ? 'bg-ember' : 'bg-gold')} />
                <div className="flex items-start gap-1.5 pl-1">
                  <button data-tick type="button" onClick={(e) => { e.stopPropagation(); onToggle(t) }}
                    aria-label={t.completed ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                    className={cx('mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      t.completed ? 'border-moss bg-moss text-ink' : 'border-gold/50 hover:border-gold')}>
                    {t.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <span className={cx('min-w-0 flex-1 truncate text-xs font-semibold', t.completed ? 'text-parchment/50 line-through' : 'text-parchment')}>{t.title}</span>
                  {t.isFrog && <span className="text-[11px] leading-none" aria-label="Frog">🐸</span>}
                  {t.isImportant && <Bell className="h-3 w-3 shrink-0 text-gold" aria-label="Very important" />}
                  {(t.isRecurring || t.isHabit) && <Repeat className="h-3 w-3 shrink-0 text-parchment/40" aria-label="Repeats" />}
                  {t.priority === 'high' && <Star className="h-3 w-3 shrink-0 fill-gold text-gold" aria-label="High priority" />}
                </div>
                {!compact && (
                  <span className="block pl-6 font-mono text-[10px] text-parchment/55">
                    {label12(item.start)} – {label12(item.end)} · {t.weight} pts
                  </span>
                )}
                {/* Resize handle */}
                <span
                  aria-hidden
                  onPointerDown={(e) => startBlockDrag(e, t, item.start, item.end, 'resize')}
                  className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
                >
                  <span className="mx-auto mt-0.5 block h-1 w-6 rounded-full bg-gold/60" />
                </span>
              </div>
            )
          })}

          {isToday && (
            <div className="pointer-events-none absolute inset-x-0 z-40 flex items-center" style={{ top: (nowMin / 60) * HOUR_PX }}>
              <span className="-ml-[5px] h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_0_3px_rgb(var(--ink-rgb)/0.9)]" />
              <span className="h-[2px] flex-1 bg-ember" />
              <span className="mr-1 rounded-full bg-ember px-1.5 py-px font-mono text-[9px] font-bold text-ink">{label12(nowMin)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
