'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader } from '@/components/ui/Loader'
import {
    ChevronLeft, ChevronRight, Download, Search,
} from 'lucide-react'
import { format, parseISO, addMonths, addWeeks, addQuarters, addYears, addDays } from 'date-fns'
import jsPDF from 'jspdf'
import { Scramble } from '@/components/ui/motion'
import type { Report, ReportTask, ReportType } from '@/lib/reports/types'
import { ScoreBarChart, CompletionDonut, BreakdownBars, scoreColor } from '@/components/reports/charts'
import {
    DEFAULT_FILTERS, DEFAULT_SORT, filterDayTasks, dayVisible, sortDays,
    type TaskFilters, type TaskSort,
} from '@/lib/reports/selectors'
import { FilterPanel, DayHeader, ChartPanel, PERIOD_OPTIONS, monoLabel, selectClass } from '@/components/reports/panel'
import {
    Page, PageHeader, Section, Panel, StatGrid, Stat, EmptyState, Field, Button, IconButton, Segmented, inputClass, cx,
} from '@/components/ds'

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

    const legend = [
        { label: '100%', color: scoreColor(100, true) },
        { label: '40–99%', color: scoreColor(40, true) },
        { label: 'under 40%', color: scoreColor(0, true) },
        { label: 'inactive', color: scoreColor(0, false) },
    ]

    return (
        <Page width="wide" className="pb-24">
            {/* Header: title + period selector + time navigation, read as one block */}
            <div className="space-y-6">
                <PageHeader
                    eyebrow={report ? `${fmtDate(report.period.start)} → ${fmtDate(report.period.end)}` : 'Activity'}
                    title={<Scramble text="Reports" mono={false} />}
                    description="Customisable activity reports: charts, filters and time ranges."
                    actions={report && (
                        <Button variant="secondary" icon={Download} onClick={downloadPDF} data-cursor="Save it as a PDF">
                            Download PDF
                        </Button>
                    )}
                />

                <div className="flex flex-col gap-2 border-b border-gold/15 sm:flex-row sm:items-center sm:justify-between">
                    <Segmented
                        options={PERIOD_OPTIONS}
                        value={reportType}
                        onChange={handleTypeChange}
                        ariaLabel="Report period"
                    />
                    {reportType !== 'custom' && (
                        <div className="flex items-center gap-1 pb-2 sm:pb-0">
                            <IconButton icon={ChevronLeft} label="Previous period" onClick={() => go(-1)} />
                            <Button variant="ghost" size="sm" onClick={goToday} className="min-h-11 pointer-fine:min-h-9">Today</Button>
                            <IconButton icon={ChevronRight} label="Next period" onClick={() => go(1)} />
                        </div>
                    )}
                </div>

                {reportType === 'custom' && (
                    <Panel>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                            <Field label="Start">
                                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                    className={cx(inputClass, 'font-mono tabular-nums')} />
                            </Field>
                            <Field label="End">
                                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                    className={cx(inputClass, 'font-mono tabular-nums')} />
                            </Field>
                            <Button variant="primary" onClick={applyCustom}>Apply range</Button>
                        </div>
                    </Panel>
                )}
            </div>

            {loading && <Panel><Loader compact label="Refreshing…" /></Panel>}

            {report && (
                <>
                    {/* ── Summary ─────────────────────────────────────── */}
                    <Section id="reports-summary" title="Summary">
                        <StatGrid>
                            <Stat label="Best day" tone="moss"
                                value={report.stats.bestDay ? fmtDayShort(report.stats.bestDay) : '—'}
                                caption={report.stats.bestDay ? <span className="font-mono tabular-nums">{report.stats.bestDayScore}%</span> : undefined} />
                            <Stat label="Worst active" tone="ember"
                                value={report.stats.worstDay ? fmtDayShort(report.stats.worstDay) : '—'}
                                caption={report.stats.worstDay ? <span className="font-mono tabular-nums">{report.stats.worstDayScore}%</span> : undefined} />
                            <Stat label="Best streak" tone="gold"
                                value={`${report.stats.bestStreak}d`}
                                caption={<span className="font-mono tabular-nums">Current {report.stats.currentStreak}d</span>} />
                            <Stat label="Active days"
                                value={`${report.stats.activeDays}/${report.days.length}`}
                                caption={<span className="font-mono tabular-nums">{report.stats.avgTasksPerActiveDay} tasks/day</span>} />
                        </StatGrid>
                    </Section>

                    {/* ── Score trend + completion ───────────────────── */}
                    <Section id="reports-trend" title="Score and completion">
                        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
                            <ChartPanel
                                className="lg:col-span-2"
                                title="Daily score trend"
                                aside={`Avg ${report.stats.avgScore}%`}
                                footer={
                                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-parchment/45">
                                        {legend.map(l => (
                                            <li key={l.label} className="flex items-center gap-1.5">
                                                <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                                                {l.label}
                                            </li>
                                        ))}
                                    </ul>
                                }
                            >
                                <ScoreBarChart days={report.days} height={220} />
                            </ChartPanel>

                            <ChartPanel
                                title="Completion"
                                footer={
                                    <dl className="space-y-2 font-mono text-mono text-parchment/50 tabular-nums">
                                        <div className="flex justify-between"><dt>By task</dt><dd className="text-parchment">{report.stats.completedTasks}/{report.stats.totalTasks}</dd></div>
                                        <div className="flex justify-between"><dt>Weighted</dt><dd className="text-parchment">{report.stats.completion}%</dd></div>
                                        <div className="flex justify-between"><dt>Frogs</dt><dd className="text-parchment">{report.stats.frogsCompleted}/{report.stats.frogsTotal}</dd></div>
                                        <div className="flex justify-between"><dt>Habits</dt><dd className="text-parchment">{report.stats.habitsCompleted}/{report.stats.habitsTotal}</dd></div>
                                        <div className="flex justify-between"><dt>Notes written</dt><dd className="text-parchment">{report.stats.totalNotes}</dd></div>
                                    </dl>
                                }
                            >
                                <CompletionDonut scored={report.stats.weightedCompleted} max={report.stats.weightedTotal} />
                            </ChartPanel>
                        </div>
                    </Section>

                    {/* ── Category & priority breakdown ────────────────────── */}
                    <Section id="reports-breakdown" title="Breakdown">
                        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                            <ChartPanel title="By category">
                                <BreakdownBars rows={report.categories.map(c => ({ label: c.title, total: c.total, completed: c.completed }))} color="gold" />
                            </ChartPanel>
                            <ChartPanel title="By priority">
                                <BreakdownBars
                                    rows={report.priorities.map(p => ({
                                        label: p.priority[0].toUpperCase() + p.priority.slice(1),
                                        total: p.total,
                                        completed: p.completed,
                                    }))}
                                    color="moss" />
                            </ChartPanel>
                        </div>
                    </Section>

                    {/* ── Daily log: filter / sort / search + day cards ─────── */}
                    <Section
                        id="reports-log"
                        title="Daily log"
                        action={hasFilter ? <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gold">Reset filters</Button> : undefined}
                    >
                        <div className="space-y-4">
                            <Panel className="space-y-4">
                                <FilterPanel filters={filters} onChange={setFilters}
                                    categories={report.categories.map(c => ({ id: c.id, title: c.title }))} />

                                <div className="flex flex-col gap-3 border-t border-gold/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <label className="relative block w-full sm:max-w-xs">
                                        <span className="sr-only">Search tasks</span>
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment/35" strokeWidth={1.5} aria-hidden="true" />
                                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
                                            className={cx(inputClass, 'pl-9')} />
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <span className={monoLabel}>Sort by</span>
                                        <select value={sort} onChange={e => setSort(e.target.value as TaskSort)}
                                            className={selectClass}>
                                            <option value="date-asc">Date ↑</option>
                                            <option value="date-desc">Date ↓</option>
                                            <option value="score-desc">Score ↓</option>
                                            <option value="tasks-desc">Task count ↓</option>
                                        </select>
                                    </label>
                                </div>
                            </Panel>

                            {/* Filter-scoped completion mini-bars */}
                            {summaryBar.length > 0 && filtered && filtered.total > 0 && (
                                <Panel>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                                        {summaryBar.map(s => (
                                            <div key={s.label}>
                                                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                                                    <span className={monoLabel}>{s.label}</span>
                                                    <span className="font-mono text-mono text-parchment tabular-nums">{s.value}%</span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-parchment/[0.06]">
                                                    <div
                                                        className={cx('h-full rounded-full', s.accent === 'gold' ? 'bg-gold' : 'bg-moss')}
                                                        style={{ width: `${Math.min(100, s.value)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-4 border-t border-gold/10 pt-3 font-mono text-[10px] text-parchment/40 tabular-nums">
                                        Within current filters · {filtered.completed}/{filtered.total} tasks done · {filtered.completion}% of points
                                    </p>
                                </Panel>
                            )}

                            {breakdownDays.length === 0 ? (
                                <EmptyState
                                    title="Nothing to show"
                                    body="No activity matches these filters in the selected period."
                                    action={hasFilter ? <Button variant="secondary" onClick={clearFilters}>Reset filters</Button> : undefined}
                                />
                            ) : (
                                <ul className="space-y-3">
                                    {breakdownDays.map(day => {
                                        const showNotes = !filters.frogsOnly && !filters.habitsOnly
                                        return (
                                            <li key={day.date}>
                                                <Panel>
                                                    <DayHeader date={day.date} score={day.score} count={day.tasks.length + (showNotes ? day.notes.length : 0)} />
                                                    <div className="space-y-1.5">
                                                        {day.tasks.length === 0 && !showNotes && (
                                                            <p className="text-caption text-parchment/40">No activity</p>
                                                        )}
                                                        {day.tasks.map(t => (
                                                            <div key={t.id} className="flex items-start gap-2 text-sm sm:items-center">
                                                                <span aria-hidden="true" className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0', t.completed ? 'bg-moss' : 'bg-gold')} />
                                                                <span className={cx('min-w-0 break-words', t.completed ? 'line-through text-parchment/45' : 'text-parchment')}>{t.title}</span>
                                                                <span className="hidden font-mono text-mono text-parchment/35 sm:inline">{t.categoryTitle ?? t.priority ?? ''}</span>
                                                                <span className="ml-auto shrink-0 font-mono text-mono text-parchment/40 tabular-nums">{t.weight} pts</span>
                                                            </div>
                                                        ))}
                                                        {showNotes && day.notes.map(n => (
                                                            <div key={n.id} className="flex items-center gap-2 text-sm">
                                                                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-gold-dim" />
                                                                <span className="min-w-0 break-words text-parchment/55">{n.title}</span>
                                                                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-parchment/35">note</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Panel>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    </Section>
                </>
            )}
        </Page>
    )
}
