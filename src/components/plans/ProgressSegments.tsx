'use client'

/**
 * Shared status rollup (§5): stacked progress segments plus the
 * "X% Achieved · Y% At Risk…" caption, used on plan cards and the plan header.
 */
import { countStatuses } from '@/lib/plans/status'

export function ProgressSegments({
  statuses,
  className = '',
}: {
  statuses: Array<string | null | undefined>
  className?: string
}) {
  const counts = countStatuses(statuses)
  const pct = (n: number) => (counts.total > 0 ? Math.round((n / counts.total) * 100) : 0)

  const parts: string[] = []
  if (counts.achieved > 0) parts.push(`${pct(counts.achieved)}% achieved`)
  if (counts.atRisk > 0) parts.push(`${pct(counts.atRisk)}% at risk`)
  if (counts.inProgress > 0) parts.push(`${pct(counts.inProgress)}% in progress`)

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-parchment/10"
        role="img"
        aria-label={`${counts.total} goals, ${counts.achieved} achieved`}
      >
        {counts.total === 0 ? null : (
          <>
            {counts.achieved > 0 && <div className="bg-moss" style={{ width: `${pct(counts.achieved)}%` }} />}
            {counts.atRisk > 0 && <div className="bg-ember" style={{ width: `${pct(counts.atRisk)}%` }} />}
            {counts.inProgress > 0 && <div className="bg-gold" style={{ width: `${pct(counts.inProgress)}%` }} />}
            {counts.notStarted > 0 && <div className="bg-parchment/25" style={{ width: `${pct(counts.notStarted)}%` }} />}
          </>
        )}
      </div>
      <p className="font-mono text-[11px] text-parchment/45">
        {counts.total === 0
          ? 'No goals yet'
          : `${counts.total} ${counts.total === 1 ? 'goal' : 'goals'}${parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}`}
      </p>
    </div>
  )
}