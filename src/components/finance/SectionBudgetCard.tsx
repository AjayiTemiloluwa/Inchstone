'use client'

import React, { useState } from 'react'
import { BudgetProgress } from './BudgetProgress'
import { SECTION_CATEGORIES, BudgetCategoryOption, getSectionIcon } from './budgetCategories'

interface Purse {
    id: string
    name: string
    icon: string
    color: string
}

interface SectionBudgetCardProps {
    section: 'Need' | 'Want' | 'Offerings' | 'Savings'
    totalAllocated: number
    totalSpent: number
    budgets: any[]
    categorySpending: Record<string, number>
    entries: any[]
    currentMonth: string
    purses?: Purse[]
    onAllocate: (amount: number) => void
    onAddBudget: (category: string, amount: number) => void
    onDeleteBudget: (id: string) => void
    onDeleteEntry: (id: string) => void
    onAddTransaction?: (entry: { type: string; amount: number; category: string; description: string; purse: string; priority: string }) => Promise<boolean>
}

const sectionConfig = {
    Need: {
        icon: '💪',
        gradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
        borderGlow: 'shadow-blue-500/10',
        accent: 'bg-blue-500',
        accentGradient: 'from-blue-500 to-blue-600',
        lightAccent: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200/60 dark:border-blue-800/40',
        progressBar: 'bg-gradient-to-r from-blue-400 to-blue-600',
        description: 'Essential expenses for living'
    },
    Want: {
        icon: '🌟',
        gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
        borderGlow: 'shadow-amber-500/10',
        accent: 'bg-amber-500',
        accentGradient: 'from-amber-500 to-amber-600',
        lightAccent: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200/60 dark:border-amber-800/40',
        progressBar: 'bg-gradient-to-r from-amber-400 to-amber-600',
        description: 'Non-essential lifestyle choices'
    },
    Offerings: {
        icon: '🙏',
        gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
        borderGlow: 'shadow-emerald-500/10',
        accent: 'bg-emerald-500',
        accentGradient: 'from-emerald-500 to-emerald-600',
        lightAccent: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200/60 dark:border-emerald-800/40',
        progressBar: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
        description: 'Tithes, gifts, and charitable giving'
    },
    Savings: {
        icon: '🏦',
        gradient: 'from-purple-500/20 via-purple-500/5 to-transparent',
        borderGlow: 'shadow-purple-500/10',
        accent: 'bg-purple-500',
        accentGradient: 'from-purple-500 to-purple-600',
        lightAccent: 'bg-purple-50 dark:bg-purple-500/10',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-200/60 dark:border-purple-800/40',
        progressBar: 'bg-gradient-to-r from-purple-400 to-purple-600',
        description: 'Savings goals and financial reserves'
    }
}

const defaultBudgetAmounts: Record<string, number> = {
    'Food / Groceries': 400, 'Transport / Gas': 150, 'Rent / Mortgage': 1200,
    'Utilities (Electric, Water, Internet)': 200, 'Healthcare / Insurance': 150,
    'Clothing / Apparel': 80, 'Debt Payments': 300, 'Education / Tuition': 100,
    'Entertainment (Movies, Games)': 50, 'Dining Out / Restaurants': 100,
    'Travel / Vacation': 200, 'Shopping / Hobbies': 80,
    'Subscriptions (Spotify, Netflix)': 30, 'Gym / Fitness': 40,
    'Gadgets / Electronics': 100, 'Gifts / Celebrations': 60,
    'Tithe (10%)': 0, 'Church Offerings': 100, 'Charity / Giving': 50,
    'Missions / Outreach': 50, 'Support Family': 200, 'Ministry / Fellowship': 30,
    'Emergency Fund': 500, 'Retirement / 401k': 500, 'Investment Portfolio': 300,
    'Education Fund': 200, 'Travel Fund': 200, 'Home Down Payment': 500,
    'Vehicle Fund': 300, 'Rainy Day Fund': 200,
}

export function SectionBudgetCard({
    section,
    totalAllocated,
    totalSpent,
    budgets,
    categorySpending,
    entries,
    currentMonth,
    purses: externalPurses,
    onAllocate,
    onAddBudget,
    onDeleteBudget,
    onDeleteEntry,
    onAddTransaction
}: SectionBudgetCardProps) {
    const config = sectionConfig[section]
    const [showAllocate, setShowAllocate] = useState(false)
    const [allocateAmount, setAllocateAmount] = useState('')
    const [showAddCategory, setShowAddCategory] = useState(false)
    const [newCategory, setNewCategory] = useState('')
    const [newBudgetAmount, setNewBudgetAmount] = useState('')
    const [showExpenses, setShowExpenses] = useState(false)
    const [quickAddCategory, setQuickAddCategory] = useState<string | null>(null)
    const [quickAddAmount, setQuickAddAmount] = useState('')
    const [quickAddDesc, setQuickAddDesc] = useState('')
    const [quickAddPurse, setQuickAddPurse] = useState('')
    const [quickAddLoading, setQuickAddLoading] = useState(false)
    const [purses, setPurses] = useState<Purse[]>(externalPurses || [])

    const remaining = totalAllocated - totalSpent
    const percentage = totalAllocated > 0 ? Math.min((totalSpent / totalAllocated) * 100, 100) : 0
    const sectionEntries = entries.filter((e: any) => e.priority === section || e.section === section)
    const budgetedCategoryLabels = new Set(budgets.map(b => b.category))
    const suggestedUnused: BudgetCategoryOption[] = (SECTION_CATEGORIES[section] || []).filter(
        cat => !budgetedCategoryLabels.has(cat.label)
    )

    // Load purses if not provided
    React.useEffect(() => {
        if (!externalPurses || externalPurses.length === 0) {
            fetch('/api/purses')
                .then(r => r.json())
                .then(data => {
                    if (data.purses?.length > 0) {
                        setPurses(data.purses)
                        if (!quickAddPurse) setQuickAddPurse(data.purses[0].name)
                    }
                })
                .catch(() => { })
        } else {
            setPurses(externalPurses)
            if (!quickAddPurse && externalPurses.length > 0) setQuickAddPurse(externalPurses[0].name)
        }
    }, [externalPurses])

    const handleAllocate = (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(allocateAmount)
        if (!isNaN(val) && val > 0) { onAllocate(val); setAllocateAmount(''); setShowAllocate(false) }
    }
    const handleAddBudget = (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(newBudgetAmount)
        if (newCategory.trim() && !isNaN(val) && val > 0) { onAddBudget(newCategory.trim(), val); setNewCategory(''); setNewBudgetAmount(''); setShowAddCategory(false) }
    }
    const handleQuickAdd = (cat: BudgetCategoryOption) => {
        onAddBudget(cat.label, defaultBudgetAmounts[cat.label] || 100)
    }

    const handleQuickTransaction = async (e: React.FormEvent, category: string) => {
        e.preventDefault()
        if (!quickAddAmount || !onAddTransaction) return

        setQuickAddLoading(true)
        try {
            await onAddTransaction({
                type: 'expense',
                amount: parseFloat(quickAddAmount),
                category,
                description: quickAddDesc,
                purse: quickAddPurse || (purses.length > 0 ? purses[0].name : 'Main'),
                priority: section,
            })
            setQuickAddAmount('')
            setQuickAddDesc('')
            setQuickAddCategory(null)
        } catch (err) {
            console.error('Quick transaction failed:', err)
        } finally {
            setQuickAddLoading(false)
        }
    }

    const getPurseIcon = (name: string) => {
        const p = purses.find(p => p.name === name)
        return p?.icon || '👜'
    }

    return (
        <div className={`
            relative rounded-2xl border ${config.border} bg-white dark:bg-gray-900/60
            shadow-sm ${config.borderGlow}
            overflow-hidden transition-all duration-300 hover:shadow-lg
            flex flex-col h-full
        `}>
            {/* Top decorative gradient bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.accentGradient}`} />

            {/* Section Header */}
            <div className="p-5 pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${config.lightAccent} flex items-center justify-center text-lg shadow-sm`}>
                            {getSectionIcon(section)}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{section}</h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{config.description}</p>
                        </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg ${config.lightAccent} ${config.text} text-[11px] font-semibold tabular-nums`}>
                        {budgets.length} cat{budgets.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Budget Overview Card */}
            <div className="mx-5 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-100 dark:border-gray-700/30">
                <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                        <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Allocated</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">₦{totalAllocated.toFixed(0)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Spent</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">₦{totalSpent.toFixed(0)}</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[11px] font-semibold tabular-nums ${remaining < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {remaining >= 0 ? `₦${remaining.toFixed(0)} left` : `₦${Math.abs(remaining).toFixed(0)} over`}
                        </span>
                        <span className="text-[11px] font-medium text-gray-400 tabular-nums">{percentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200/70 dark:bg-gray-700/50 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${remaining < 0 ? 'bg-gradient-to-r from-red-400 to-red-500' : percentage > 85 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : config.progressBar}`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="px-5 py-3 flex gap-2">
                <button
                    onClick={() => { setShowAllocate(!showAllocate); setShowAddCategory(false); setShowExpenses(false); setQuickAddCategory(null) }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 active:scale-[0.97]
                        ${showAllocate
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            : `bg-gradient-to-r ${config.accentGradient} text-white shadow-sm hover:shadow-md`
                        }`}
                >
                    {showAllocate ? 'Cancel' : '+ Allocate'}
                </button>
                <button
                    onClick={() => { setShowAddCategory(!showAddCategory); setShowAllocate(false); setShowExpenses(false); setQuickAddCategory(null) }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 active:scale-[0.97]
                        ${showAddCategory
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            : `border-2 ${config.border} ${config.text} hover:bg-gray-50 dark:hover:bg-gray-800/50`
                        }`}
                >
                    {showAddCategory ? 'Cancel' : '+ Category'}
                </button>
                <button
                    onClick={() => { setShowExpenses(!showExpenses); setShowAllocate(false); setShowAddCategory(false); setQuickAddCategory(null) }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 active:scale-[0.97]
                        ${showExpenses
                            ? `bg-gradient-to-r ${config.accentGradient} text-white shadow-sm`
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                >
                    {sectionEntries.length} Expenses
                </button>
            </div>

            {/* Allocate Form */}
            {showAllocate && (
                <div className="mx-5 mb-3 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-100 dark:border-gray-700/30 animate-fadeIn">
                    <form onSubmit={handleAllocate} className="flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₦</span>
                            <input
                                type="number" step="0.01" value={allocateAmount}
                                onChange={(e) => setAllocateAmount(e.target.value)} required autoFocus
                                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-8 pr-3 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                placeholder="Amount"
                            />
                        </div>
                        <button type="submit"
                            className={`px-5 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r ${config.accentGradient} hover:shadow-md active:scale-[0.97] transition-all`}>
                            Set
                        </button>
                    </form>
                </div>
            )}

            {/* Add Category Form */}
            {showAddCategory && (
                <div className="mx-5 mb-3 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-100 dark:border-gray-700/30 animate-fadeIn space-y-3">
                    <form onSubmit={handleAddBudget} className="space-y-2">
                        <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required
                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                            placeholder="Category name" />
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₦</span>
                                <input type="number" step="0.01" value={newBudgetAmount} onChange={(e) => setNewBudgetAmount(e.target.value)} required
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-8 pr-3 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                    placeholder="Budget" />
                            </div>
                            <button type="submit"
                                className={`px-5 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r ${config.accentGradient} hover:shadow-md active:scale-[0.97] transition-all`}>
                                Add
                            </button>
                        </div>
                    </form>
                    {suggestedUnused.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Quick add</p>
                            <div className="flex flex-wrap gap-1.5">
                                {suggestedUnused.slice(0, 6).map(cat => (
                                    <button key={cat.label} type="button" onClick={() => handleQuickAdd(cat)}
                                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all flex items-center gap-1 shadow-sm">
                                        <span>{cat.icon}</span>
                                        <span className="font-semibold tabular-nums">₦{defaultBudgetAmounts[cat.label] || 100}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Category Budgets with Quick Add Transaction */}
            <div className="px-5 pb-5 flex-1">
                <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-100 dark:border-gray-700/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Budget Categories</h4>
                    </div>
                    {budgets.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-3 opacity-30">{getSectionIcon(section)}</div>
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No budgets yet</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">Tap "+ Category" to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {budgets.map(budget => (
                                <div key={budget.id}>
                                    <div className="relative group">
                                        <BudgetProgress category={budget.category} budgeted={budget.amount} spent={categorySpending[budget.category] || 0} />
                                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setQuickAddCategory(quickAddCategory === budget.category ? null : budget.category)
                                                    setQuickAddAmount('')
                                                    setQuickAddDesc('')
                                                }}
                                                className="w-5 h-5 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-blue-600 transition-all shadow-md"
                                                title="Quick add expense"
                                            >
                                                +
                                            </button>
                                            <button onClick={() => onDeleteBudget(budget.id)}
                                                className="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-all shadow-md">
                                                ×
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Add Transaction Form */}
                                    {quickAddCategory === budget.category && onAddTransaction && (
                                        <form
                                            onSubmit={(e) => handleQuickTransaction(e, budget.category)}
                                            className="mt-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 animate-fadeIn"
                                        >
                                            <div className="flex gap-1.5 mb-1.5">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">₦</span>
                                                    <input
                                                        type="number" step="0.01" value={quickAddAmount}
                                                        onChange={(e) => setQuickAddAmount(e.target.value)}
                                                        required autoFocus
                                                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 pl-4 pr-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="Amount"
                                                    />
                                                </div>
                                                <select
                                                    value={quickAddPurse}
                                                    onChange={(e) => setQuickAddPurse(e.target.value)}
                                                    className="text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                >
                                                    {purses.map(p => (
                                                        <option key={p.id} value={p.name}>{p.icon} {p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="text" value={quickAddDesc}
                                                    onChange={(e) => setQuickAddDesc(e.target.value)}
                                                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    placeholder="Description (optional)"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={quickAddLoading || !quickAddAmount}
                                                    className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg text-white bg-gradient-to-r ${config.accentGradient} hover:shadow-md disabled:opacity-50 transition-all`}
                                                >
                                                    {quickAddLoading ? '...' : 'Add'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Section Expenses */}
            {showExpenses && sectionEntries.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700/30">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                                    <th className="text-left p-3 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-widest">Date</th>
                                    <th className="text-left p-3 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-widest">Category</th>
                                    <th className="text-right p-3 font-semibold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-widest">Amount</th>
                                    <th className="p-3 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                {sectionEntries.slice(0, 8).map((entry: any) => (
                                    <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                                        <td className="p-3 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                                            {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="p-3">
                                            <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{entry.category}</span>
                                            {entry.description && <span className="text-[10px] text-gray-400 ml-1.5">· {entry.description}</span>}
                                        </td>
                                        <td className="p-3 text-right text-[12px] font-bold text-red-500 tabular-nums">-₦{entry.amount.toFixed(0)}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => onDeleteEntry(entry.id)} className="text-gray-300 hover:text-red-500 text-sm transition-colors">×</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}