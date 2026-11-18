/**
 * Momentum — Inchstone's game layer. Every finished deed is worth XP; XP
 * climbs through levels, and each band of levels carries a title.
 *
 *   XP per deed   10
 *   Level L needs 50 · L · (L − 1) XP   (L2 = 100 XP = 10 deeds, L3 = 300, L5 = 1,000, L10 = 4,500)
 *
 * The curve is gentle early (a new user levels up on day one) and steadier
 * later, so there is always a next level within reach.
 */

export const XP_PER_DEED = 10

/** Total XP needed to reach `level`. */
export const xpForLevel = (level: number) => 50 * level * (level - 1)

export function levelOf(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 50)) / 2))
}

const TITLES: [number, string][] = [
  [25, 'Legend'],
  [17, 'Summiteer'],
  [12, 'Trailblazer'],
  [8, 'Pathfinder'],
  [5, 'Climber'],
  [3, 'Builder'],
  [2, 'Kindler'],
  [1, 'Spark'],
]

export function titleOf(level: number): string {
  return TITLES.find(([min]) => level >= min)?.[1] ?? 'Spark'
}

/** Where `xp` sits inside its level: 0..1, plus the XP still to go. */
export function levelProgress(xp: number) {
  const level = levelOf(xp)
  const from = xpForLevel(level)
  const to = xpForLevel(level + 1)
  return { level, title: titleOf(level), progress: (xp - from) / (to - from), toNext: to - xp, nextTitle: titleOf(level + 1) }
}

export type MomentumStats = {
  /** Every deed ever finished. */
  total: number
  today: number
  yesterday: number
  /** The record to beat: most deeds finished in one earlier day (last 90 days, today excluded). */
  bestDay: number
}
