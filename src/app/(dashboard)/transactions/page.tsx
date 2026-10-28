'use client'

import React, { useEffect, useState } from 'react'

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

const fieldClass =
    'w-full bg-white/5 border border-white/10 rounded-lg py-2.5 md:py-2 px-3 text-sm text-parchment focus:outline-none focus:border-gold/40 min-h-[40px]'
const labelClass = 'block text-xs text-parchment/50 mb-1'
const thClass = 'p-3 font-semibold text-parchment/50 text-xs uppercase'
const cardClass = 'bg-surface-solid border-hairline rounded-xl border border-white/10'

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

function TypeBadge({ type }: { type: string }) {
    const tone =
        type === 'income' ? 'bg-moss/15 text-moss' :
        type === 'expense' ? 'bg-ember/15 text-ember' :
        type === 'transfer_in' ? 'bg-gold/15 text-gold' :
        'bg-gold-dim/20 text-gold-glow'
    const icon = type === 'income' ? '📥' : type === 'expense' ? '💸' : type === 'transfer_in' ? '📩' : '📤'
    return (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${tone}`}>
            {icon} {type.replace('_', ' ')}
        </span>
    )
}

function SectionBadge({ priority }: { priority: string | null }) {
    if (!priority || !['Need', 'Want', 'Offerings', 'Savings'].includes(priority)) return null
    const tone =
        priority === 'Need' ? 'bg-gold/15 text-gold' :
        priority === 'Want' ? 'bg-gold-glow/15 text-gold-glow' :
        priority === 'Offerings' ? 'bg-moss/15 text-moss' :
        'bg-white/10 text-parchment/70'
    const icon = priority === 'Need' ? '💪' : priority === 'Want' ? '🌟' : priority === 'Offerings' ? '🙏' : '🏦'
    return (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${tone}`}>
            {icon} {priority}
        </span>
    )
}

function PurseBadge({ name, icon, color }: { name: string; icon: string; color: string }) {
    return (
        <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1"
            style={{ backgroundColor: `${color}20`, color }}
        >
            {icon} {name}
        </span>
    )
}

function AmountText({ entry, className = '' }: { entry: Entry; className?: string }) {
    const credit = isCredit(entry.type)
    return (
        <span className={`font-semibold whitespace-nowrap ${credit ? 'text-moss' : 'text-ember'} ${className}`}>
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

    const getPurseIcon = (name: string) => {
        const p = purses.find(p => p.name === name)
        return p?.icon || '👜'
    }

    const getPurseColor = (name: string) => {
        const p = purses.find(p => p.name === name)
        return p?.color || '#8a6d42'
    }

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

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-24 text-parchment">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold mb-1">📊 Transactions & Analysis</h1>
                    <p className="text-sm text-parchment/50">View, filter, download, and analyze all your financial transactions.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadCSV}
                        className="px-4 py-2.5 min-h-[40px] bg-gold hover:bg-gold-glow text-ink text-sm font-medium rounded-lg transition-colors"
                    >
                        📥 CSV
                    </button>
                    <button
                        onClick={handleDownloadJSON}
                        className="px-4 py-2.5 min-h-[40px] bg-white/5 hover:bg-white/10 border border-gold/30 text-gold text-sm font-medium rounded-lg transition-colors"
                    >
                        📥 JSON
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className={`${cardClass} p-4`}>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                        <label className={labelClass}>Purse</label>
                        <select
                            value={filterPurse}
                            onChange={(e) => { setFilterPurse(e.target.value); setPage(0) }}
                            className={fieldClass}
                        >
                            <option value="">All Purses</option>
                            {purses.map(p => (
                                <option key={p.id} value={p.name}>{p.icon} {p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Type</label>
                        <select
                            value={filterType}
                            onChange={(e) => { setFilterType(e.target.value); setPage(0) }}
                            className={fieldClass}
                        >
                            <option value="">All Types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="transfer_in">Transfer In</option>
                            <option value="transfer_out">Transfer Out</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Category</label>
                        <input
                            type="text"
                            value={filterCategory}
                            onChange={(e) => { setFilterCategory(e.target.value); setPage(0) }}
                            className={fieldClass}
                            placeholder="Filter category..."
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Sort By</label>
                        <div className="flex gap-1">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortKey)}
                                className={`${fieldClass} flex-1`}
                            >
                                <option value="date">Date</option>
                                <option value="amount">Amount</option>
                                <option value="category">Category</option>
                            </select>
                            <button
                                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                                aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
                                className="px-3 min-w-[44px] min-h-[40px] bg-white/5 border border-white/10 rounded-lg text-sm text-gold"
                            >
                                {sortDir === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analysis Summary */}
            {analysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-moss/10 p-5 rounded-xl border border-moss/30">
                        <div className="text-xs text-moss font-medium uppercase tracking-wider mb-1">Total Income</div>
                        <div className="text-2xl font-bold text-moss">₦{analysis.totalIncome.toFixed(2)}</div>
                    </div>
                    <div className="bg-ember/10 p-5 rounded-xl border border-ember/30">
                        <div className="text-xs text-ember font-medium uppercase tracking-wider mb-1">Total Expenses</div>
                        <div className="text-2xl font-bold text-ember">₦{analysis.totalExpense.toFixed(2)}</div>
                    </div>
                    <div className={`p-5 rounded-xl border ${analysis.netFlow >= 0 ? 'bg-gold/10 border-gold/30' : 'bg-ember/10 border-ember/30'}`}>
                        <div className="text-xs font-medium uppercase tracking-wider mb-1 text-parchment/50">Net Cash Flow</div>
                        <div className={`text-2xl font-bold ${analysis.netFlow >= 0 ? 'text-gold' : 'text-ember'}`}>
                            {analysis.netFlow >= 0 ? '+' : ''}₦{analysis.netFlow.toFixed(2)}
                        </div>
                    </div>
                </div>
            )}

            {/* Category Breakdown */}
            {analysis && Object.keys(analysis.categoryBreakdown).length > 0 && (
                <div className={`${cardClass} p-5`}>
                    <h2 className="text-lg font-semibold mb-4">📂 Category Breakdown</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left p-2 font-semibold text-parchment/50 text-xs uppercase">Category</th>
                                    <th className="text-right p-2 font-semibold text-parchment/50 text-xs uppercase">Total (₦)</th>
                                    <th className="text-right p-2 font-semibold text-parchment/50 text-xs uppercase">Count</th>
                                    <th className="text-left p-2 font-semibold text-parchment/50 text-xs uppercase">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {Object.entries(analysis.categoryBreakdown)
                                    .sort(([, a], [, b]) => b.total - a.total)
                                    .map(([cat, data]) => (
                                        <tr key={cat} className="hover:bg-white/5">
                                            <td className="p-2 font-medium">{cat}</td>
                                            <td className={`p-2 text-right font-semibold ${data.type === 'expense' ? 'text-ember' : 'text-moss'}`}>
                                                ₦{data.total.toFixed(2)}
                                            </td>
                                            <td className="p-2 text-right text-parchment/50">{data.count}</td>
                                            <td className="p-2">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${data.type === 'expense' ? 'bg-ember/15 text-ember' : 'bg-moss/15 text-moss'}`}>
                                                    {data.type}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Purse Breakdown */}
            {analysis && Object.keys(analysis.purseBreakdown).length > 0 && (
                <div className={`${cardClass} p-5`}>
                    <h2 className="text-lg font-semibold mb-4">👛 Purse Breakdown</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(analysis.purseBreakdown).map(([name, data]) => (
                            <div key={name} className="p-4 rounded-xl border border-white/10 bg-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{getPurseIcon(name)}</span>
                                    <span className="font-semibold">{name}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <div className="text-[10px] text-parchment/40">Income</div>
                                        <div className="font-semibold text-moss">₦{data.income.toFixed(0)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-parchment/40">Expense</div>
                                        <div className="font-semibold text-ember">₦{data.expense.toFixed(0)}</div>
                                    </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-white/10">
                                    <div className="text-[10px] text-parchment/40">Net</div>
                                    <div className={`font-bold ${data.net >= 0 ? 'text-parchment' : 'text-ember'}`}>
                                        {data.net >= 0 ? '+' : ''}₦{data.net.toFixed(0)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Monthly Trend */}
            {analysis && Object.keys(analysis.monthlyTrend).length > 0 && (
                <div className={`${cardClass} p-5`}>
                    <h2 className="text-lg font-semibold mb-4">📈 Monthly Trend</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left p-2 font-semibold text-parchment/50 text-xs uppercase">Month</th>
                                    <th className="text-right p-2 font-semibold text-parchment/50 text-xs uppercase">Income (₦)</th>
                                    <th className="text-right p-2 font-semibold text-parchment/50 text-xs uppercase">Expense (₦)</th>
                                    <th className="text-right p-2 font-semibold text-parchment/50 text-xs uppercase">Net (₦)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {Object.entries(analysis.monthlyTrend)
                                    .sort(([a], [b]) => b.localeCompare(a))
                                    .map(([month, data]) => {
                                        const net = data.income - data.expense
                                        return (
                                            <tr key={month} className="hover:bg-white/5">
                                                <td className="p-2 font-medium">{month}</td>
                                                <td className="p-2 text-right text-moss font-semibold">₦{data.income.toFixed(0)}</td>
                                                <td className="p-2 text-right text-ember font-semibold">₦{data.expense.toFixed(0)}</td>
                                                <td className={`p-2 text-right font-bold ${net >= 0 ? 'text-parchment' : 'text-ember'}`}>
                                                    {net >= 0 ? '+' : ''}₦{net.toFixed(0)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Transactions */}
            <div className={`${cardClass} overflow-hidden`}>
                <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">📋 All Transactions</h2>
                    <span className="text-sm text-parchment/50">{totalCount} total</span>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-parchment/50">Loading transactions...</div>
                ) : sortedEntries.length === 0 ? (
                    <div className="p-8 text-center text-parchment/50">No transactions found matching your filters.</div>
                ) : (
                    <>
                        {/* Phones: stacked cards */}
                        <ul className="md:hidden divide-y divide-white/5">
                            {sortedEntries.map(entry => (
                                <li key={entry.id} className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-medium break-words">{entry.category}</div>
                                            <div className="text-xs text-parchment/50">{formatDate(entry.entryDate)}</div>
                                        </div>
                                        <AmountText entry={entry} className="text-lg" />
                                    </div>
                                    {entry.description && (
                                        <p className="text-sm text-parchment/70 break-words">{entry.description}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <TypeBadge type={entry.type} />
                                        <PurseBadge name={entry.purse} icon={getPurseIcon(entry.purse)} color={getPurseColor(entry.purse)} />
                                        <SectionBadge priority={entry.priority} />
                                    </div>
                                    {entry.comments && (
                                        <p className="text-xs text-parchment/50 break-words">{entry.comments}</p>
                                    )}
                                </li>
                            ))}
                        </ul>

                        {/* md and up: table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm min-w-[860px]">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5">
                                        <th className={`text-left ${thClass}`}>Date</th>
                                        <th className={`text-left ${thClass}`}>Type</th>
                                        <th className={`text-left ${thClass}`}>Category</th>
                                        <th className={`text-left ${thClass}`}>Description</th>
                                        <th className={`text-right ${thClass}`}>Amount (₦)</th>
                                        <th className={`text-left ${thClass}`}>Purse</th>
                                        <th className={`text-left ${thClass}`}>Section</th>
                                        <th className={`text-left ${thClass}`}>Comments</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {sortedEntries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 whitespace-nowrap text-xs text-parchment/50">{formatDate(entry.entryDate)}</td>
                                            <td className="p-3"><TypeBadge type={entry.type} /></td>
                                            <td className="p-3 font-medium">{entry.category}</td>
                                            <td className="p-3 text-parchment/50 max-w-[200px] truncate">{entry.description || '-'}</td>
                                            <td className="p-3 text-right"><AmountText entry={entry} /></td>
                                            <td className="p-3">
                                                <PurseBadge name={entry.purse} icon={getPurseIcon(entry.purse)} color={getPurseColor(entry.purse)} />
                                            </td>
                                            <td className="p-3 text-xs">
                                                {entry.priority ? <SectionBadge priority={entry.priority} /> : '-'}
                                            </td>
                                            <td className="p-3 text-xs text-parchment/50 max-w-[150px] truncate">{entry.comments || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/10 flex items-center justify-between gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-2.5 min-h-[40px] text-sm bg-white/5 border border-white/10 rounded-lg disabled:opacity-50 hover:bg-white/10 transition-colors"
                        >
                            ← Previous
                        </button>
                        <span className="text-sm text-parchment/50 text-center">
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-2.5 min-h-[40px] text-sm bg-white/5 border border-white/10 rounded-lg disabled:opacity-50 hover:bg-white/10 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
