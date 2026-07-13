'use client'

import React, { useEffect, useState } from 'react'
import { TransactionForm } from '@/components/finance/TransactionForm'
import { BudgetProgress } from '@/components/finance/BudgetProgress'

export default function FinancePage() {
  const [entries, setEntries] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingsTarget, setSavingsTarget] = useState(0)
  const [editSavings, setEditSavings] = useState(false)
  const [savingsInput, setSavingsInput] = useState('')

  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  useEffect(() => {
    const stored = localStorage.getItem('monthlySavingsTarget')
    if (stored) setSavingsTarget(parseFloat(stored))
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [finRes, budRes] = await Promise.all([
        fetch('/api/financial'),
        fetch(`/api/budgets?month=${currentMonth}`)
      ])

      if (finRes.ok) {
        const finData = await finRes.json()
        setEntries(finData.entries || [])
        setTotalIncome(finData.totalIncome || 0)
        setTotalExpense(finData.totalExpense || 0)
      }

      if (budRes.ok) {
        const budData = await budRes.json()
        setBudgets(budData.budgets || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSetBudget = async () => {
    const category = prompt('Enter budget category (e.g., Food, Transport):')
    if (!category) return
    const amountStr = prompt(`Enter monthly budget amount for ${category}:`)
    if (!amountStr) return

    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, amount: parseFloat(amountStr), month: currentMonth })
    })

    fetchData()
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    await fetch('/api/financial', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })

    fetchData()
  }

  const handleSaveSavingsTarget = () => {
    const val = parseFloat(savingsInput)
    if (!isNaN(val) && val >= 0) {
      setSavingsTarget(val)
      localStorage.setItem('monthlySavingsTarget', val.toString())
    }
    setEditSavings(false)
  }

  // Calculate spent amounts per category
  const categorySpending: Record<string, number> = {}
  entries.forEach(entry => {
    if (entry.type === 'expense' && entry.entryDate.startsWith(currentMonth)) {
      categorySpending[entry.category] = (categorySpending[entry.category] || 0) + entry.amount
    }
  })

  const currentSavings = totalIncome - totalExpense
  const savingsProgress = savingsTarget > 0 ? Math.min((currentSavings / savingsTarget) * 100, 100) : 0

  // Build entries with running balance — sort ascending by date for the running calc
  const sortedEntries = [...entries].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  let runningBalance = 0
  const entriesWithBalance = sortedEntries.slice(0, 50).map(entry => {
    if (entry.type === 'income') runningBalance += entry.amount
    else runningBalance -= entry.amount
    return { ...entry, balance: runningBalance }
  })

  if (loading) {
    return <div className="p-4">Loading financial data...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24">
      <div>
        <h1 className="text-2xl font-bold mb-1">Finance & Budgeting</h1>
        <p className="text-sm text-gray-500">Track every dollar — income, expenses, and savings.</p>
      </div>

      {/* Balance Sheet Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Total Income</div>
          <div className="text-xl font-bold text-green-600">${totalIncome.toFixed(2)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Total Expenses</div>
          <div className="text-xl font-bold text-red-600">${totalExpense.toFixed(2)}</div>
        </div>
        <div className="bg-blue-600 p-4 rounded-xl border border-blue-700 shadow-sm text-white">
          <div className="text-xs text-blue-100 mb-1">Current Balance</div>
          <div className="text-xl font-bold">${(currentSavings).toFixed(2)}</div>
        </div>
        <div className="bg-purple-600 p-4 rounded-xl border border-purple-700 shadow-sm text-white">
          <div className="text-xs text-purple-100 mb-1">Monthly Savings</div>
          <div className="text-xl font-bold">${currentSavings >= 0 ? currentSavings.toFixed(2) : '0.00'}</div>
        </div>
      </div>

      {/* Savings Target */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">🎯 Monthly Savings Goal</h2>
          {!editSavings ? (
            <button
              onClick={() => { setEditSavings(true); setSavingsInput(savingsTarget.toString()) }}
              className="text-sm text-blue-500 hover:underline"
            >
              {savingsTarget > 0 ? 'Edit' : 'Set Goal'}
            </button>
          ) : null}
        </div>

        {editSavings ? (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                value={savingsInput}
                onChange={(e) => setSavingsInput(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="500.00"
                autoFocus
              />
            </div>
            <button onClick={handleSaveSavingsTarget} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
            <button onClick={() => setEditSavings(false)} className="text-sm text-gray-500 hover:underline">Cancel</button>
          </div>
        ) : (
          <div>
            {savingsTarget > 0 ? (
              <div>
                <div className="flex justify-between items-end mb-1">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-semibold text-purple-600">${Math.min(currentSavings, savingsTarget).toFixed(2)}</span> saved of <span className="font-semibold">${savingsTarget.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    ${Math.max(savingsTarget - currentSavings, 0).toFixed(2)} remaining
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full ${savingsProgress >= 100 ? 'bg-green-500' : savingsProgress >= 50 ? 'bg-purple-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.max(savingsProgress, 2)}%` }}
                  ></div>
                </div>
                {currentSavings >= savingsTarget && (
                  <p className="text-xs text-green-600 mt-2 font-medium">✓ Savings goal reached this month!</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Set a monthly savings target to track your progress.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Add Transaction */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Add Transaction</h2>
            <TransactionForm onSuccess={fetchData} />
          </div>

          {/* Budgeting Planner */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Monthly Budget Planner</h2>
              <button onClick={handleSetBudget} className="text-sm text-blue-500 hover:underline">
                + New Budget
              </button>
            </div>

            <div className="space-y-3">
              {budgets.length === 0 ? (
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  No budgets set for {currentMonth}. Assign every dollar a job!
                </div>
              ) : (
                budgets.map(budget => (
                  <BudgetProgress
                    key={budget.id}
                    category={budget.category}
                    budgeted={budget.amount}
                    spent={categorySpending[budget.category] || 0}
                    onEdit={handleSetBudget}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Transactions Table with Running Balance */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Transactions</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {entries.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No transactions yet. Add your first one!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Description</th>
                      <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Debit ($)</th>
                      <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Credit ($)</th>
                      <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Balance ($)</th>
                      <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Comments</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {entriesWithBalance.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                          {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{entry.description || entry.category}</div>
                          <div className="text-xs text-gray-400">
                            {entry.category}
                            {entry.priority && <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">({entry.priority})</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right font-medium text-red-600 whitespace-nowrap">
                          {entry.type === 'expense' ? `$${entry.amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-right font-medium text-green-600 whitespace-nowrap">
                          {entry.type === 'income' ? `$${entry.amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-right font-semibold whitespace-nowrap">
                          <span className={entry.balance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                            ${entry.balance.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-gray-500 max-w-[140px] truncate">
                          {entry.comments || '-'}
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => handleDeleteEntry(entry.id)} className="text-gray-400 hover:text-red-500 text-lg leading-none">
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {entries.length > 50 && (
            <p className="text-xs text-gray-500 mt-2 text-center">Showing 50 of {entries.length} transactions</p>
          )}
        </div>
      </div>
    </div>
  )
}