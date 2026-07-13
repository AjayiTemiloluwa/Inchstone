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
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200">{category}</h3>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-blue-500 hover:underline">
            Edit Budget
          </button>
        )}
      </div>

      <div className="flex justify-between items-end mb-1">
        <div className="text-xs text-gray-500">
          <span className={`font-semibold ${isOverBudget ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
            ${spent.toFixed(2)}
          </span>{' '}
          spent of ${budgeted.toFixed(2)}
        </div>
        <div className="text-xs font-medium text-gray-500">
          ${Math.max(budgeted - spent, 0).toFixed(2)} left
        </div>
      </div>

      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full ${
            isOverBudget
              ? 'bg-red-500'
              : percentage > 85
              ? 'bg-yellow-500'
              : 'bg-blue-500'
          }`}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        ></div>
      </div>
    </div>
  )
}
