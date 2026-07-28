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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50 p-3.5 hover:border-gray-200 dark:hover:border-gray-600 transition-all">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate pr-2">{category}</h3>
        {onEdit && (
          <button onClick={onEdit} className="text-[10px] text-blue-500 hover:underline shrink-0">
            Edit
          </button>
        )}
      </div>

      <div className="flex justify-between items-end mb-1.5">
        <div className="text-xs text-gray-500">
          <span className={`font-bold ${isOverBudget ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
            ${spent.toFixed(2)}
          </span>
          <span className="text-gray-400"> / ${budgeted.toFixed(2)}</span>
        </div>
        <div className={`text-[11px] font-semibold ${isOverBudget ? 'text-red-500' : 'text-gray-500'}`}>
          {isOverBudget ? `-$${Math.abs(budgeted - spent).toFixed(2)}` : `$${Math.max(budgeted - spent, 0).toFixed(2)}`}
        </div>
      </div>

      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${isOverBudget
              ? 'bg-red-500'
              : percentage > 85
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            }`}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
    </div>
  )
}