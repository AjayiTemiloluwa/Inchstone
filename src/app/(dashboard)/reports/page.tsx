'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import {
    ChevronLeft, ChevronRight, Download, Search,
} from 'lucide-react'
import { format, parseISO, addMonths, addWeeks, addQuarters, addYears, addDays } from 'date-fns'
import jsPDF from 'jspdf'
import { Scramble } from '@/components/ui/motion'
import type { Report, ReportTask, ReportType } from '@/lib/reports/types'
import { ScoreBarChart, CompletionDonut, BreakdownBars } from '@/components/reports/charts'
import {
    DEFAULT_FILTERS, DEFAULT_SORT, filterDayTasks, dayVisible, sortDays,
    type TaskFilters, type TaskSort,
} from '@/lib/reports/selectors'
import { FilterPanel, Stat, DayHeader, PERIOD_OPTIONS } from '@/components/reports/panel'

function fmtDate(iso: string) {
    return format(parseISO(iso), 'MMM d, yyyy')
}

function fmtDayShort(iso: string) {
    return format(parseISO(iso), 'MMM d')
}

function fmtMin(minutes: number): string {
    if (!minutes || minutes <= 0) return '—'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    return `${m}m`
}

function stepDate(type: ReportType, date: Date, dir: 1 | -1): Date {
    switch (type) {
        case 'weekly': return addWeeks(date, dir)
        case 'monthly': return addMonths(date, dir)
        case 'quarterly': return addQuarters(date, dir)
        case 'yearly': return addYears(date, dir)
        case 'custom': return addDays(date, dir * 14)
        default: return date
    }
}

export default function ReportsPage() {
    const [reportType, setReportType] = useState<ReportType>('monthly')
    const [report, setReport] = useState<Report | null>(null)
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [anchor, setAnchor] = useState<Date>(() => new Date())
    const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS)
    const [sort, setSort] = useState<TaskSort>(DEFAULT_SORT)
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [search, setSearch] = useState('')

    const buildURL = (anchor: Date, type: ReportType) => {
        const base = new URL('/api/reports', window.location.origin)
        base.searchParams.set('type', type)
        base.searchParams.set('date', anchor.toISOString())
        if (type === 'custom') {
            if (customStart) base.searchParams.set('start', customStart)
            if (customEnd) base.searchParams.set('end', customEnd)
        }
        return base.toString()
    }

    const fetchReport = async (anchor: Date, type: ReportType, isInitial = false) => {
        if (!isInitial) {
            setLoading(true)
            setReport(null)
        }
        try {
            const res = await fetch(buildURL(anchor, type))
            if (res.ok) {
                const data = await res.json()
                setReport(data.report)
            } else if (!isInitial) {
                console.error('Report fetch failed')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
            if (isInitial) setInitialLoading(false)
        }
    }

    // Initial load: current month. All async state changes happen in
    // continuations so the effect body stays sync.
    useEffect(() => {
        let active = true
        const run = async () => {
            try {
                const a = new Date()
                setAnchor(a)
                const res = await fetch(buildURL(a, 'monthly'))
                if (!active) return
                if (res.ok) {
                    const data = await res.json()
                    setReport(data.report)
                }
            } catch (e) {
                console.error(e)
            } finally {
                if (active) setInitialLoading(false)
            }
        }
        run()
        return () => { active = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleTypeChange = (t: string) => {
        const type = t as ReportType
        setReportType(type)
        if (type !== 'custom') fetchReport(anchor, type)
    }

    const applyCustom = () => {
        if (!customStart || !customEnd) return
        fetchReport(new Date(customStart), 'custom')
    }

    const go = (dir: 1 | -1) => {
        const next = stepDate(reportType, anchor, dir)
        setAnchor(next)
        fetchReport(next, reportType)
    }

    const goToday = () => {
        const now = new Date()
        setAnchor(now)
        fetchReport(now, reportType)
    }

    // Derived values -----------------------------------------------------
    // NOTE: every hook runs unconditionally — the full-page loading gate
    // lives further down so React's hook order stays stable.
    const filtered = useMemo(() => {
        if (!report) return null
        const tasks: ReportTask[] = report.days.flatMap(d => filterDayTasks(d, filters))
        const completed = tasks.filter(t => t.completed)
        const weightedTotal = tasks.reduce((s, t) => s + (t.weight || 0), 0)
        const weightedDone = completed.reduce((s, t) => s + (t.weight || 0), 0)
        const frogs = tasks.filter(t => t.isFrog)
        const habits = tasks.filter(t => t.isHabit)
        return {
            total: tasks.length,
            completed: completed.length,
            completion: weightedTotal > 0 ? Math.round((weightedDone / weightedTotal) * 100) : 0,
            weightedDone,
            weightedTotal,
            frogsDone: frogs.filter(t => t.completed).length,
            frogsTotal: frogs.length,
            habitsDone: habits.filter(t => t.completed).length,
            habitsTotal: habits.length,
        }
    }, [report, filters])

    // Raw per-day task lists used inside the breakdown while respecting the
    // free-text search on top of the structural filters.
    const breakdownDays = useMemo(() => {
        if (!report) return []
        const withSearch = { ...filters, search }
        return sortDays(
            report.days
                .filter(d => {
                    if (!dayVisible(d, withSearch)) return false
                    return filterDayTasks(d, withSearch).length > 0 || (d.notes.length > 0 && !filters.frogsOnly && !filters.habitsOnly)
                })
                .map(d => ({ ...d, tasks: filterDayTasks(d, withSearch) })),
            sort,
        )
    }, [report, filters, search, sort])

    // Loading gate sits BELOW every hook to keep hook order stable.
    if (initialLoading) return <Loader routeKey="reports" />

    const downloadPDF = () => {
        if (!report) return
        const doc = new jsPDF('p', 'mm', 'a4')
        const gw = doc.internal.pageSize.getWidth()
        const margin = 20
        const gold: [number, number, number] = [184, 147, 90]
        const ink: [number, number, number] = [30, 26, 22]
        const sage: [number, number, number] = [74, 93, 69]
        let y = 20

        doc.setFontSize(18)
        doc.setTextColor(...gold)
        doc.setFont('helvetica', 'bold')
        doc.text('Inchstone Report', margin, y)
        y += 8
        doc.setFontSize(10)
        doc.setTextColor(...ink)
        doc.setFont('helvetica', 'normal')
        doc.text(
            `${report.type[0].toUpperCase() + report.type.slice(1)} · ${fmtDate(report.period.start)} – ${fmtDate(report.period.end)}`,
            margin, y,
        )
        y += 12

        const rows: [string, string][] = [
            ['Total tasks', String(report.stats.totalTasks)],
            ['Completed', `${report.stats.completedTasks}/${report.stats.totalTasks}`],
            ['Weighted completion', `${report.stats.completion}%`],
            ['Avg score', `${report.stats.avgScore}%`],
            ['Active days / total', `${report.stats.activeDays}/${report.days.length}`],
            ['Best day', report.stats.bestDay ? `${fmtDayShort(report.stats.bestDay)} (${report.stats.bestDayScore}%)` : '—'],
            ['Worst day', report.stats.worstDay ? `${fmtDayShort(report.stats.worstDay)} (${report.stats.worstDayScore}%)` : '—'],
            ['Best streak', `${report.stats.bestStreak} day(s)`],
            ['Current streak', `${report.stats.currentStreak} day(s)`],
            ['Frogs done', `${report.stats.frogsCompleted}/${report.stats.frogsTotal}`],
            ['Habits done', `${report.stats.habitsCompleted}/${report.stats.habitsTotal}`],
            ['Time (est.)', fmtMin(report.stats.totalEstimatedMinutes)],
            ['Time (actual)', fmtMin(report.stats.totalActualMinutes)],
        ]
        doc.setDrawColor(...gold)
        doc.setLineWidth(0.2)
        doc.line(margin, y, gw - margin, y)
        y += 6
        rows.forEach(([label, value]) => {
            doc.setFontSize(9)
            doc.setTextColor(...ink)
            doc.setFont('helvetica', 'normal')
            doc.text(label, margin, y)
            doc.setTextColor(...sage)
            doc.setFont('helvetica', 'bold')
            doc.text(value, gw - margin, y, { align: 'right' })
            y += 6
        })
        doc.setFontSize(7)
        doc.setTextColor(...ink)
        doc.setFont('helvetica', 'italic')
        doc.text(`Generated ${new Date().toLocaleString()}`, margin, 285)
        doc.save(`inchstone-${report.type}-${report.period.start.split('T')[0]}.pdf`)
    }

    const hasFilter = filters.status !== 'all' || filters.category !== 'all' ||
        filters.priority !== 'all' || filters.frogsOnly || filters.habitsOnly

    const summaryBar = filtered ? [
        { label: 'Tasks done', value: filtered.completion, accent: 'gold' as const },
        { label: 'Frogs', value: filtered.frogsTotal ? Math.round((filtered.frogsDone / filtered.frogsTotal) * 100) : 0 },
        { label: 'Habits', value: filtered.habitsTotal ? Math.round((filtered.habitsDone / filtered.habitsTotal) * 100) : 0 },
    ] : []

    const clearFilters = () => setFilters(DEFAULT_FILTERS)

    return (
        <div className="mx-auto max-w-[1100px] space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-h1 text-parchment"><Scramble text="Reports" mono={false} /></h1>
                    <p className="mt-1 font-mono text-xs text-parchment/50">Customisable activity reports — charts, filters & time ranges</p>
                </div>
                {report && (
                    <button onClick={downloadPDF}
                        className="flex items-center gap-2 rounded-md border hairline px-4 py-2.5 text-sm text-parchment transition-colors hover:border-gold">
                        <Download className="h-4 w-4" strokeWidth={1.5} />
                        <span>Download PDF</span>
                    </button>
                )}
            </div>

            {/* Controls: period + time navigation */}
            <Card className="p-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="inline-flex items-center rounded-md border hairline p-0.5">
                        {PERIOD_OPTIONS.map(opt => (
                            <button key={opt.value} type="button"
                                onClick={() => handleTypeChange(opt.value)}
                                className={`rounded px-3 py-1.5 text-xs transition-colors ${
                                    reportType === opt.value ? 'bg-gold/15 text-gold' : 'text-parchment/55 hover:text-parchment'
                                }`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {reportType !== 'custom' && (
                        <div className="flex items-center gap-1 text-parchment/70">
                            <button onClick={() => go(-1)} aria-label="Previous period"
                                className="rounded p-1.5 hover:text-parchment"><ChevronLeft className="h-4 w-4" /></button>
                            <button onClick={goToday}
                                className="rounded border-hairline px-3 py-1.5 text-xs text-parchment/70 hover:text-parchment">Today</button>
                            <button onClick={() => go(1)} aria-label="Next period"
                                className="rounded p-1.5 hover:text-parchment"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                    )}
                </div>

                {reportType === 'custom' && (
                    <div className="mt-3 flex flex-wrap items-end gap-3 border-t hairline-top pt-3">
                        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-parchment/45">
                            Start
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                className="rounded-md border border-gold-dim/25 bg-ink px-2 py-1.5 font-mono text-xs text-parchment" />
                        </label>
                        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-parchment/45">
                            End
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                className="rounded-md border border-gold-dim/25 bg-ink px-2 py-1.5 font-mono text-xs text-parchment" />
                        </label>
                        <button onClick={applyCustom}
                            className="rounded-md bg-gold px-4 py-1.5 text-xs font-semibold text-ink">Apply range</button>
                    </div>
                )}

                {report && (
                    <div className="mt-3 border-t hairline-top pt-3 font-mono text-xs text-parchment/60">
                        {fmtDate(report.period.start)} → {fmtDate(report.period.end)}
                    </div>
                )}
            </Card>

            {loading && <Card><Loader compact label="Refreshing…" /></Card>}
{report && (
                <>
                    {/* ── Charts row ─────────────────────────────────────── */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-parchment/45">Daily Score Trend</h3>
                                <span className="font-mono text-[10px] text-parchment/40">Avg {report.stats.avgScore}%</span>
                            </div>
                            <ScoreBarChart days={report.days} height={220} />
                            <div className="mt-2 flex items-center gap-4 border-t hairline-top pt-2 text-[10px] text-parchment/40">
                                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: '#7fa871' }} />100%</span>
                                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: '#B8935A' }} />40–99%</span>
                                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: '#cf8a68' }} />under 40%</span>
                                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-white/20" />inactive</span>
                            </div>
                        </Card>

                        <Card>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-parchment/45">Completion</h3>
                            <CompletionDonut scored={report.stats.weightedCompleted} max={report.stats.weightedTotal} />
                            <div className="mt-4 space-y-2 border-t hairline-top pt-3 font-mono text-[11px] text-parchment/50">
                                <div className="flex justify-between"><span>By task</span><span className="text-parchment">{report.stats.completedTasks}/{report.stats.totalTasks}</span></div>
                                <div className="flex justify-between"><span>Weighted</span><span className="text-parchment">{report.stats.completion}%</span></div>
                                <div className="flex justify-between"><span>Frogs</span><span className="text-parchment">{report.stats.frogsCompleted}/{report.stats.frogsTotal}</span></div>
                                <div className="flex justify-between"><span>Habits</span><span className="text-parchment">{report.stats.habitsCompleted}/{report.stats.habitsTotal}</span></div>
                                <div className="flex justify-between"><span>Notes written</span><span className="text-parchment">{report.stats.totalNotes}</span></div>
                            </div>
                        </Card>
                    </div>

                    {/* ── Fast + cumulative facts ─────────────────────────── */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat label="Best day" value={report.stats.bestDay ? fmtDayShort(report.stats.bestDay) : '—'}
                            sub={report.stats.bestDay ? `${report.stats.bestDayScore}%` : ''} accent="moss" />
                        <Stat label="Worst active" value={report.stats.worstDay ? fmtDayShort(report.stats.worstDay) : '—'}
                            sub={report.stats.worstDay ? `${report.stats.worstDayScore}%` : ''} accent="ember" />
                        <Stat label="Best streak" value={`${report.stats.bestStreak}d`} sub={`Current ${report.stats.currentStreak}d`} accent="gold" />
                        <Stat label="Active days" value={`${report.stats.activeDays}/${report.days.length}`}
                            sub={`${report.stats.avgTasksPerActiveDay} tasks/day`} />
                    </div>

                    {/* ── Category & priority breakdown ────────────────────── */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <Card>
                            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-parchment/45">By Category</h3>
                            <BreakdownBars rows={report.categories.map(c => ({ label: c.title, total: c.total, completed: c.completed }))} color="gold" />
                        </Card>
                        <Card>
                            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-parchment/45">By Priority</h3>
                            <BreakdownBars
                                rows={report.priorities.map(p => ({
                                    label: p.priority[0].toUpperCase() + p.priority.slice(1),
                                    total: p.total,
                                    completed: p.completed,
                                }))}
                                color="moss" />
                        </Card>
                    </div>
                    {/* ── Filter / sort / search ───────────────────────── */}
                    <Card className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-parchment/45">Filter & sort </h3>
                            {hasFilter && (
                                <button onClick={clearFilters} className="text-[11px] text-gold hover:underline">Reset filters</button>
                            )}
                        </div>
                        <FilterPanel filters={filters} onChange={setFilters}
                            categories={report.categories.map(c => ({ id: c.id, title: c.title }))} />

                        <div className="flex flex-wrap items-center gap-3 border-t hairline-top pt-3">
                            <label className="flex items-center gap-2 rounded-md border border-gold-dim/25 px-2 py-1.5 focus-within:border-gold">
                                <Search className="h-3.5 w-3.5 text-parchment/40" strokeWidth={1.5} />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
                                    className="w-40 bg-transparent text-xs text-parchment placeholder:text-parchment/30 focus:outline-none" />
                            </label>
                            <label className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-wider text-parchment/40">
                                Sort by
                                <select value={sort} onChange={e => setSort(e.target.value as TaskSort)}
                                    className="rounded-[6px] border border-gold-dim/25 bg-ink px-2 py-1.5 text-xs normal-case tracking-normal text-parchment focus:border-gold focus:outline-none">
                                    <option value="date-asc">Date ↑</option>
                                    <option value="date-desc">Date ↓</option>
                                    <option value="score-desc">Score ↓</option>
                                    <option value="tasks-desc">Task count ↓</option>
                                </select>
                            </label>
                        </div>
                    </Card>

                    {/* ── Filter-scoped completion mini-bars ───────────── */}
                    {summaryBar.length > 0 && filtered && filtered.total > 0 && (
                        <Card>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {summaryBar.map(s => (
                                    <div key={s.label}>
                                        <div className="mb-1 flex items-baseline justify-between gap-2">
                                            <span className="text-[10px] uppercase tracking-wider text-parchment/45">{s.label}</span>
                                            <span className="font-mono text-xs text-parchment tabular-nums">{s.value}%</span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                                            <div
                                                className={`h-full rounded-full ${s.accent === 'gold' ? 'bg-gold' : 'bg-moss'}`}
                                                style={{ width: `${Math.min(100, s.value)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-3 border-t hairline-top pt-2 font-mono text-[10px] text-parchment/35 tabular-nums">
                                Within current filters · {filtered.completed}/{filtered.total} tasks done · weighted {filtered.completion}%
                            </p>
                        </Card>
                    )}

                    {/* ── Daily breakdown ─────────────────────────────────── */}
                    {breakdownDays.length === 0 ? (
                        <Card>
                            <p className="text-sm text-parchment/50">No activity matches these filters in the selected period.</p>
                        </Card>
                    ) : (
                        breakdownDays.map(day => {
                            const showNotes = !filters.frogsOnly && !filters.habitsOnly
                            return (
                                <Card key={day.date}>
                                    <DayHeader date={day.date} score={day.score} count={day.tasks.length + (showNotes ? day.notes.length : 0)} />
                                    <div className="space-y-1">
                                        {day.tasks.length === 0 && !showNotes && (
                                            <p className="text-xs text-parchment/40">No activity</p>
                                        )}
                                        {day.tasks.map(t => (
                                            <div key={t.id} className="flex items-center gap-2 text-xs">
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${t.completed ? 'bg-moss' : 'bg-gold'}`} />
                                                <span className={t.completed ? 'line-through text-parchment/45' : 'text-parchment'}>{t.title}</span>
                                                <span className="hidden font-mono text-parchment/35 sm:inline">{t.categoryTitle ?? t.priority ?? ''}</span>
                                                <span className="ml-auto font-mono text-parchment/40 tabular-nums">{t.weight}%</span>
                                            </div>
                                        ))}
                                        {showNotes && day.notes.map(n => (
                                            <div key={n.id} className="flex items-center gap-2 text-xs">
                                                <span className="h-2 w-2 shrink-0 rounded-full bg-gold-dim" />
                                                <span className="text-parchment/55">{n.title}</span>
                                                <span className="ml-auto font-mono text-[9px] uppercase text-parchment/35">note</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )
                        })
                    )}
                    </>
                )}
        </div>
    )
}