'use client'

import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import type { TaskFilters } from '@/lib/reports/selectors'
import { Panel, cx } from '@/components/ds'

/** Shared filters for the reports page. */
export const PERIOD_OPTIONS: { value: string; label: string }[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'custom', label: 'Custom' },
]

export function fmtShort(iso: string) {
    return format(parseISO(iso), 'MMM d')
}

export function fmtDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '—'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    return `${m}m`
}

/** Mono label used for small headings and control labels on the reports page. */
export const monoLabel = 'font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45'

/** Compact select styling shared by the filter and sort controls. */
export const selectClass =
    'min-h-11 rounded-lg border border-gold/20 bg-ink/40 px-3 text-sm text-parchment focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20 pointer-fine:min-h-9'

/** A titled chart surface: mono heading, optional trailing read, then the chart. */
export function ChartPanel({ title, aside, children, footer, className }: {
    title: ReactNode
    aside?: ReactNode
    children: ReactNode
    footer?: ReactNode
    className?: string
}) {
    return (
        <Panel className={cx('flex flex-col', className)}>
            <div className="mb-4 flex items-baseline justify-between gap-3">
                <h3 className={monoLabel}>{title}</h3>
                {aside && <span className="shrink-0 font-mono text-mono tabular-nums text-parchment/50">{aside}</span>}
            </div>
            <div className="min-w-0 flex-1">{children}</div>
            {footer && <div className="mt-4 border-t border-gold/10 pt-3">{footer}</div>}
        </Panel>
    )
}

export function DayHeader({ date, score, count }: {
    date: string
    score: number
    count: number
}) {
    return (
        <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h3 className="text-body font-medium text-parchment">{format(parseISO(date), 'EEEE, MMM d, yyyy')}</h3>
                <span className="font-mono text-mono text-parchment/40 tabular-nums">{count} items</span>
            </div>
            <span className={cx('shrink-0 font-mono text-mono tabular-nums', score >= 40 ? 'text-parchment/70' : 'text-ember')}>{score}%</span>
        </div>
    )
}

export function FilterPanel({ filters, onChange, categories }: {
    filters: TaskFilters
    onChange: (f: TaskFilters) => void
    categories: { id: string | null; title: string }[]
}) {
    const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch })
    const chip = (active: boolean) => cx(
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors pointer-fine:min-h-8 pointer-fine:px-3 pointer-fine:text-xs',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        active ? 'border-gold/60 bg-gold/[0.08] text-gold' : 'border-parchment/15 text-parchment/55 hover:border-gold/30 hover:text-parchment/80',
    )
    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-2">
                <span className={monoLabel}>Status</span>
                {(['all', 'completed', 'incomplete'] as const).map(s => (
                    <button key={s} type="button" aria-pressed={filters.status === s} onClick={() => set({ status: s })} className={chip(filters.status === s)}>
                        {s === 'all' ? 'All' : s === 'completed' ? 'Done' : 'Open'}
                    </button>
                ))}
            </div>
            <label className="flex items-center gap-2">
                <span className={monoLabel}>Category</span>
                <select
                    value={filters.category}
                    onChange={e => set({ category: e.target.value })}
                    className={selectClass}
                >
                    <option value="all">All</option>
                    {categories.map(c => (
                        <option key={c.id ?? 'uncategorized'} value={c.id ?? 'uncategorized'}>{c.title}</option>
                    ))}
                </select>
            </label>
            <label className="flex items-center gap-2">
                <span className={monoLabel}>Priority</span>
                <select value={filters.priority} onChange={e => set({ priority: e.target.value })}
                    className={selectClass}>
                    <option value="all">All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="Unassigned">Unassigned</option>
                </select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={filters.frogsOnly} onClick={() => set({ frogsOnly: !filters.frogsOnly })} className={chip(filters.frogsOnly)}>
                    Frogs only
                </button>
                <button type="button" aria-pressed={filters.habitsOnly} onClick={() => set({ habitsOnly: !filters.habitsOnly })} className={chip(filters.habitsOnly)}>
                    Habits only
                </button>
            </div>
        </div>
    )
}
