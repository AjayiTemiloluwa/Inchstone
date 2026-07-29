'use client'

import React, { useEffect, useState, useCallback } from 'react'

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

export default function TransactionsPage() {
    const [entries, setEntries] = useState<Entry[]>([])
    const [purses, setPurses] = useState<Purse[]>([])
    const [loading, setLoading] = useState(true)
    const [filterPurse, setFilterPurse] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterType, setFilterType] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date')
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
    const PAGE_SIZE = 50

    const fetchData = useCallback(async () => {
        setLoading(true)
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

            if (finRes.ok) {
                const data = await finRes.json()
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
                setPurses(data.purses || [])
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [filterPurse, filterCategory, filterType, startDate, endDate, page])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const calculatePurseBreakdown = (entries: Entry[]) => {
        const breakdown: Record<string, { income: number; expense: number; net: number }> = {}
        entries.forEach(e => {
            if (!breakdown[e.purse]) breakdown[e.purse] = { income: 0, expense: 0, net: 0 }
            if (e.type === 'income' || e.type === 'transfer_in') breakdown[e.purse].income += e.amount
            if (e.type === 'expense' || e.type === 'transfer_out') breakdown[e.purse].expense += e.amount
            breakdown[e.purse].net = breakdown[e.purse].income - breakdown[e.purse].expense
        })
        return breakdown
    }

    const calculateMonthlyTrend = (entries: Entry[]) => {
        const trend: Record<string, { income: number; expense: number }> = {}
        entries.forEach(e => {
            const month = e.entryDate.slice(0, 7)
            if (!trend[month]) trend[month] = { income: 0, expense: 0 }
            if (e.type === 'income') trend[month].income += e.amount
            if (e.type === 'expense') trend[month].expense += e.amount
        })
        return trend
    }

    const getPurseIcon = (name: string) => {
        const p = purses.find(p => p.name === name)
        return p?.icon || '👜'
    }

    const getPurseColor = (name: string) => {
        const p = purses.find(p => p.name === name)
        return p?.color || '#3B82F6'
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
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold mb-1">📊 Transactions & Analysis</h1>
                    <p className="text-sm text-gray-500">View, filter, download, and analyze all your financial transactions.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadCSV}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        📥 CSV
                    </button>
                    <button
                        onClick={handleDownloadJSON}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        📥 JSON
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Purse</label>
                        <select
                            value={filterPurse}
                            onChange={(e) => { setFilterPurse(e.target.value); setPage(0) }}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm"
                        >
                            <option value="">All Purses</option>
                            {purses.map(p => (
                                <option key={p.id} value={p.name}>{p.icon} {p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Type</label>
                        <select
                            value={filterType}
                            onChange={(e) => { setFilterType(e.target.value); setPage(0) }}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm"
                        >
                            <option value="">All Types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="transfer_in">Transfer In</option>
                            <option value="transfer_out">Transfer Out</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Category</label>
                        <input
                            type="text"
                            value={filterCategory}
                            onChange={(e) => { setFilterCategory(e.target.value); setPage(0) }}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm"
                            placeholder="Filter category..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Sort By</label>
                        <div className="flex gap-1">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm"
                            >
                                <option value="date">Date</option>
                                <option value="amount">Amount</option>
                                <option value="category">Category</option>
                            </select>
                            <button
                                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                                className="px-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
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
                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/5 p-5 rounded-xl border border-green-200 dark:border-green-800/40">
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium uppercase tracking-wider mb-1">Total Income</div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">₦{analysis.totalIncome.toFixed(2)}</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/5 p-5 rounded-xl border border-red-200 dark:border-red-800/40">
                        <div className="text-xs text-red-600 dark:text-red-400 font-medium uppercase tracking-wider mb-1">Total Expenses</div>
                        <div className="text-2xl font-bold text-red-700 dark:text-red-300">₦{analysis.totalExpense.toFixed(2)}</div>
                    </div>
                    <div className={`bg-gradient-to-br p-5 rounded-xl border ${analysis.netFlow >= 0 ? 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/5 border-blue-200 dark:border-blue-800/40' : 'from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/5 border-orange-200 dark:border-orange-800/40'}`}>
                        <div className="text-xs font-medium uppercase tracking-wider mb-1 text-gray-500">Net Cash Flow</div>
                        <div className={`text-2xl font-bold ${analysis.netFlow >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                            {analysis.netFlow >= 0 ? '+' : ''}₦{analysis.netFlow.toFixed(2)}
                        </div>
                    </div>
                </div>
            )}

            {/* Category Breakdown */}
            {analysis && Object.keys(analysis.categoryBreakdown).length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">📂 Category Breakdown</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700">
                                    <th className="text-left p-2 font-semibold text-gray-500 text-xs uppercase">Category</th>
                                    <th className="text-right p-2 font-semibold text-gray-500 text-xs uppercase">Total (₦)</th>
                                    <th className="text-right p-2 font-semibold text-gray-500 text-xs uppercase">Count</th>
                                    <th className="text-left p-2 font-semibold text-gray-500 text-xs uppercase">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {Object.entries(analysis.categoryBreakdown)
                                    .sort(([, a], [, b]) => b.total - a.total)
                                    .map(([cat, data]) => (
                                        <tr key={cat} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                            <td className="p-2 font-medium">{cat}</td>
                                            <td className={`p-2 text-right font-semibold ${data.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                                                ₦{data.total.toFixed(2)}
                                            </td>
                                            <td className="p-2 text-right text-gray-500">{data.count}</td>
                                            <td className="p-2">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${data.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">👛 Purse Breakdown</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(analysis.purseBreakdown).map(([name, data]) => (
                            <div key={name} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{getPurseIcon(name)}</span>
                                    <span className="font-semibold">{name}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <div className="text-[10px] text-gray-400">Income</div>
                                        <div className="font-semibold text-green-600">₦{data.income.toFixed(0)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400">Expense</div>
                                        <div className="font-semibold text-red-600">₦{data.expense.toFixed(0)}</div>
                                    </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <div className="text-[10px] text-gray-400">Net</div>
                                    <div className={`font-bold ${data.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
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
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">📈 Monthly Trend</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700">
                                    <th className="text-left p-2 font-semibold text-gray-500 text-xs uppercase">Month</th>
                                    <th className="text-right p-2 font-semibold text-gray-500 text-xs uppercase">Income (₦)</th>
                                    <th className="text-right p-2 font-semibold text-gray-500 text-xs uppercase">Expense (₦)</th>
                                    <th className="text-right p-2 font-semibold text-gray-500 text-xs uppercase">Net (₦)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {Object.entries(analysis.monthlyTrend)
                                    .sort(([a], [b]) => b.localeCompare(a))
                                    .map(([month, data]) => {
                                        const net = data.income - data.expense
                                        return (
                                            <tr key={month} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                                <td className="p-2 font-medium">{month}</td>
                                                <td className="p-2 text-right text-green-600 font-semibold">₦{data.income.toFixed(0)}</td>
                                                <td className="p-2 text-right text-red-600 font-semibold">₦{data.expense.toFixed(0)}</td>
                                                <td className={`p-2 text-right font-bold ${net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
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

            {/* Transactions Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">📋 All Transactions</h2>
                    <span className="text-sm text-gray-500">{totalCount} total</span>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading transactions...</div>
                ) : sortedEntries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No transactions found matching your filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                    <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase">Date</th>
                                    <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase">Type</th>
                                    <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase">Category</th>
                                    <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase">Description</th>
                                    <th className="text-right p-3 font-semibold text-gray-500 text-xs uppercase">Amount (₦)</th>
                                    <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase">Purse</th>
                                    <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase">Section</th>
                                    <th className="text-left p-3 font-semibold text-gray-500 text-xs uppercase">Comments</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {sortedEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                                            {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="p-3">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${entry.type === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    entry.type === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        entry.type === 'transfer_in' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                }`}>
                                                {entry.type === 'income' ? '📥' : entry.type === 'expense' ? '💸' : entry.type === 'transfer_in' ? '📩' : '📤'} {entry.type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-3 font-medium">{entry.category}</td>
                                        <td className="p-3 text-gray-500 max-w-[200px] truncate">{entry.description || '-'}</td>
                                        <td className={`p-3 text-right font-semibold whitespace-nowrap ${entry.type === 'income' || entry.type === 'transfer_in' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {entry.type === 'income' || entry.type === 'transfer_in' ? '+' : '-'}₦{entry.amount.toFixed(2)}
                                        </td>
                                        <td className="p-3">
                                            <span
                                                className="px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1"
                                                style={{
                                                    backgroundColor: `${getPurseColor(entry.purse)}20`,
                                                    color: getPurseColor(entry.purse),
                                                }}
                                            >
                                                {getPurseIcon(entry.purse)} {entry.purse}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs">
                                            {entry.priority && ['Need', 'Want', 'Offerings', 'Savings'].includes(entry.priority) ? (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.priority === 'Need' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        entry.priority === 'Want' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            entry.priority === 'Offerings' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                    }`}>
                                                    {entry.priority === 'Need' ? '💪' : entry.priority === 'Want' ? '🌟' : entry.priority === 'Offerings' ? '🙏' : '🏦'} {entry.priority}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-3 text-xs text-gray-500 max-w-[150px] truncate">{entry.comments || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            ← Previous
                        </button>
                        <span className="text-sm text-gray-500">
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}