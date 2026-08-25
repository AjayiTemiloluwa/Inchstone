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
    <div className="group relative rounded-xl border border-white/10 bg-black/20 p-3 transition-all duration-200 hover:border-gold/30">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isOverBudget ? 'bg-[#cf8f78]' : 'bg-gold'}`} />
          <h3 className="font-semibold text-[13px] text-parchment truncate leading-tight">{category}</h3>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="text-[10px] font-bold text-parchment/30 hover:text-gold transition-colors ml-2 opacity-0 group-hover:opacity-100">
            Edit
          </button>
        )}
      </div>

      <div className="flex items-end justify-between mb-2 gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={`text-base font-bold tabular-nums tracking-tight ${isOverBudget ? 'text-[#cf8f78]' : 'text-parchment'}`}>
            ₦{spent.toFixed(0)}
          </span>
          <span className="text-[11px] text-parchment/40 font-medium">/ ₦{budgeted.toFixed(0)}</span>
        </div>
        <div className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${isOverBudget ? 'text-[#cf8f78]' : 'text-[#7fa871]'}`}>
          {isOverBudget ? `₦${Math.abs(budgeted - spent).toFixed(0)} over` : `₦${remaining.toFixed(0)} left`}
        </div>
      </div>

      <div className="relative">
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${isOverBudget
              ? 'bg-gradient-to-r from-[#cf8f78] to-[#7a3b2e]'
              : percentage > 85
                ? 'bg-gradient-to-r from-[#d4af37] to-[#b8935a]'
                : 'bg-gradient-to-r from-[#b8935a] to-[#8a6d42]'
              }`}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
        <div className="absolute -top-1 right-0 text-[10px] font-medium text-parchment/40 tabular-nums">
          {percentage.toFixed(0)}%
        </div>
      </div>
    </div>
  )
}
