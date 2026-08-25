import { STATUS_META, isGoalStatus } from '@/lib/plans/status'
import { Link2 } from 'lucide-react'

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const meta = isGoalStatus(status) ? STATUS_META[status] : STATUS_META.not_started
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.badge} ${className}`}
    >
      {meta.label}
    </span>
  )
}

export function DraftBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-dashed border-parchment/30 bg-transparent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-parchment/45 ${className}`}
    >
      Incomplete
    </span>
  )
}

/** Chip showing a Goal/Milestone's rollup source in the yearly tracker (§8) */
export function LinkedItemBadge({ title, progress, className = '' }: { title: string; progress: number; className?: string }) {
  const short = title.length > 22 ? `${title.slice(0, 21)}…` : title
  return (
    <span
      title={`Rolls up from yearly tracker: ${title}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-gold-dim/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-gold ${className}`}
    >
      <Link2 className="h-3 w-3 shrink-0" strokeWidth={1.75} />
      {short} · {Math.round(progress)}%
    </span>
  )
}