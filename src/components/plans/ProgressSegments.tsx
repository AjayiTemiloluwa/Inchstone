'use client'

/**
 * Shared status rollup (§5): stacked progress segments plus the
 * "X% Achieved · Y% At Risk…" caption, used on plan rows and the plan header.
 */
import { countStatuses } from '@/lib/plans/status'
import { STATUS_FILL } from './StatusBadge'

export function ProgressSegments({
  statuses,
  className = '',
  caption = true,
}: {
  statuses: Array<string | null | undefined>
  className?: string
  /** Hide the text line when the figures are shown elsewhere (e.g. a StatGrid). */
  caption?: boolean
}) {
  const counts = countStatuses(statuses)
  const pct = (n: number) => (counts.total > 0 ? Math.round((n / counts.total) * 100) : 0)

  const parts: string[] = []
  if (counts.achieved > 0) parts.push(`${pct(counts.achieved)}% achieved`)
  if (counts.atRisk > 0) parts.push(`${pct(counts.atRisk)}% at risk`)
  if (counts.inProgress > 0) parts.push(`${pct(counts.inProgress)}% in progress`)

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-parchment/10"
        role="img"
        aria-label={`${counts.total} goals, ${counts.achieved} achieved`}
      >
        {counts.total === 0 ? null : (
          <>
            {counts.achieved > 0 && <div className={STATUS_FILL.achieved} style={{ width: `${pct(counts.achieved)}%` }} />}
            {counts.atRisk > 0 && <div className={STATUS_FILL.at_risk} style={{ width: `${pct(counts.atRisk)}%` }} />}
            {counts.inProgress > 0 && <div className={STATUS_FILL.in_progress} style={{ width: `${pct(counts.inProgress)}%` }} />}
            {counts.notStarted > 0 && <div className="bg-parchment/25" style={{ width: `${pct(counts.notStarted)}%` }} />}
          </>
        )}
      </div>
      {caption && (
        <p className="font-mono text-[11px] tabular-nums text-parchment/45">
          {counts.total === 0
            ? 'No goals yet'
            : `${counts.total} ${counts.total === 1 ? 'goal' : 'goals'}${parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}`}
        </p>
      )}
    </div>
  )
}
