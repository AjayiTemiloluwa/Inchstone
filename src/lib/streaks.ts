// Check-in streaks. Days are "yyyy-MM-dd" strings in the user's own clock.

export function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + by))
  return t.toISOString().slice(0, 10)
}

/**
 * Consecutive days ending today, or ending yesterday when today has no
 * check-in yet (the streak is still alive until the day is over).
 */
export function currentStreak(days: Set<string>, today: string): number {
  let cursor = days.has(today) ? today : shiftDay(today, -1)
  let n = 0
  while (days.has(cursor)) {
    n++
    cursor = shiftDay(cursor, -1)
  }
  return n
}

export function bestStreak(days: Set<string>): number {
  const sorted = [...days].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Days both people checked in. */
export const both = (a: Set<string>, b: Set<string>) => new Set([...a].filter((d) => b.has(d)))

/** The last n days ending today, oldest first. */
export const lastDays = (today: string, n: number) => Array.from({ length: n }, (_, i) => shiftDay(today, i - (n - 1)))
