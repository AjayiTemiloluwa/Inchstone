'use client'

import { format } from 'date-fns'
import { Activity, Clock } from 'lucide-react'
import type { Task } from '@/stores/hierarchyStore'
import { compactCountdownLabel, formatCountdown } from '@/lib/useCountdown'

/**
 * Compact live countdown chip. Colour reflects state: LIVE (moss),
 * imminent (ember), upcoming (gold).
 */
export function CountdownChip({ task, now }: { task: Pick<Task, 'startTime' | 'endTime'>; now: Date }) {
  if (!task.startTime) return null
  const p = formatCountdown(now, new Date(task.startTime), task.endTime ? new Date(task.endTime) : null)
  const label = compactCountdownLabel(p)
  const tone =
    p.state === 'live'
      ? 'bg-moss/15 text-sage border-sage/30'
      : p.soon
        ? 'bg-ember/15 text-[#e0a093] border-ember/40'
        : 'bg-gold/15 text-gold border-gold/30'
  const Icon = p.state === 'live' ? Activity : Clock
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide tabular-nums ${tone}`}
      title={`Scheduled ${format(new Date(task.startTime), 'h:mm a')}`}
    >
      <Icon className="w-3 h-3" />
      {p.state === 'live' ? '● ' : ''}
      {label}
    </span>
  )
}
