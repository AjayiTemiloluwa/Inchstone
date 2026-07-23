'use client'

import React, { useState } from 'react'
import { BudgetProgress } from './BudgetProgress'

interface SectionBudgetCardProps {
    section: 'Need' | 'Want' | 'Offerings'
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
        bgColor: 'bg-blue-50 dark:bg-blue-900/10',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-700 dark:text-blue-300',
        accentColor: 'bg-blue-600',
        accentHover: 'hover:bg-blue-700',
        description: 'Essential expenses for living'
    },
    Want: {
        icon: '🌟',
        color: 'amber',
        bgColor: 'bg-amber-50 dark:bg-amber-900/10',
        borderColor: 'border-amber-200 dark:border-amber-800',
        textColor: 'text-amber-700 dark:text-amber-300',
        accentColor: 'bg-amber-600',
        accentHover: 'hover:bg-amber-700',
        description: 'Non-essential lifestyle choices'
    },
    Offerings: {
        icon: '🙏',
        color: 'emerald',
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/10',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        accentColor: 'bg-emerald-600',
        accentHover: 'hover:bg-emerald-700',
        description: 'Tithes, gifts, and charitable giving'
    }
}

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
    const sectionEntries = entries.filter(e => e.priority === section || e.section === section)

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

    return (
        <div className={`rounded-2xl border ${config.borderColor} ${config.bgColor} overflow-hidden shadow-sm`}>
            {/* Section Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <span>{config.icon}</span>
                            <span className={config.textColor}>{section}</span>
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{config.description}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${config.borderColor} ${config.textColor}`}>
                        {budgets.length} categories
                    </span>
                </div>

                {/* Section Budget Progress Bar */}
                <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between items-end text-sm">
                        <span className="text-gray-600 dark:text-gray-300">
                            Allocated: <span className="font-semibold">${totalAllocated.toFixed(2)}</span>
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                            Spent: <span className="font-semibold">${totalSpent.toFixed(2)}</span>
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-2.5 rounded-full transition-all ${remaining < 0 ? 'bg-red-500' : percentage > 85 ? 'bg-yellow-500' : config.accentColor
                                }`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">
                            {remaining >= 0
                                ? `$${remaining.toFixed(2)} remaining`
                                : `$${Math.abs(remaining).toFixed(2)} over budget`
                            }
                        </span>
                        <span className="text-gray-500">{percentage.toFixed(1)}% used</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={() => setShowAllocate(!showAllocate)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg text-white ${config.accentColor} ${config.accentHover} transition-colors`}
                    >
                        {showAllocate ? 'Cancel' : `+ Allocate to ${section}`}
                    </button>
                    <button
                        onClick={() => setShowAddCategory(!showAddCategory)}
                        className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        {showAddCategory ? 'Cancel' : '+ Add Category'}
                    </button>
                    <button
                        onClick={() => setShowExpenses(!showExpenses)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border ${showExpenses
                                ? `${config.borderColor} ${config.textColor}`
                                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                            } hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                    >
                        {showExpenses ? 'Hide' : `${sectionEntries.length} Expenses`}
                    </button>
                </div>

                {/* Allocate Form */}
                {showAllocate && (
                    <form onSubmit={handleAllocate} className="mt-3 flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-2.5 top-2 text-gray-400 text-xs">$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={allocateAmount}
                                onChange={(e) => setAllocateAmount(e.target.value)}
                                required
                                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 pl-6 pr-2.5 text-sm"
                                placeholder="Amount to allocate"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg text-white ${config.accentColor} ${config.accentHover} transition-colors`}
                        >
                            Set
                        </button>
                    </form>
                )}

                {/* Add Category Form */}
                {showAddCategory && (
                    <form onSubmit={handleAddBudget} className="mt-3 space-y-2">
                        <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            required
                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-sm"
                            placeholder="e.g., Food, Transport, Clothing"
                        />
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newBudgetAmount}
                                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 pl-6 pr-2.5 text-sm"
                                    placeholder="Budget amount"
                                />
                            </div>
                            <button
                                type="submit"
                                className={`px-4 py-1.5 text-xs font-medium rounded-lg text-white ${config.accentColor} ${config.accentHover} transition-colors`}
                            >
                                Add
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Categories Progress */}
            <div className="p-5 space-y-3 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category Budgets</h4>
                {budgets.length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-2">
                        No category budgets set yet. Add one above!
                    </div>
                ) : (
                    budgets.map(budget => (
                        <div key={budget.id} className="relative group">
                            <BudgetProgress
                                category={budget.category}
                                budgeted={budget.amount}
                                spent={categorySpending[budget.category] || 0}
                            />
                            <button
                                onClick={() => onDeleteBudget(budget.id)}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                title="Delete budget"
                            >
                                ×
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Section Expenses Table */}
            {showExpenses && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                <th className="text-left p-2.5 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Date</th>
                                <th className="text-left p-2.5 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Category</th>
                                <th className="text-left p-2.5 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Description</th>
                                <th className="text-right p-2.5 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Amount</th>
                                <th className="text-left p-2.5 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Purse</th>
                                <th className="p-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {sectionEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center text-xs text-gray-400">
                                        No expenses in this section yet
                                    </td>
                                </tr>
                            ) : (
                                sectionEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="p-2.5 whitespace-nowrap text-xs text-gray-500">
                                            {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="p-2.5">
                                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{entry.category}</span>
                                        </td>
                                        <td className="p-2.5 text-xs text-gray-500 max-w-[150px] truncate">
                                            {entry.description || '-'}
                                        </td>
                                        <td className="p-2.5 text-right text-xs font-medium text-red-600 whitespace-nowrap">
                                            ${entry.amount.toFixed(2)}
                                        </td>
                                        <td className="p-2.5 text-xs">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.purse === 'savings'
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {entry.purse === 'savings' ? '🏦' : '👜'}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-right">
                                            <button
                                                onClick={() => onDeleteEntry(entry.id)}
                                                className="text-gray-400 hover:text-red-500 text-base leading-none"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}