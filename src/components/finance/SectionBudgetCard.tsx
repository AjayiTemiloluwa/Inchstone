'use client'

import React, { useState } from 'react'
import { BudgetProgress } from './BudgetProgress'
import { SECTION_CATEGORIES, BudgetCategoryOption, getSectionIcon } from './budgetCategories'

interface SectionBudgetCardProps {
    section: 'Need' | 'Want' | 'Offerings' | 'Savings'
    totalAllocated: number
    totalSpent: number
    budgets: any[]
    categorySpending: Record<string, number>
    entries: any[]
    currentMonth: string
    onAllocate: (amount: number) => void
    onAddBudget: (category: string, amount: number) => void
    onDeleteBudget: (id: string) => void
    onDeleteEntry: (id: string) => void
}

const sectionConfig = {
    Need: {
        icon: '💪',
        color: 'blue',
        lightBg: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/10',
        borderColor: 'border-blue-200 dark:border-blue-800',
        accentBg: 'bg-blue-500',
        accentLight: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-300',
        badgeText: 'text-blue-600 dark:text-blue-300',
        progressBar: 'bg-blue-500',
        description: 'Essential expenses'
    },
    Want: {
        icon: '🌟',
        color: 'amber',
        lightBg: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10',
        borderColor: 'border-amber-200 dark:border-amber-800',
        accentBg: 'bg-amber-500',
        accentLight: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-700 dark:text-amber-300',
        badgeText: 'text-amber-600 dark:text-amber-300',
        progressBar: 'bg-amber-500',
        description: 'Lifestyle choices'
    },
    Offerings: {
        icon: '🙏',
        color: 'emerald',
        lightBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        accentBg: 'bg-emerald-500',
        accentLight: 'bg-emerald-100 dark:bg-emerald-900/30',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        badgeText: 'text-emerald-600 dark:text-emerald-300',
        progressBar: 'bg-emerald-500',
        description: 'Tithes & giving'
    },
    Savings: {
        icon: '🏦',
        color: 'purple',
        lightBg: 'bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/10',
        borderColor: 'border-purple-200 dark:border-purple-800',
        accentBg: 'bg-purple-500',
        accentLight: 'bg-purple-100 dark:bg-purple-900/30',
        textColor: 'text-purple-700 dark:text-purple-300',
        badgeText: 'text-purple-600 dark:text-purple-300',
        progressBar: 'bg-purple-500',
        description: 'Savings & reserves'
    }
}

const defaultBudgetAmounts: Record<string, number> = {
    'Food / Groceries': 400,
    'Transport / Gas': 150,
    'Rent / Mortgage': 1200,
    'Utilities (Electric, Water, Internet)': 200,
    'Healthcare / Insurance': 150,
    'Clothing / Apparel': 80,
    'Debt Payments': 300,
    'Education / Tuition': 100,
    'Entertainment (Movies, Games)': 50,
    'Dining Out / Restaurants': 100,
    'Travel / Vacation': 200,
    'Shopping / Hobbies': 80,
    'Subscriptions (Spotify, Netflix)': 30,
    'Gym / Fitness': 40,
    'Gadgets / Electronics': 100,
    'Gifts / Celebrations': 60,
    'Tithe (10%)': 0,
    'Church Offerings': 100,
    'Charity / Giving': 50,
    'Missions / Outreach': 50,
    'Support Family': 200,
    'Ministry / Fellowship': 30,
    'Emergency Fund': 500,
    'Retirement / 401k': 500,
    'Investment Portfolio': 300,
    'Education Fund': 200,
    'Travel Fund': 200,
    'Home Down Payment': 500,
    'Vehicle Fund': 300,
    'Rainy Day Fund': 200,
}

function cn(classes: string) { return classes }

export function SectionBudgetCard({
    section,
    totalAllocated,
    totalSpent,
    budgets,
    categorySpending,
    entries,
    currentMonth,
    onAllocate,
    onAddBudget,
    onDeleteBudget,
    onDeleteEntry
}: SectionBudgetCardProps) {
    const config = sectionConfig[section]
    const [showAllocate, setShowAllocate] = useState(false)
    const [allocateAmount, setAllocateAmount] = useState('')
    const [showAddCategory, setShowAddCategory] = useState(false)
    const [newCategory, setNewCategory] = useState('')
    const [newBudgetAmount, setNewBudgetAmount] = useState('')
    const [showExpenses, setShowExpenses] = useState(false)

    const remaining = totalAllocated - totalSpent
    const percentage = totalAllocated > 0 ? Math.min((totalSpent / totalAllocated) * 100, 100) : 0
    const sectionEntries = entries.filter((e: any) => e.priority === section || e.section === section)

    const budgetedCategoryLabels = new Set(budgets.map(b => b.category))

    const suggestedUnused: BudgetCategoryOption[] = (SECTION_CATEGORIES[section] || []).filter(
        cat => !budgetedCategoryLabels.has(cat.label)
    )

    const handleAllocate = (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(allocateAmount)
        if (!isNaN(val) && val > 0) {
            onAllocate(val)
            setAllocateAmount('')
            setShowAllocate(false)
        }
    }

    const handleAddBudget = (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(newBudgetAmount)
        if (newCategory.trim() && !isNaN(val) && val > 0) {
            onAddBudget(newCategory.trim(), val)
            setNewCategory('')
            setNewBudgetAmount('')
            setShowAddCategory(false)
        }
    }

    const handleQuickAdd = (cat: BudgetCategoryOption) => {
        const suggestedAmount = defaultBudgetAmounts[cat.label] || 100
        onAddBudget(cat.label, suggestedAmount)
    }

    const sectionColors = {
        Need: 'from-blue-500 to-blue-600',
        Want: 'from-amber-500 to-amber-600',
        Offerings: 'from-emerald-500 to-emerald-600',
        Savings: 'from-purple-500 to-purple-600',
    }

    return (
        <div className={`
            rounded-2xl border ${config.borderColor} ${config.lightBg}
            overflow-hidden shadow-sm hover:shadow-md transition-all duration-300
            flex flex-col h-full
        `}>
            {/* Top gradient accent line */}
            <div className={`h-1.5 bg-gradient-to-r ${sectionColors[section as keyof typeof sectionColors]}`} />

            {/* Section Header */}
            <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{getSectionIcon(section)}</span>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{section}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{config.description}</p>
                            </div>
                        </div>
                    </div>
                    <span className={`
                        inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold
                        ${config.accentLight} ${config.badgeText}
                    `}>
                        {budgets.length} cat{budgets.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Budget Progress Bar */}
                <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Allocated</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">${totalAllocated.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Spent</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">${totalSpent.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden mt-1">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${remaining < 0 ? 'bg-red-500' : percentage > 85 ? 'bg-yellow-500' : config.progressBar}`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className={remaining < 0 ? 'text-red-500 font-medium' : 'text-gray-500'}>
                            {remaining >= 0
                                ? `$${remaining.toFixed(2)} left`
                                : `$${Math.abs(remaining).toFixed(2)} over`
                            }
                        </span>
                        <span className="text-gray-500">{percentage.toFixed(1)}%</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={() => { setShowAllocate(!showAllocate); setShowAddCategory(false) }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl text-white 
                            bg-gradient-to-r ${sectionColors[section as keyof typeof sectionColors]}
                            hover:opacity-90 active:scale-[0.97] transition-all shadow-sm`}
                    >
                        {showAllocate ? '✕ Cancel' : '+ Allocate'}
                    </button>
                    <button
                        onClick={() => { setShowAddCategory(!showAddCategory); setShowAllocate(false) }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl 
                            border-2 ${config.borderColor} ${config.badgeText}
                            hover:bg-white/50 dark:hover:bg-gray-800/50 active:scale-[0.97] transition-all`}
                    >
                        {showAddCategory ? '✕ Cancel' : '+ Category'}
                    </button>
                    <button
                        onClick={() => { setShowExpenses(!showExpenses); setShowAllocate(false); setShowAddCategory(false) }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl 
                            ${showExpenses
                                ? `bg-gradient-to-r ${sectionColors[section as keyof typeof sectionColors]} text-white`
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }
                            hover:opacity-90 active:scale-[0.97] transition-all`}
                    >
                        {sectionEntries.length} Expenses
                    </button>
                </div>

                {/* Allocate Form */}
                {showAllocate && (
                    <form onSubmit={handleAllocate} className="mt-3 bg-white/60 dark:bg-gray-900/40 rounded-xl p-3">
                        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Allocate to {section}
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={allocateAmount}
                                    onChange={(e) => setAllocateAmount(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                                        rounded-xl py-2.5 pl-8 pr-3 text-sm font-medium
                                        focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
                                        transition-all"
                                    placeholder="Amount"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className={`px-5 py-2.5 text-sm font-semibold rounded-xl text-white 
                                    bg-gradient-to-r ${sectionColors[section as keyof typeof sectionColors]}
                                    hover:opacity-90 active:scale-[0.97] transition-all shadow-sm`}
                            >
                                Set
                            </button>
                        </div>
                    </form>
                )}

                {/* Add Category Form */}
                {showAddCategory && (
                    <div className="mt-3 bg-white/60 dark:bg-gray-900/40 rounded-xl p-3 space-y-3">
                        <form onSubmit={handleAddBudget} className="space-y-2">
                            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                Add Budget Category
                            </label>
                            <input
                                type="text"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                required
                                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                                    rounded-xl py-2.5 px-3 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
                                    transition-all"
                                placeholder="e.g., Food, Transport"
                            />
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newBudgetAmount}
                                        onChange={(e) => setNewBudgetAmount(e.target.value)}
                                        required
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                                            rounded-xl py-2.5 pl-8 pr-3 text-sm font-medium
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
                                            transition-all"
                                        placeholder="Budget"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className={`px-5 py-2.5 text-sm font-semibold rounded-xl text-white 
                                        bg-gradient-to-r ${sectionColors[section as keyof typeof sectionColors]}
                                        hover:opacity-90 active:scale-[0.97] transition-all shadow-sm`}
                                >
                                    Add
                                </button>
                            </div>
                        </form>

                        {suggestedUnused.length > 0 && (
                            <div>
                                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                                    💡 Quick add
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {suggestedUnused.slice(0, 6).map(cat => {
                                        const suggestedAmount = defaultBudgetAmounts[cat.label] || 100
                                        return (
                                            <button
                                                key={cat.label}
                                                type="button"
                                                onClick={() => handleQuickAdd(cat)}
                                                className="text-[11px] px-2.5 py-1.5 rounded-lg 
                                                    bg-white dark:bg-gray-800 
                                                    border border-gray-200 dark:border-gray-700
                                                    text-gray-600 dark:text-gray-400 
                                                    hover:bg-gray-50 dark:hover:bg-gray-700 
                                                    active:scale-95 transition-all
                                                    flex items-center gap-1"
                                            >
                                                <span>{cat.icon}</span>
                                                <span>${suggestedAmount}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Category Budgets */}
            <div className="px-5 pb-5 flex-1">
                <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                        Budget Categories
                    </h4>
                    {budgets.length === 0 ? (
                        <div className="text-center py-6">
                            <div className="text-3xl mb-2 opacity-50">{getSectionIcon(section)}</div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                No budgets set yet
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                                Tap "+ Category" to add one
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {budgets.map(budget => (
                                <div key={budget.id} className="relative group">
                                    <BudgetProgress
                                        category={budget.category}
                                        budgeted={budget.amount}
                                        spent={categorySpending[budget.category] || 0}
                                    />
                                    <button
                                        onClick={() => onDeleteBudget(budget.id)}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 
                                            bg-red-500 text-white rounded-full text-xs 
                                            flex items-center justify-center 
                                            opacity-0 group-hover:opacity-100 
                                            hover:bg-red-600 transition-all shadow-sm"
                                        title="Delete budget"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Section Expenses */}
            {showExpenses && sectionEntries.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-white/60 dark:bg-gray-900/40">
                                    <th className="text-left p-3 font-semibold text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">Date</th>
                                    <th className="text-left p-3 font-semibold text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">Category</th>
                                    <th className="text-right p-3 font-semibold text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">Amount</th>
                                    <th className="p-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white/40 dark:bg-gray-900/20">
                                {sectionEntries.slice(0, 10).map((entry: any) => (
                                    <tr key={entry.id} className="hover:bg-white/60 dark:hover:bg-gray-800/30 transition-colors">
                                        <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                                            {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="p-3">
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{entry.category}</span>
                                            {entry.description && (
                                                <span className="text-[10px] text-gray-400 ml-1.5">· {entry.description}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right text-xs font-semibold text-red-600 whitespace-nowrap">
                                            -${entry.amount.toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => onDeleteEntry(entry.id)}
                                                className="text-gray-300 hover:text-red-500 text-sm transition-colors"
                                            >
                                                ×
                                            </button>
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