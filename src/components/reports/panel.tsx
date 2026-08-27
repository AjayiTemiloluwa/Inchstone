'use client'

import { format, parseISO } from 'date-fns'
import type { TaskFilters } from '@/lib/reports/selectors'

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

export function Stat({ label, value, sub, accent, title }: {
    label: string
    value: string
    sub?: string
    accent?: 'gold' | 'moss' | 'ember'
    title?: string
}) {
    const color = accent === 'gold' ? 'text-gold'
        : accent === 'moss' ? 'text-moss'
        : accent === 'ember' ? 'text-ember'
        : 'text-parchment'
    return (
        <div className="rounded-[6px] border hairline p-3 text-center" title={title}>
            <p className={`font-mono text-xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-parchment/45">{label}</p>
            {sub && <p className="mt-0.5 font-mono text-[9px] text-parchment/40 tabular-nums">{sub}</p>}
        </div>
    )
}

export function DayHeader({ date, score, count }: {
    date: string
    score: number
    count: number
}) {
    return (
        <div className="mb-2 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
                <span className="text-sm font-semibold text-parchment">{format(parseISO(date), 'EEEE, MMM d, yyyy')}</span>
                <span className="font-mono text-[10px] text-parchment/40 tabular-nums">{count} items</span>
            </div>
            <span className={`font-mono text-xs tabular-nums ${score >= 40 ? 'text-parchment/70' : 'text-ember'}`}>{score}%</span>
        </div>
    )
}

export function FilterPanel({ filters, onChange, categories }: {
    filters: TaskFilters
    onChange: (f: TaskFilters) => void
    categories: { id: string | null; title: string }[]
}) {
    const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch })
    const chip = (active: boolean) =>
        `rounded-full border px-3 py-1 text-xs transition-colors ${
            active ? 'border-gold text-gold' : 'border-parchment/15 text-parchment/55 hover:text-parchment/75'
        }`
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-parchment/40">Status</span>
                {(['all', 'completed', 'incomplete'] as const).map(s => (
                    <button key={s} type="button" onClick={() => set({ status: s })} className={chip(filters.status === s)}>
                        {s === 'all' ? 'All' : s === 'completed' ? 'Done' : 'Open'}
                    </button>
                ))}
            </div>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-parchment/40">
                Category
                <select
                    value={filters.category}
                    onChange={e => set({ category: e.target.value })}
                    className="rounded-[6px] border border-gold-dim/25 bg-ink px-2 py-1 text-xs normal-case tracking-normal text-parchment focus:border-gold focus:outline-none"
                >
                    <option value="all">All</option>
                    {categories.map(c => (
                        <option key={c.id ?? 'uncategorized'} value={c.id ?? 'uncategorized'}>{c.title}</option>
                    ))}
                </select>
            </label>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-parchment/40">
                Priority
                <select value={filters.priority} onChange={e => set({ priority: e.target.value })}
                    className="rounded-[6px] border border-hairline bg-ink px-2 py-1 text-xs normal-case tracking-normal text-parchment focus:border-gold focus:outline-none">
                    <option value="all">All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="Unassigned">Unassigned</option>
                </select>
            </label>
            <button type="button" onClick={() => set({ frogsOnly: !filters.frogsOnly })} className={chip(filters.frogsOnly)}>
                Frogs only
            </button>
            <button type="button" onClick={() => set({ habitsOnly: !filters.habitsOnly })} className={chip(filters.habitsOnly)}>
                Habits only
            </button>
        </div>
    )
}