import { Link2 } from 'lucide-react'
import { Badge, type Tone } from '@/components/ds'
import { STATUS_META, isGoalStatus } from '@/lib/plans/status'
import type { GoalStatus } from '@/lib/plans/types'

/** Goal status → v3 tone. Token classes only, so both themes follow. */
export const STATUS_TONE: Record<GoalStatus, Tone> = {
  not_started: 'neutral',
  in_progress: 'gold',
  at_risk: 'ember',
  achieved: 'moss',
}

/** Solid fills for bars, segments and dots (Gantt, progress rollups, milestones). */
export const STATUS_FILL: Record<GoalStatus, string> = {
  not_started: 'bg-parchment/30',
  in_progress: 'bg-gold',
  at_risk: 'bg-ember',
  achieved: 'bg-moss',
}

export const STATUS_TEXT: Record<GoalStatus, string> = {
  not_started: 'text-parchment/40',
  in_progress: 'text-gold',
  at_risk: 'text-ember',
  achieved: 'text-moss',
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const key: GoalStatus = isGoalStatus(status) ? status : 'not_started'
  return (
    <Badge tone={STATUS_TONE[key]} className={`shrink-0 whitespace-nowrap ${className}`}>
      {STATUS_META[key].label}
    </Badge>
  )
}

export function DraftBadge({ className = '' }: { className?: string }) {
  return (
    <Badge className={`shrink-0 whitespace-nowrap border-dashed text-parchment/45 ${className}`}>
      Incomplete
    </Badge>
  )
}

/** Chip showing a Goal/Milestone's rollup source in the yearly tracker (§8) */
export function LinkedItemBadge({ title, progress, className = '' }: { title: string; progress: number; className?: string }) {
  const short = title.length > 22 ? `${title.slice(0, 21)}…` : title
  return (
    <span
      title={`Rolls up from yearly tracker: ${title}`}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-gold-dim/40 px-2 py-0.5 text-[11px] text-gold ${className}`}
    >
      <Link2 className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {short} · <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
    </span>
  )
}
