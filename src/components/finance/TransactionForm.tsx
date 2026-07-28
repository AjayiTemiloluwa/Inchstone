'use client'

import React, { useState } from 'react'
import { SECTION_CATEGORIES, BudgetCategoryOption } from './budgetCategories'

interface TransactionFormProps {
  onSuccess: () => void
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [comments, setComments] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [section, setSection] = useState('Need')
  const [purse, setPurse] = useState<'main' | 'savings'>('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const isSavings = purse === 'savings'

  const categorySuggestions: BudgetCategoryOption[] = type === 'expense'
    ? (SECTION_CATEGORIES[section] || [])
    : type === 'income'
      ? [
        { label: 'Salary / Wages', icon: '💰' },
        { label: 'Freelance / Side Hustle', icon: '💼' },
        { label: 'Business Income', icon: '🏪' },
        { label: 'Investment Returns', icon: '📈' },
        { label: 'Gifts Received', icon: '🎁' },
        { label: 'Refunds / Rebates', icon: '🔄' },
        { label: 'Other Income', icon: '📥' },
      ]
      : []

  const filteredSuggestions = categorySuggestions.filter(
    s => s.label.toLowerCase().includes(category.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: parseFloat(amount),
          category: isSavings ? 'Savings Transfer' : category,
          description,
          comments,
          entryDate,
          priority: type === 'expense' ? section : null,
          purse
        })
      })

      let data
      try {
        data = await res.json()
      } catch (parseError) {
        const text = await res.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        setError('Authentication error. Please refresh the page and try again.')
        return
      }

      if (!res.ok) {
        const errorMsg = data.error || data.message || `Server error (${res.status})`
        console.error('[TransactionForm] Server error:', res.status, errorMsg)
        setError(errorMsg)
      } else {
        console.log('[TransactionForm] Transaction added successfully')
        setAmount('')
        setCategory('')
        setDescription('')
        setComments('')
        setEntryDate(new Date().toISOString().split('T')[0])
        setSuccess(true)
        onSuccess()
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err) {
      console.error('[TransactionForm] Submission error:', err)
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-600 dark:text-green-400">
          Transaction added successfully!
        </div>
      )}

      {/* Type Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${type === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-2 ring-red-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          💸 Expense (Debit)
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${type === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-2 ring-green-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          📥 Income (Credit)
        </button>
      </div>

      {/* Date */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Date</label>
        <input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          required
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-gray-400">$</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Category - Only show for non-savings transactions */}
      {!isSavings && (
        <div className="relative">
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            required={!isSavings}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={type === 'expense' ? 'e.g. Groceries, Rent, Tithe...' : 'e.g. Salary, Freelance...'}
          />
          {showSuggestions && category.length > 0 && filteredSuggestions.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredSuggestions.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onMouseDown={() => {
                    setCategory(s.label)
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
          {/* Quick Category Pills for non-savings */}
          {categorySuggestions.length > 0 && (
            <div className="mt-2">
              <label className="block text-xs text-gray-400 mb-1">Quick Select (tap to fill)</label>
              <div className="flex flex-wrap gap-1.5">
                {categorySuggestions.slice(0, 6).map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setCategory(s.label)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${category === s.label
                      ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                      }`}
                  >
                    {s.icon} {s.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Savings badge - shown instead of category for savings */}
      {isSavings && (
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏦</span>
            <div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Savings Transaction</p>
              <p className="text-xs text-purple-500 dark:text-purple-400">No category needed — money flows to/from savings purse</p>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={isSavings ? 'e.g. Building emergency fund' : 'What was this for?'}
        />
      </div>

      {/* Comments */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Comments (Optional)</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={2}
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Any notes about this transaction..."
        />
      </div>

      {/* Purse selector */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Purse</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPurse('main')}
            className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${purse === 'main' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            👜 Main Purse
          </button>
          <button
            type="button"
            onClick={() => setPurse('savings')}
            className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${purse === 'savings' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ring-2 ring-purple-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            🏦 Savings
          </button>
        </div>
      </div>

      {/* Section selector for expenses */}
      {type === 'expense' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Section (Budget Category)</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setSection('Need')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Need' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              💪 Need
            </button>
            <button
              type="button"
              onClick={() => setSection('Want')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Want' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-2 ring-amber-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              🌟 Want
            </button>
            <button
              type="button"
              onClick={() => setSection('Offerings')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Offerings' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ring-2 ring-emerald-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              🙏 Offerings
            </button>
            <button
              type="button"
              onClick={() => setSection('Savings')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Savings' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ring-2 ring-purple-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              🏦 Savings
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
      >
        {loading ? 'Adding...' : isSavings ? `Add to 🏦 Savings` : 'Add Transaction'}
      </button>
    </form>
  )
}