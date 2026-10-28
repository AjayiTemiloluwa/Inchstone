'use client'

/**
 * Gantt view (§6): sections grouped on the y-axis, one bar per Goal across the
 * Plan's full month range. Milestones render as diamonds on their parent bar.
 * Dependency-free. The date axis sticks to the top while scrolling vertically,
 * the label column sticks to the left while scrolling horizontally, and the
 * scale (px per day) is user-adjustable with a "Jump to today" shortcut.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMonths, endOfMonth, startOfWeek } from 'date-fns'
import type { LongTermPlanRecord, PlanGoalRecord } from '@/lib/plans/types'
import { STATUS_META, isOverdue } from '@/lib/plans/status'
import { axisGranularity, parseMonthKey } from '@/lib/plans/duration'

const ROW_H = 40
const BAR_H = 20
const TIER_H = 24
const HEADER_H = TIER_H * 2
const DAY_MS = 86_400_000
const MAX_WIDTH = 24000
const MIN_WIDTH = 560
const MIN_ZOOM = 0.4
const MAX_ZOOM = 40

const SCALES = [
  { key: 'month', label: 'Month', ppd: 8 },
  { key: 'quarter', label: 'Quarter', ppd: 3 },
  { key: 'year', label: 'Year', ppd: 1 },
] as const

interface Tick {
  x: number
  label: string
  major?: boolean
}

function monthLabel(d: Date, ppd: number): string {
  const m = d.toLocaleString('en', { month: 'short' })
  if (ppd >= 2.5) return `${m} ${String(d.getFullYear()).slice(2)}`
  return d.getMonth() === 0 ? `${m} ${String(d.getFullYear()).slice(2)}` : m
}

/** Upper tier: months (or quarters when very zoomed out). */
function buildTopTicks(start: Date, end: Date, ppd: number): Tick[] {
  const startMs = start.getTime()
  const ticks: Tick[] = []
  if (ppd < 0.9) {
    let d = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1)
    while (d <= end) {
      ticks.push({
        x: ((d.getTime() - startMs) / DAY_MS) * ppd,
        label: `Q${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`,
        major: d.getMonth() === 0,
      })
      d = addMonths(d, 3)
    }
  } else {
    let d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= end) {
      ticks.push({
        x: ((d.getTime() - startMs) / DAY_MS) * ppd,
        label: monthLabel(d, ppd),
        major: d.getMonth() === 0,
      })
      d = addMonths(d, 1)
    }
  }
  return ticks
}

/** Lower tier: days when zoomed in, weeks at mid zoom, none when zoomed out. */
function buildSubTicks(start: Date, end: Date, ppd: number): Tick[] {
  if (ppd < 3.5) return []
  const startMs = start.getTime()
  const ticks: Tick[] = []
  if (ppd >= 14) {
    const everyDay = ppd >= 20
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      if (!everyDay && d.getDate() % 2 === 0) continue
      ticks.push({ x: ((d.getTime() - startMs) / DAY_MS) * ppd, label: String(d.getDate()) })
    }
  } else {
    for (let d = startOfWeek(start, { weekStartsOn: 1 }); d <= end; d = addDays(d, 7)) {
      if (d < start) continue
      ticks.push({ x: ((d.getTime() - startMs) / DAY_MS) * ppd, label: String(d.getDate()) })
    }
  }
  return ticks
}

interface GanttRow {
  kind: 'section' | 'goal'
  label: string
  sub?: string
  goal?: PlanGoalRecord
}

const ctrlBtn =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-[6px] border border-parchment/15 px-3 text-xs text-parchment/75 transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8 sm:min-w-8'

export function GanttChart({
  plan,
  onSelectGoal,
}: {
  plan: LongTermPlanRecord
  onSelectGoal?: (goalId: string) => void
}) {
  const granularity = axisGranularity(plan.startMonth, plan.endMonth)
  const [zoom, setZoom] = useState<number>(() => (granularity === 'day' ? 26 : granularity === 'month' ? 2 : 1.2))
  const [nowMs] = useState(() => Date.now())

  const scrollRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const pendingCenter = useRef<number | null>(null)

  const rows: GanttRow[] = useMemo(() => {
    const out: GanttRow[] = []
    for (const section of plan.sections ?? []) {
      const goals = (section.goals ?? []).filter(g => !g.archived)
      out.push({ kind: 'section', label: section.name, sub: `${goals.length}` })
      for (const goal of goals) out.push({ kind: 'goal', label: '', goal })
    }
    return out
  }, [plan])

  const start = useMemo(() => parseMonthKey(plan.startMonth), [plan.startMonth])
  const end = useMemo(() => endOfMonth(parseMonthKey(plan.endMonth)), [plan.endMonth])
  const startMs = start.getTime()
  const endMs = end.getTime()
  const totalDays = Math.max(1, (endMs - startMs) / DAY_MS)

  const minPpd = Math.max(MIN_ZOOM, MIN_WIDTH / totalDays)
  const maxPpd = Math.max(minPpd, Math.min(MAX_ZOOM, MAX_WIDTH / totalDays))
  const ppd = Math.min(maxPpd, Math.max(minPpd, zoom))
  const width = Math.round(totalDays * ppd)

  const xOf = (t: number) => Math.min(width, Math.max(0, ((t - startMs) / DAY_MS) * ppd))
  const topTicks = useMemo(() => buildTopTicks(start, end, ppd), [start, end, ppd])
  const subTicks = useMemo(() => buildSubTicks(start, end, ppd), [start, end, ppd])

  const todayX = nowMs >= startMs && nowMs <= endMs ? xOf(nowMs) : null
  const bodyHeight = rows.length * ROW_H

  // Keep the visible centre of the timeline stable across zoom changes.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const ratio = pendingCenter.current
    if (!el || ratio === null) return
    pendingCenter.current = null
    const labelW = labelRef.current?.offsetWidth ?? 0
    el.scrollLeft = ratio * width - (el.clientWidth - labelW) / 2
  }, [width])

  const changeZoom = (next: number) => {
    const el = scrollRef.current
    if (el && width > 0) {
      const labelW = labelRef.current?.offsetWidth ?? 0
      pendingCenter.current = (el.scrollLeft + (el.clientWidth - labelW) / 2) / width
    }
    setZoom(Math.min(maxPpd, Math.max(minPpd, next)))
  }

  const jumpToToday = () => {
    const el = scrollRef.current
    if (!el || todayX === null) return
    const labelW = labelRef.current?.offsetWidth ?? 0
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: Math.max(0, todayX - (el.clientWidth - labelW) / 2), behavior: reduce ? 'auto' : 'smooth' })
  }

  const activeScale = SCALES.find(s => Math.abs(Math.min(maxPpd, Math.max(minPpd, s.ppd)) - ppd) < 0.01)?.key

  return (
    <div data-testid="gantt-chart">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Timeline scale" className="flex flex-wrap items-center gap-1.5">
          {SCALES.map(s => (
            <button
              key={s.key}
              type="button"
              aria-pressed={activeScale === s.key}
              onClick={() => changeZoom(s.ppd)}
              className={`${ctrlBtn} ${activeScale === s.key ? 'border-gold/60 bg-gold/10 text-gold' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Zoom" className="flex items-center gap-1.5">
          <button type="button" aria-label="Zoom out" disabled={ppd <= minPpd + 0.001} onClick={() => changeZoom(ppd / 1.4)} className={ctrlBtn}>
            <span aria-hidden className="text-base leading-none">−</span>
          </button>
          <button type="button" aria-label="Zoom in" disabled={ppd >= maxPpd - 0.001} onClick={() => changeZoom(ppd * 1.4)} className={ctrlBtn}>
            <span aria-hidden className="text-base leading-none">+</span>
          </button>
        </div>
        <button type="button" onClick={jumpToToday} disabled={todayX === null} className={`${ctrlBtn} sm:ml-auto`}>
          Jump to today
        </button>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-parchment/55">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_META[k].barColor }} />
            {STATUS_META[k].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#CD8B70]">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm border border-ember" /> Overdue
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-parchment/55">
          <span aria-hidden className="inline-block h-2 w-2 rotate-45 bg-gold-dim" /> Milestone
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-parchment/55">
          <span aria-hidden className="inline-block h-3 w-px bg-gold-glow" /> Today
        </span>
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Plan timeline, scrollable"
        data-lenis-prevent
        className="max-h-[70dvh] overflow-auto overscroll-contain rounded-[8px] border hairline bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <div className="flex w-max min-w-full">
          {/* Sticky labels column */}
          <div
            ref={labelRef}
            className="sticky left-0 z-20 w-[132px] shrink-0 border-r border-parchment/15 bg-ink sm:w-[200px]"
          >
            <div className="sticky top-0 z-30 flex items-end border-b border-parchment/15 bg-ink px-3 pb-1.5" style={{ height: HEADER_H }}>
              <span className="font-mono text-[10px] uppercase tracking-wider text-parchment/40">Goals</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={`${r.kind}-${i}`}
                className={`flex items-center justify-between gap-2 px-3 ${
                  r.kind === 'section' ? 'border-b border-parchment/15 bg-parchment/5' : ''
                }`}
                style={{ height: ROW_H }}
              >
                {r.kind === 'section' ? (
                  <>
                    <span className="truncate text-xs font-semibold uppercase tracking-wider text-gold">{r.label}</span>
                    <span className="shrink-0 font-mono text-[11px] text-parchment/45">{r.sub}</span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => r.goal && onSelectGoal?.(r.goal.id)}
                    className={`h-full w-full truncate text-left text-xs transition-colors hover:text-gold focus-visible:text-gold sm:text-[13px] ${
                      r.goal?.isDraft ? 'italic text-parchment/55' : 'text-parchment/80'
                    }`}
                  >
                    {(r.goal?.overallGoal ?? '').trim().slice(0, 42) || 'Untitled draft'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="relative shrink-0" style={{ width }}>
            {/* Sticky date axis */}
            <div className="sticky top-0 z-10 border-b border-parchment/15 bg-ink" style={{ height: HEADER_H }}>
              <div className="relative border-b border-parchment/10" style={{ height: TIER_H }}>
                {topTicks.map((t, i) => (
                  <span
                    key={i}
                    className={`absolute top-0 flex h-full items-center whitespace-nowrap border-l pl-1.5 font-mono text-[11px] ${
                      t.major ? 'border-gold/40 text-gold' : 'border-parchment/15 text-parchment/60'
                    }`}
                    style={{ left: t.x }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
              <div className="relative" style={{ height: TIER_H }}>
                {subTicks.map((t, i) => (
                  <span
                    key={i}
                    className="absolute top-0 flex h-full items-center whitespace-nowrap border-l border-parchment/10 pl-1 font-mono text-[10px] text-parchment/45"
                    style={{ left: t.x }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
              {todayX !== null && (
                <span
                  aria-hidden
                  className="absolute bottom-0 -ml-1 h-2 w-2 rounded-full bg-gold-glow"
                  style={{ left: todayX }}
                />
              )}
            </div>

            {/* Body */}
            <div className="relative" style={{ height: bodyHeight }}>
              {/* Month gridlines */}
              {topTicks.map((t, i) => (
                <span key={`g-${i}`} aria-hidden className="absolute inset-y-0 w-px bg-parchment/[0.06]" style={{ left: t.x }} />
              ))}

              {/* Today line */}
              {todayX !== null && (
                <span
                  role="img"
                  aria-label="Today"
                  className="pointer-events-none absolute inset-y-0 z-[6] w-px bg-gold-glow/80"
                  style={{ left: todayX }}
                />
              )}

              {/* Section lane backgrounds */}
              {rows.map((r, i) =>
                r.kind === 'section' ? (
                  <div
                    key={`lane-${i}`}
                    aria-hidden
                    className="absolute inset-x-0 border-b border-parchment/15 bg-parchment/[0.04]"
                    style={{ top: i * ROW_H, height: ROW_H }}
                  />
                ) : null
              )}

              {/* Goal bars + milestone diamonds */}
              {rows.map((r, i) => {
                if (r.kind !== 'goal' || !r.goal) return null
                const goal = r.goal
                const y = i * ROW_H + (ROW_H - BAR_H) / 2
                const left = xOf(new Date(goal.startDate).getTime())
                const right = xOf(new Date(goal.targetDate).getTime())
                const w = Math.max(6, right - left)
                const overdue = isOverdue(goal.targetDate, goal.status)
                const meta = STATUS_META[goal.status as keyof typeof STATUS_META] ?? STATUS_META.not_started
                const title = (goal.overallGoal ?? '').trim() || 'Untitled draft'
                return (
                  <div key={goal.id} className="absolute" style={{ left, width: w, top: y, height: BAR_H }}>
                    <button
                      type="button"
                      onClick={() => onSelectGoal?.(goal.id)}
                      title={`${title} · ${meta.label}`}
                      aria-label={`${title}, ${meta.label}`}
                      className="h-full w-full rounded-[4px] transition-transform hover:scale-y-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                      style={{
                        background: meta.barColor,
                        outline: overdue ? '1.5px solid #A14E37' : undefined,
                        outlineOffset: overdue ? '1px' : undefined,
                        opacity: goal.isDraft ? 0.65 : 1,
                      }}
                    />
                    {(goal.milestones ?? []).map(m => {
                      const mx = Math.min(w - 2, Math.max(2, xOf(new Date(m.targetDate).getTime()) - left))
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => onSelectGoal?.(goal.id)}
                          aria-label={`Milestone: ${m.title}`}
                          title={`${m.title} · ${new Date(m.targetDate).toLocaleDateString()} · ${STATUS_META[m.status as keyof typeof STATUS_META]?.label ?? ''}`}
                          className="absolute top-1/2 z-[5] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-ink bg-parchment shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                          style={{ left: mx }}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
