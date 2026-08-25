'use client'

/**
 * Gantt view (§6): sections grouped on the y-axis, one bar per Goal across the
 * Plan's full month range. Milestones render as diamonds on their parent bar.
 * Dependency-free — axis granularity adapts to plan length via duration.ts.
 */
import { useMemo } from 'react'
import { differenceInCalendarDays, endOfMonth } from 'date-fns'
import type { LongTermPlanRecord, PlanGoalRecord } from '@/lib/plans/types'
import { STATUS_META, isOverdue } from '@/lib/plans/status'
import {
  axisGranularity,
  formatMonthKey,
  parseMonthKey,
  type AxisGranularity,
} from '@/lib/plans/duration'

const ROW_H = 34
const LABEL_W = 190

interface Tick {
  x: number
  label: string
  major: boolean
}

function buildTicks(startKey: string, endKey: string, g: AxisGranularity, width: number): Tick[] {
  const start = parseMonthKey(startKey)
  const end = endOfMonth(parseMonthKey(endKey))
  const totalMs = Math.max(1, end.getTime() - start.getTime())
  const ticks: Tick[] = []

  if (g === 'day') {
    const days = differenceInCalendarDays(end, start) + 1
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const isMonthStart = d.getDate() === 1
      ticks.push({
        x: ((d.getTime() - start.getTime()) / totalMs) * width,
        // label every other day to avoid crowding; always month starts
        label: isMonthStart || d.getDate() % 2 === 1 ? String(d.getDate()) : '',
        major: isMonthStart,
      })
    }
  } else if (g === 'month') {
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= end) {
      const major = d.getMonth() === 0
      ticks.push({
        x: ((d.getTime() - start.getTime()) / totalMs) * width,
        label: major ? formatMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) : d.toLocaleString('en', { month: 'short' }),
        major,
      })
      d.setMonth(d.getMonth() + 1)
    }
  } else {
    // quarters
    let q = Math.floor(start.getMonth() / 3)
    let y = start.getFullYear()
    while (new Date(y, q * 3, 1) <= end) {
      const d = new Date(y, q * 3, 1)
      ticks.push({
        x: ((d.getTime() - start.getTime()) / totalMs) * width,
        label: `Q${q + 1} ${String(y).slice(2)}`,
        major: q === 0,
      })
      q++
      if (q > 3) {
        q = 0
        y++
      }
    }
  }
  return ticks.filter(t => t.x >= -1 && t.x <= width + 1)
}

interface GanttRow {
  kind: 'section' | 'goal'
  label: string
  sub?: string
  goal?: PlanGoalRecord
}

export function GanttChart({
  plan,
  onSelectGoal,
}: {
  plan: LongTermPlanRecord
  onSelectGoal?: (goalId: string) => void
}) {
  const granularity = axisGranularity(plan.startMonth, plan.endMonth)
  const pxPerTick = granularity === 'day' ? 26 : granularity === 'month' ? 56 : 110

  const rows: GanttRow[] = useMemo(() => {
    const out: GanttRow[] = []
    for (const section of plan.sections ?? []) {
      const goals = (section.goals ?? []).filter(g => !g.archived)
      out.push({ kind: 'section', label: section.name, sub: `${goals.length}` })
      for (const goal of goals) out.push({ kind: 'goal', label: '', goal })
    }
    return out
  }, [plan])

  const startMs = parseMonthKey(plan.startMonth).getTime()
  const endMs = endOfMonth(parseMonthKey(plan.endMonth)).getTime()
  const totalMs = Math.max(1, endMs - startMs)
  // Width from tick count × per-tick pixels (floors keep short plans usable)
  const approxTicks = buildTicks(plan.startMonth, plan.endMonth, granularity, totalMs / 26).length || 1
  const width = Math.max(560, Math.min(24000, approxTicks * pxPerTick))
  const xOf = (t: number) => Math.min(width, Math.max(0, ((t - startMs) / totalMs) * width))
  const ticks = buildTicks(plan.startMonth, plan.endMonth, granularity, width)

  const now = new Date()
  const todayX = now.getTime() >= startMs && now.getTime() <= endMs ? xOf(now.getTime()) : null
  const chartHeight = rows.length * ROW_H + 28

  return (
    <div data-testid="gantt-chart">
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
      </div>

      <div className="flex overflow-hidden rounded-[8px] border hairline bg-black/20">
        {/* Labels column */}
        <div className="shrink-0 border-r border-parchment/15" style={{ width: LABEL_W }}>
          <div className="h-7 border-b border-parchment/15" />
          {rows.map((r, i) => (
            <div
              key={`${r.kind}-${i}`}
              className={`flex items-center justify-between gap-2 truncate px-3 ${
                r.kind === 'section' ? 'border-b border-parchment/15 bg-parchment/5' : ''
              }`}
              style={{ height: ROW_H }}
            >
              {r.kind === 'section' ? (
                <>
                  <span className="truncate text-xs font-semibold uppercase tracking-wider text-gold">{r.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-parchment/35">{r.sub}</span>
                </>
              ) : (
                <button
                  onClick={() => r.goal && onSelectGoal?.(r.goal.id)}
                  className={`w-full truncate text-left text-xs transition-colors hover:text-gold ${
                    r.goal?.isDraft ? 'italic text-parchment/50' : 'text-parchment/75'
                  }`}
                >
                  {(r.goal?.overallGoal ?? '').trim().slice(0, 42) || 'Untitled draft'}
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Scrollable timeline */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ width, height: chartHeight }}>
            {/* Axis strip */}
            <div className="absolute inset-x-0 top-0 h-7 border-b border-parchment/15">
              {ticks.map((t, i) => (
                <span key={i} aria-hidden className={`absolute bottom-0 w-px ${t.major ? 'h-full bg-parchment/10' : 'top-6 h-1 bg-parchment/[0.07]'}`} style={{ left: t.x }} />
              ))}
              {ticks.map((t, i) => (
                <span
                  key={`lb-${i}`}
                  className={`absolute top-1.5 whitespace-nowrap pl-1 font-mono text-[9px] ${t.major ? 'text-gold' : 'text-parchment/35'}`}
                  style={{ left: t.x }}
                >
                  {t.label}
                </span>
              ))}
            </div>

            {/* Today marker */}
            {todayX !== null && (
              <span aria-label="Today" className="absolute z-10 w-px bg-gold-glow/70" style={{ left: todayX, top: 0, height: chartHeight }}>
                <span className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-gold-glow" />
              </span>
            )}

            {/* Section lane backgrounds */}
            {rows.map((r, i) =>
              r.kind === 'section' ? (
                <div
                  key={`lane-${i}`}
                  aria-hidden
                  className="absolute inset-x-0 border-b border-parchment/15 bg-parchment/[0.03]"
                  style={{ top: 28 + i * ROW_H, height: ROW_H }}
                />
              ) : null
            )}

            {/* Goal bars + milestone diamonds */}
            {rows.map((r, i) => {
              if (r.kind !== 'goal' || !r.goal) return null
              const goal = r.goal
              const y = 28 + i * ROW_H + (ROW_H - 16) / 2
              const left = xOf(new Date(goal.startDate).getTime())
              const right = xOf(new Date(goal.targetDate).getTime())
              const w = Math.max(5, right - left)
              const overdue = isOverdue(goal.targetDate, goal.status)
              const meta = STATUS_META[goal.status as keyof typeof STATUS_META] ?? STATUS_META.not_started
              return (
                <div key={goal.id} className="absolute" style={{ left, width: w, top: y, height: 16 }}>
                  <button
                    onClick={() => onSelectGoal?.(goal.id)}
                    title={`${(goal.overallGoal ?? '').trim() || 'Untitled draft'} · ${meta.label}`}
                    aria-label={meta.label}
                    className="h-full w-full rounded-[3px] transition-transform hover:scale-y-110"
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
                        key={m.id}
                        onClick={() => onSelectGoal?.(goal.id)}
                        role="img"
                        aria-label={m.title}
                        title={`${m.title} · ${new Date(m.targetDate).toLocaleDateString()} · ${STATUS_META[m.status as keyof typeof STATUS_META]?.label ?? ''}`}
                        className="absolute top-1/2 z-[5] h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-ink bg-parchment shadow"
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
  )
}