'use client'

import React from 'react'
import { Button, cx } from '@/components/ds'
import { ProgressBar } from './ui'

interface BudgetProgressProps {
  category: string
  budgeted: number
  spent: number
  onEdit?: () => void
}

/** One budget line as a progress row: name, spent of limit, what is left, a thin bar. */
export function BudgetProgress({ category, budgeted, spent, onEdit }: BudgetProgressProps) {
  const percentage = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0
  const isOverBudget = spent > budgeted
  const remaining = Math.max(budgeted - spent, 0)

  return (
    <div className="group min-w-0 space-y-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-body text-parchment">{category}</p>
        <div className="flex shrink-0 items-baseline gap-2">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} className="can-hover:opacity-0 can-hover:group-hover:opacity-100">
              Edit
            </Button>
          )}
          <span className="font-mono text-mono tabular-nums text-parchment/45">{percentage.toFixed(0)}%</span>
        </div>
      </div>
      <ProgressBar value={percentage} min={2} tone={isOverBudget ? 'bg-ember' : percentage > 85 ? 'bg-gold-glow' : 'bg-gold'} label={`${category} budget used`} />
      <div className="flex items-baseline justify-between gap-3 font-mono text-mono tabular-nums">
        <span className="text-parchment/60">
          <span className={isOverBudget ? 'text-ember' : 'text-parchment'}>₦{spent.toFixed(0)}</span> / ₦{budgeted.toFixed(0)}
        </span>
        <span className={cx('whitespace-nowrap', isOverBudget ? 'text-ember' : 'text-moss')}>
          {isOverBudget ? `₦${Math.abs(budgeted - spent).toFixed(0)} over` : `₦${remaining.toFixed(0)} left`}
        </span>
      </div>
    </div>
  )
}
