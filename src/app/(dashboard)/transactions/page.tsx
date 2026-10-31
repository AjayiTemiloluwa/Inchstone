'use client'

import React, { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, SlidersHorizontal } from 'lucide-react'
import {
    Badge,
    Button,
    EmptyState,
    Field,
    IconButton,
    Page,
    PageHeader,
    Panel,
    Section,
    Skeleton,
    Stat,
    StatGrid,
    cx,
    inputClass,
    type Tone,
} from '@/components/ds'
import { PurseMark, Sheet, labelClass } from '@/components/finance/ui'

interface Entry {
    id: string
    type: string
    amount: number
    category: string
    description: string | null
    comments: string | null
    entryDate: string
    priority: string | null
    purse: string
}

interface Purse {
    id: string
    name: string
    icon: string
    color: string
}

type SortKey = 'date' | 'amount' | 'category'

const PAGE_SIZE = 50

const thClass = cx(labelClass, 'px-4 py-3 font-normal')

function calculatePurseBreakdown(entries: Entry[]) {
    const breakdown: Record<string, { income: number; expense: number; net: number }> = {}
    entries.forEach(e => {
        if (!breakdown[e.purse]) breakdown[e.purse] = { income: 0, expense: 0, net: 0 }
        if (e.type === 'income' || e.type === 'transfer_in') breakdown[e.purse].income += e.amount
        if (e.type === 'expense' || e.type === 'transfer_out') breakdown[e.purse].expense += e.amount
        breakdown[e.purse].net = breakdown[e.purse].income - breakdown[e.purse].expense
    })
    return breakdown
}

function calculateMonthlyTrend(entries: Entry[]) {
    const trend: Record<string, { income: number; expense: number }> = {}
    entries.forEach(e => {
        const month = e.entryDate.slice(0, 7)
        if (!trend[month]) trend[month] = { income: 0, expense: 0 }
        if (e.type === 'income') trend[month].income += e.amount
        if (e.type === 'expense') trend[month].expense += e.amount
    })
    return trend
}

const isCredit = (type: string) => type === 'income' || type === 'transfer_in'

const TYPE_TONE: Record<string, Tone> = { income: 'moss', expense: 'ember', transfer_in: 'gold', transfer_out: 'neutral' }

function TypeBadge({ type }: { type: string }) {
    return <Badge tone={TYPE_TONE[type] ?? 'neutral'} className="whitespace-nowrap">{type.replace('_', ' ')}</Badge>
}

function SectionBadge({ priority }: { priority: string | null }) {
    if (!priority || !['Need', 'Want', 'Offerings', 'Savings'].includes(priority)) return null
    return <Badge tone={priority === 'Offerings' ? 'moss' : 'neutral'}>{priority}</Badge>
}

function PurseLabel({ name }: { name: string }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-parchment/70">
            <PurseMark name={name} size="sm" />
            <span className="truncate">{name}</span>
        </span>
    )
}

function AmountText({ entry, className = '' }: { entry: Entry; className?: string }) {
    const credit = isCredit(entry.type)
    return (
        <span className={cx('whitespace-nowrap font-mono tabular-nums', credit ? 'text-moss' : 'text-ember', className)}>
            {credit ? '+' : '-'}₦{entry.amount.toFixed(2)}
        </span>
    )
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionsPage() {
    const [entries, setEntries] = useState<Entry[]>([])
    const [purses, setPurses] = useState<Purse[]>([])
    const [filterPurse, setFilterPurse] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterType, setFilterType] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sortBy, setSortBy] = useState<SortKey>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [analysis, setAnalysis] = useState<{
        totalIncome: number
        totalExpense: number
        netFlow: number
        categoryBreakdown: Record<string, { total: number; count: number; type: string }>
        purseBreakdown: Record<string, { income: number; expense: number; net: number }>
        monthlyTrend: Record<string, { income: number; expense: number }>
    } | null>(null)

    // Loading is derived: it is true until the latest query key has finished loading.
    const queryKey = JSON.stringify([filterPurse, filterCategory, filterType, startDate, endDate, page])
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const loading = loadedKey !== queryKey

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const params = new URLSearchParams()
                if (filterPurse) params.set('purse', filterPurse)
                if (filterCategory) params.set('category', filterCategory)
                if (filterType) params.set('type', filterType)
                if (startDate) params.set('startDate', startDate)
                if (endDate) params.set('endDate', endDate)
                params.set('limit', PAGE_SIZE.toString())
                params.set('offset', (page * PAGE_SIZE).toString())

                const [finRes, purseRes] = await Promise.all([
                    fetch(`/api/financial?${params.toString()}`),
                    fetch('/api/purses'),
                ])
                if (cancelled) return

                if (finRes.ok) {
                    const data = await finRes.json()
                    if (cancelled) return
                    setEntries(data.entries || [])
                    setTotalCount(data.totalCount || 0)
                    setAnalysis({
                        totalIncome: data.totalIncome || 0,
                        totalExpense: data.totalExpense || 0,
                        netFlow: (data.totalIncome || 0) - (data.totalExpense || 0),
                        categoryBreakdown: data.categoryBreakdown || {},
                        purseBreakdown: calculatePurseBreakdown(data.entries || []),
                        monthlyTrend: calculateMonthlyTrend(data.entries || []),
                    })
                }

                if (purseRes.ok) {
                    const data = await purseRes.json()
                    if (cancelled) return
                    setPurses(data.purses || [])
                }
            } catch (err) {
                console.error(err)
            } finally {
                if (!cancelled) setLoadedKey(queryKey)
            }
        }
        load()
        return () => { cancelled = true }
    }, [queryKey, filterPurse, filterCategory, filterType, startDate, endDate, page])

    const handleDownloadCSV = () => {
        const headers = ['Date', 'Type', 'Category', 'Description', 'Amount (₦)', 'Purse', 'Section', 'Comments']
        const rows = entries.map(e => [
            new Date(e.entryDate).toLocaleDateString('en-US'),
            e.type,
            e.category,
            e.description || '',
            e.amount.toFixed(2),
            e.purse,
            e.priority || '',
            e.comments || '',
        ])

        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleDownloadJSON = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            summary: analysis ? {
                totalIncome: analysis.totalIncome,
                totalExpense: analysis.totalExpense,
                netFlow: analysis.netFlow,
            } : null,
            transactions: entries,
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transactions_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const sortedEntries = [...entries].sort((a, b) => {
        let cmp = 0
        if (sortBy === 'date') cmp = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
        else if (sortBy === 'amount') cmp = a.amount - b.amount
        else if (sortBy === 'category') cmp = a.category.localeCompare(b.category)
        return sortDir === 'desc' ? -cmp : cmp
    })

    const totalPages = Math.ceil(totalCount / PAGE_SIZE)


    // Phones: filters live in a bottom sheet; the button keeps a live count.
    const [filtersOpen, setFiltersOpen] = useState(false)
    const activeFilterCount = [filterPurse, filterType, filterCategory, startDate, endDate].filter(Boolean).length

    const filterFields = (
        <>
            <Field label="Purse">
                <select
                    value={filterPurse}
                    onChange={(e) => { setFilterPurse(e.target.value); setPage(0) }}
                    className={inputClass}
                >
                    <option value="">All purses</option>
                    {purses.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                </select>
            </Field>
            <Field label="Type">
                <select
                    value={filterType}
                    onChange={(e) => { setFilterType(e.target.value); setPage(0) }}
                    className={inputClass}
                >
                    <option value="">All types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="transfer_in">Transfer In</option>
                    <option value="transfer_out">Transfer Out</option>
                </select>
            </Field>
            <Field label="Category">
                <input
                    type="text"
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setPage(0) }}
                    className={inputClass}
                    placeholder="Filter category..."
                />
            </Field>
            <Field label="Start date">
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
                    className={inputClass}
                />
            </Field>
            <Field label="End date">
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
                    className={inputClass}
                />
            </Field>
        </>
    )

    const sortControl = (
        <div className="flex items-center gap-1">
            <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                aria-label="Sort by"
                className={cx(inputClass, 'min-h-9 w-auto py-0 pr-8 text-xs')}
            >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="category">Category</option>
            </select>
            <IconButton
                icon={sortDir === 'asc' ? ArrowUp : ArrowDown}
                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
                className="text-gold"
            />
        </div>
    )

    return (
        <Page width="wide">
            <PageHeader
                eyebrow="Ledger · analysis"
                title="Transactions"
                description="View, filter, download, and analyze all your financial transactions."
                actions={
                    <>
                        <Button variant="primary" icon={Download} onClick={handleDownloadCSV}>CSV</Button>
                        <Button variant="secondary" icon={Download} onClick={handleDownloadJSON}>JSON</Button>
                    </>
                }
            />

            {/* Filters: inline on desktop, a bottom sheet on phones */}
            <Section id="tx-filters" title="Filters">
                <div className="hidden grid-cols-3 gap-4 lg:grid xl:grid-cols-5">{filterFields}</div>
                <div className="lg:hidden">
                    <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
                        Filters
                        {activeFilterCount > 0 && <Badge tone="gold">{activeFilterCount}</Badge>}
                    </Button>
                    <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
                        {filterFields}
                    </Sheet>
                </div>
            </Section>

            {/* Analysis summary */}
            {analysis && (
                <Section id="tx-summary" title="Summary">
                    <StatGrid cols={3}>
                        <Stat label="Total income" tone="moss" value={<span className="block break-all font-mono text-heading">₦{analysis.totalIncome.toFixed(2)}</span>} />
                        <Stat label="Total expenses" tone="ember" value={<span className="block break-all font-mono text-heading">₦{analysis.totalExpense.toFixed(2)}</span>} />
                        <Stat
                            label="Net cash flow"
                            tone={analysis.netFlow >= 0 ? 'gold' : 'ember'}
                            className="col-span-2 sm:col-span-1"
                            value={<span className="block break-all font-mono text-heading">{analysis.netFlow >= 0 ? '+' : ''}₦{analysis.netFlow.toFixed(2)}</span>}
                        />
                    </StatGrid>
                </Section>
            )}

            {/* Category + monthly breakdowns side by side on wide screens */}
            {analysis && (Object.keys(analysis.categoryBreakdown).length > 0 || Object.keys(analysis.monthlyTrend).length > 0) && (
                <div className="grid grid-cols-1 items-start gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-6">
                    {Object.keys(analysis.categoryBreakdown).length > 0 && (
                        <Section id="tx-categories" title="Category breakdown">
                            <Panel padded={false}>
                                <ul className="divide-y divide-gold/10">
                                    {Object.entries(analysis.categoryBreakdown)
                                        .sort(([, a], [, b]) => b.total - a.total)
                                        .map(([cat, data]) => (
                                            <li key={cat} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-body text-parchment">{cat}</p>
                                                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-parchment/45">
                                                        {data.count} {data.count === 1 ? 'entry' : 'entries'}
                                                    </p>
                                                </div>
                                                <Badge tone={data.type === 'expense' ? 'ember' : 'moss'}>{data.type}</Badge>
                                                <span className={cx('w-28 shrink-0 text-right font-mono tabular-nums', data.type === 'expense' ? 'text-ember' : 'text-moss')}>
                                                    ₦{data.total.toFixed(2)}
                                                </span>
                                            </li>
                                        ))}
                                </ul>
                            </Panel>
                        </Section>
                    )}

                    {Object.keys(analysis.monthlyTrend).length > 0 && (
                        <Section id="tx-trend" title="Monthly trend">
                            <Panel padded={false}>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gold/15">
                                            <th scope="col" className={cx(thClass, 'text-left')}>Month</th>
                                            <th scope="col" className={cx(thClass, 'text-right')}>Income</th>
                                            <th scope="col" className={cx(thClass, 'text-right')}>Expense</th>
                                            <th scope="col" className={cx(thClass, 'text-right')}>Net</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gold/10 font-mono tabular-nums">
                                        {Object.entries(analysis.monthlyTrend)
                                            .sort(([a], [b]) => b.localeCompare(a))
                                            .map(([month, data]) => {
                                                const net = data.income - data.expense
                                                return (
                                                    <tr key={month}>
                                                        <td className="px-4 py-3 text-parchment/70">{month}</td>
                                                        <td className="px-4 py-3 text-right text-moss">₦{data.income.toFixed(0)}</td>
                                                        <td className="px-4 py-3 text-right text-ember">₦{data.expense.toFixed(0)}</td>
                                                        <td className={cx('px-4 py-3 text-right', net >= 0 ? 'text-gold' : 'text-ember')}>
                                                            {net >= 0 ? '+' : ''}₦{net.toFixed(0)}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </Panel>
                        </Section>
                    )}
                </div>
            )}

            {/* Purse breakdown */}
            {analysis && Object.keys(analysis.purseBreakdown).length > 0 && (
                <Section id="tx-purses" title="Purse breakdown">
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                        {Object.entries(analysis.purseBreakdown).map(([name, data]) => (
                            <li key={name} className="min-w-0">
                                <Panel className="h-full space-y-4">
                                    <div className="flex items-center gap-3">
                                        <PurseMark name={name} />
                                        <p className="truncate text-heading text-parchment">{name}</p>
                                    </div>
                                    <dl className="grid grid-cols-3 gap-3 font-mono tabular-nums">
                                        <div className="min-w-0">
                                            <dt className={labelClass}>Income</dt>
                                            <dd className="mt-1 truncate text-moss">₦{data.income.toFixed(0)}</dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className={labelClass}>Expense</dt>
                                            <dd className="mt-1 truncate text-ember">₦{data.expense.toFixed(0)}</dd>
                                        </div>
                                        <div className="min-w-0 text-right">
                                            <dt className={labelClass}>Net</dt>
                                            <dd className={cx('mt-1 truncate', data.net >= 0 ? 'text-gold' : 'text-ember')}>
                                                {data.net >= 0 ? '+' : ''}₦{data.net.toFixed(0)}
                                            </dd>
                                        </div>
                                    </dl>
                                </Panel>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Transactions */}
            <Section
                id="tx-all"
                title={<>All transactions · <span className="tabular-nums">{totalCount}</span> total</>}
                action={sortControl}
            >
                {loading ? (
                    <div className="space-y-2" role="status">
                        <span className="sr-only">Loading transactions...</span>
                        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14" />)}
                    </div>
                ) : sortedEntries.length === 0 ? (
                    <EmptyState title="No transactions found matching your filters." />
                ) : (
                    <Panel padded={false} className="overflow-hidden">
                        {/* Below lg: two-line row cards (never a sideways-scrolling table) */}
                        <ul className="divide-y divide-gold/10 lg:hidden">
                            {sortedEntries.map(entry => (
                                <li key={entry.id} className="space-y-1 px-4 py-3">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="min-w-0 truncate text-body text-parchment">{entry.category}</p>
                                        <AmountText entry={entry} className="shrink-0 text-body" />
                                    </div>
                                    <p className="truncate font-mono text-[11px] tabular-nums text-parchment/45">
                                        {formatDate(entry.entryDate)} · {entry.purse} · {entry.type.replace('_', ' ')}
                                        {entry.priority && ['Need', 'Want', 'Offerings', 'Savings'].includes(entry.priority) && <> · {entry.priority}</>}
                                    </p>
                                    {entry.description && (
                                        <p className="break-words text-caption text-parchment/60">{entry.description}</p>
                                    )}
                                    {entry.comments && (
                                        <p className="break-words text-caption text-parchment/45">{entry.comments}</p>
                                    )}
                                </li>
                            ))}
                        </ul>

                        {/* lg and up: the full table */}
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gold/15">
                                        <th scope="col" className={cx(thClass, 'text-left')}>Date</th>
                                        <th scope="col" className={cx(thClass, 'text-left')}>Type</th>
                                        <th scope="col" className={cx(thClass, 'text-left')}>Category</th>
                                        <th scope="col" className={cx(thClass, 'text-left')}>Description</th>
                                        <th scope="col" className={cx(thClass, 'text-right')}>Amount (₦)</th>
                                        <th scope="col" className={cx(thClass, 'text-left')}>Purse</th>
                                        <th scope="col" className={cx(thClass, 'text-left')}>Section</th>
                                        <th scope="col" className={cx(thClass, 'text-left')}>Comments</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gold/10">
                                    {sortedEntries.map(entry => (
                                        <tr key={entry.id} className="transition-colors hover:bg-gold/[0.03]">
                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-mono tabular-nums text-parchment/45">{formatDate(entry.entryDate)}</td>
                                            <td className="px-4 py-3"><TypeBadge type={entry.type} /></td>
                                            <td className="px-4 py-3 text-parchment">{entry.category}</td>
                                            <td className="max-w-[200px] truncate px-4 py-3 text-parchment/55">{entry.description || '-'}</td>
                                            <td className="px-4 py-3 text-right"><AmountText entry={entry} /></td>
                                            <td className="max-w-[160px] px-4 py-3"><PurseLabel name={entry.purse} /></td>
                                            <td className="px-4 py-3 text-parchment/40">
                                                {entry.priority ? <SectionBadge priority={entry.priority} /> : '-'}
                                            </td>
                                            <td className="max-w-[150px] truncate px-4 py-3 text-caption text-parchment/45">{entry.comments || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2">
                        <Button
                            variant="secondary"
                            icon={ChevronLeft}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            Previous
                        </Button>
                        <span className="text-center font-mono text-mono tabular-nums text-parchment/50">
                            Page {page + 1} of {totalPages}
                        </span>
                        <Button
                            variant="secondary"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                    </nav>
                )}
            </Section>
        </Page>
    )
}
