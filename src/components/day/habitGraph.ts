import type { GraphRange, HabitHistoryEntry } from './types'

export type GraphPoint = { x: number; y: number; date: string; rawRate: number }

export type HabitGraphData = {
  dates: string[]
  points: GraphPoint[]
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
  chartW: number
  chartH: number
  stepX: number
  smoothPath: string
  areaPath: string
}

/** Monotone cubic bezier segments (no overshoot) for the given points. */
function monotoneSegments(pts: GraphPoint[]): string {
  let path = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y

    let m0: number
    let m1: number
    if (i === 0) {
      m0 = dy / dx
      m1 = pts[i + 2] ? (pts[i + 2].y - p0.y) / (pts[i + 2].x - p0.x) : dy / dx
    } else if (i >= pts.length - 2) {
      m0 = (p1.y - pts[i - 1].y) / (p1.x - pts[i - 1].x)
      m1 = dy / dx
    } else {
      const mPrev = (p1.y - pts[i - 1].y) / (p1.x - pts[i - 1].x)
      const mNext = (pts[i + 2].y - p0.y) / (pts[i + 2].x - p0.x)
      m0 = (mPrev + mNext) / 2
      m1 = m0
    }

    if (dy === 0) {
      m0 = 0
      m1 = 0
    } else {
      const maxSlope = 3 * Math.abs(dy / dx)
      m0 = Math.max(-maxSlope, Math.min(maxSlope, m0))
      m1 = Math.max(-maxSlope, Math.min(maxSlope, m1))
    }

    const cp1x = p0.x + dx / 3
    const cp1y = p0.y + (m0 * dx) / 3
    const cp2x = p1.x - dx / 3
    const cp2y = p1.y - (m1 * dx) / 3
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`
  }
  return path
}

/**
 * Overall completion % per day (3-day rolling average) as a smooth curve.
 * `width`/`height` are real CSS pixels so SVG text never gets stretched.
 */
export function buildHabitGraph(
  habitHistory: HabitHistoryEntry[],
  range: GraphRange,
  width: number,
  height: number,
): HabitGraphData | null {
  if (habitHistory.length === 0 || width <= 0) return null

  const byDate: Record<string, { total: number; done: number }> = {}
  habitHistory.forEach(h => {
    const d = new Date(h.date).toISOString().substring(0, 10)
    if (!byDate[d]) byDate[d] = { total: 0, done: 0 }
    byDate[d].total++
    if (h.completed) byDate[d].done++
  })

  let dates = Object.keys(byDate).sort()
  if (dates.length > 90 && range !== 'all') dates = dates.slice(-90)
  if (dates.length < 2) return null

  const padding = { top: 12, right: 12, bottom: 28, left: 40 }
  const chartW = Math.max(10, width - padding.left - padding.right)
  const chartH = Math.max(10, height - padding.top - padding.bottom)
  const stepX = chartW / (dates.length - 1)

  const points: GraphPoint[] = dates.map((date, i) => {
    let totalDone = 0
    let totalCount = 0
    for (let offset = -1; offset <= 1; offset++) {
      const n = i + offset
      if (n >= 0 && n < dates.length) {
        const entry = byDate[dates[n]]
        if (entry) {
          totalDone += entry.done
          totalCount += entry.total
        }
      }
    }
    const rate = totalCount > 0 ? (totalDone / totalCount) * 100 : 0
    const x = padding.left + i * stepX
    const y = padding.top + chartH - (rate / 100) * chartH
    return { x, y, date, rawRate: byDate[date] ? (byDate[date].done / byDate[date].total) * 100 : 0 }
  })

  const segments = monotoneSegments(points)
  const bottomY = padding.top + chartH
  const smoothPath = `M ${points[0].x} ${points[0].y}${segments}`
  const areaPath = `M ${points[0].x} ${bottomY} L ${points[0].x} ${points[0].y}${segments} L ${points[points.length - 1].x} ${bottomY} Z`

  return { dates, points, width, height, padding, chartW, chartH, stepX, smoothPath, areaPath }
}
