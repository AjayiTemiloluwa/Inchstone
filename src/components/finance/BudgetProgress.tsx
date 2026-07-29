'use client'

import React from 'react'

interface BudgetProgressProps {
  category: string
  budgeted: number
  spent: number
  onEdit?: () => void
}

export function BudgetProgress({ category, budgeted, spent, onEdit }: BudgetProgressProps) {
  const percentage = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0
  const isOverBudget = spent > budgeted
  const remaining = Math.max(budgeted - spent, 0)

  return (
    <div className="group relative bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/30 p-3 transition-all duration-200 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm" />
            <h3 className="font-semibold text-[13px] text-gray-800 dark:text-gray-200 truncate leading-tight">
              {category}
            </h3>
          </div>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-[10px] font-medium text-gray-400 hover:text-blue-500 transition-colors ml-2 opacity-0 group-hover:opacity-100"
          >
            Edit
          </button>
        )}
      </div>

      <div className="flex items-end justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-base font-bold tabular-nums tracking-tight ${isOverBudget ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
            ₦{spent.toFixed(0)}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
            / ₦{budgeted.toFixed(0)}
          </span>
        </div>
        <div className={`text-[11px] font-semibold tabular-nums ${isOverBudget ? 'text-red-400' : 'text-emerald-500'}`}>
          {isOverBudget ? `₦${Math.abs(budgeted - spent).toFixed(0)} over` : `₦${remaining.toFixed(0)} left`}
        </div>
      </div>

      <div className="relative">
        <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${isOverBudget
              ? 'bg-gradient-to-r from-red-400 to-red-500'
              : percentage > 85
                ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                : 'bg-gradient-to-r from-blue-400 to-blue-500'
              }`}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
        <div className="absolute -top-1 right-0 text-[10px] font-medium text-gray-400 tabular-nums">
          {percentage.toFixed(0)}%
        </div>
      </div>
    </div>
  )
}