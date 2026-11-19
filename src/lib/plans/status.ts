// Status metadata + predicates shared by list views, badges and the Gantt chart.
// Colors map onto Inchstone's canonical tokens: gold = active, ember = risk,
// moss = achieved, neutral grey = untouched.
import type { GoalStatus, StatusCounts } from './types'

export const STATUS_ORDER: GoalStatus[] = ['not_started', 'in_progress', 'at_risk', 'achieved']

export interface StatusMeta {
  label: string
  /** Gantt bar fill (Â§6) */
  barColor: string
  /** Tailwind classes for badge chips */
  badge: string
}

export const STATUS_META: Record<GoalStatus, StatusMeta> = {
  not_started: {
    label: 'Not Started',
    barColor: 'rgb(var(--fg-rgb) / 0.35)',
    badge: 'border-parchment/25 bg-parchment/10 text-parchment/60',
  },
  in_progress: {
    label: 'In Progress',
    barColor: 'rgb(var(--gold-rgb))',
    badge: 'border-gold/40 bg-gold/15 text-gold',
  },
  at_risk: {
    label: 'At Risk',
    barColor: 'rgb(var(--danger-rgb))',
    badge: 'border-ember/50 bg-ember/15 text-danger',
  },
  achieved: {
    label: 'Achieved',
    barColor: 'rgb(var(--good-rgb))',
    badge: 'border-moss/60 bg-moss/20 text-good',
  },
}

export function isGoalStatus(v: unknown): v is GoalStatus {
  return v === 'not_started' || v === 'in_progress' || v === 'at_risk' || v === 'achieved'
}

/** Overdue = target date passed and not Achieved (Â§6 visual flag) */
export function isOverdue(targetDateISO: string, status: string, now: Date = new Date()): boolean {
  if (status === 'achieved') return false
  const target = new Date(targetDateISO)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return target < startOfToday
}

export function emptyStatusCounts(): StatusCounts {
  return { total: 0, notStarted: 0, inProgress: 0, atRisk: 0, achieved: 0 }
}

export function countStatuses(statuses: Array<string | null | undefined>): StatusCounts {
  const counts = emptyStatusCounts()
  for (const raw of statuses) {
    if (!raw) continue
    counts.total++
    if (raw === 'in_progress') counts.inProgress++
    else if (raw === 'at_risk') counts.atRisk++
    else if (raw === 'achieved') counts.achieved++
    else counts.notStarted++
  }
  return counts
}