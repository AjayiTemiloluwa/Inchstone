'use client'

import React, { useState } from 'react'

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
  const [priority, setPriority] = useState('Need')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: parseFloat(amount),
          category,
          description,
          comments,
          entryDate,
          priority: type === 'expense' ? priority : null
        })
      })

      if (res.ok) {
        setAmount('')
        setCategory('')
        setDescription('')
        setComments('')
        setEntryDate(new Date().toISOString().split('T')[0])
        onSuccess()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${type === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          Expense (Debit)
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${type === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          Income (Credit)
        </button>
      </div>

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

      <div>
        <label className="block text-xs text-gray-500 mb-1">Category</label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={type === 'expense' ? 'e.g. Groceries, Rent' : 'e.g. Salary, Side Hustle'}
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="What was this for?"
        />
      </div>

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

      {type === 'expense' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Rank / Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Need">Need (Essential)</option>
            <option value="Want">Want (Non-essential)</option>
            <option value="Luxury">Luxury (Splurge)</option>
            <option value="Debt">Debt Repayment</option>
            <option value="Savings">Savings/Investment</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add Transaction'}
      </button>
    </form>
  )
}