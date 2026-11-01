// Day-schedule geometry: lay out overlapping blocks side by side the way
// Google Calendar does, and find free gaps for auto-planning. Minutes are
// minutes after local midnight.

export interface Span {
  id: string
  start: number
  end: number
}

export interface Placed<T extends Span> {
  item: T
  /** Column index within its overlap cluster, and how many columns the cluster has. */
  col: number
  cols: number
}

/** Greedy column packing per overlap cluster (sorted by start, then longest first). */
export function layoutColumns<T extends Span>(spans: T[]): Placed<T>[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const out: Placed<T>[] = []
  let cluster: Placed<T>[] = []
  let clusterEnd = -1
  let colEnds: number[] = []

  const flush = () => {
    const cols = Math.max(1, colEnds.length)
    cluster.forEach((p) => (p.cols = cols))
    out.push(...cluster)
    cluster = []
    colEnds = []
  }

  for (const s of sorted) {
    if (s.start >= clusterEnd && cluster.length) flush()
    let col = colEnds.findIndex((e) => e <= s.start)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(s.end)
    } else colEnds[col] = s.end
    cluster.push({ item: s, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, s.end)
  }
  if (cluster.length) flush()
  return out
}

/**
 * Free gaps between busy spans inside [from, to], each at least `min` long.
 * Busy spans are merged first; a small buffer keeps blocks from touching.
 */
export function freeGaps(busy: { start: number; end: number }[], from: number, to: number, min = 15, buffer = 0) {
  const merged = [...busy]
    .map((b) => ({ start: b.start - buffer, end: b.end + buffer }))
    .sort((a, b) => a.start - b.start)
    .reduce<{ start: number; end: number }[]>((acc, b) => {
      const last = acc[acc.length - 1]
      if (last && b.start <= last.end) last.end = Math.max(last.end, b.end)
      else acc.push({ ...b })
      return acc
    }, [])
  const gaps: { start: number; end: number }[] = []
  let cursor = from
  for (const b of merged) {
    if (b.end <= cursor) continue
    if (b.start > cursor && b.start - cursor >= min) gaps.push({ start: cursor, end: Math.min(b.start, to) })
    cursor = Math.max(cursor, b.end)
    if (cursor >= to) break
  }
  if (to - cursor >= min) gaps.push({ start: cursor, end: to })
  return gaps.filter((g) => g.end - g.start >= min)
}

/**
 * Auto-plan: place unscheduled deeds (with a wanted length) into free gaps,
 * frogs first, then by priority, each starting on a 15-minute boundary.
 */
export function autoPlan<T extends { id: string; minutes: number; rank: number }>(
  todo: T[],
  busy: { start: number; end: number }[],
  from: number,
  to: number,
): { id: string; start: number; end: number }[] {
  const placed: { id: string; start: number; end: number }[] = []
  const taken = [...busy]
  for (const t of [...todo].sort((a, b) => a.rank - b.rank)) {
    const gap = freeGaps(taken, from, to, t.minutes, 5).find((g) => {
      const s = Math.ceil(g.start / 15) * 15
      return s + t.minutes <= g.end
    })
    if (!gap) continue
    const start = Math.ceil(gap.start / 15) * 15
    const slot = { id: t.id, start, end: start + t.minutes }
    placed.push(slot)
    taken.push(slot)
  }
  return placed
}

export const snap = (m: number, step = 15) => Math.round(m / step) * step
export const clampDay = (m: number) => Math.max(0, Math.min(24 * 60, m))
export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const label12 = (m: number) => {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  const ap = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return mm ? `${h12}:${String(mm).padStart(2, '0')}${ap}` : `${h12}${ap}`
}
