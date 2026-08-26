﻿'use client'

import React, { useState, useEffect } from 'react'
import { SECTION_CATEGORIES, BudgetCategoryOption } from './budgetCategories'

interface Purse {
  id: string
  name: string
  icon: string
  color: string
}

interface TransactionFormProps {
  onSuccess: () => void
  purses?: Purse[]
}

export function TransactionForm({ onSuccess, purses: externalPurses }: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [lastExpensePurse, setLastExpensePurse] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [comments, setComments] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [section, setSection] = useState('Need')
  const [purse, setPurse] = useState('')
  const [purses, setPurses] = useState<Purse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Use external purses if provided, otherwise fetch them
  useEffect(() => {
    if (externalPurses && externalPurses.length > 0) {
      setPurses(externalPurses)
      if (!purse) setPurse(externalPurses[0].name)
    } else {
      fetch('/api/purses')
        .then(r => r.json())
        .then(data => {
          if (data.purses?.length > 0) {
            setPurses(data.purses)
            setPurse(data.purses[0].name)
          }
        })
        .catch(() => { })
    }
  }, [externalPurses])

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
          category,
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

  const getPurseIcon = (name: string) => {
    const p = purses.find(p => p.name === name)
    return p?.icon || '👜'
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-surface-solid p-4 rounded-xl border border-white/10">
      {error && (
        <div className="p-3 bg-ember/10 dark:bg-ember/20 border border-ember/30 dark:border-ember/40 rounded-lg text-xs text-[#cf8f78] dark:text-[#cf8f78]">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-moss/10 dark:bg-moss/20 border border-moss/30 dark:border-moss/40 rounded-lg text-xs text-[#7fa871] dark:text-[#7fa871]">
          Transaction added successfully!
        </div>
      )}

      {/* Type Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setType('expense')
            // Restore the previously selected expense purse if any
            if (lastExpensePurse) setPurse(lastExpensePurse)
          }}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${type === 'expense' ? 'bg-ember/15 text-[#cf8f78] ring-2 ring-ember/40' : 'bg-black/20 text-parchment/50'}`}
        >
          💸 Expense (Debit)
        </button>
        <button
          type="button"
          onClick={() => {
            // Remember the current purse before forcing Main
            if (purse && purse !== 'Main') setLastExpensePurse(purse)
            setType('income')
            setPurse('Main')
          }}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${type === 'income' ? 'bg-moss/15 text-[#7fa871] ring-2 ring-moss/40' : 'bg-black/20 text-parchment/50'}`}
        >
          📥 Income (Credit)
        </button>
      </div>

      {/* Date */}
      <div>
        <label className="block text-xs text-parchment/50 mb-1">Date</label>
        <input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          required
          className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs text-parchment/50 mb-1">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-parchment/40">₦</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Category */}
      <div className="relative">
        <label className="block text-xs text-parchment/50 mb-1">Category</label>
        <input
          type="text"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          required
          className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
          placeholder={type === 'expense' ? 'e.g. Groceries, Rent, Tithe...' : 'e.g. Salary, Freelance...'}
        />
        {showSuggestions && category.length > 0 && filteredSuggestions.length > 0 && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-[#16120f] border border-white/10 rounded-lg max-h-48 overflow-y-auto" data-lenis-prevent>
            {filteredSuggestions.map(s => (
              <button
                key={s.label}
                type="button"
                onMouseDown={() => {
                  setCategory(s.label)
                  setShowSuggestions(false)
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2"
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}
        {/* Quick Category Pills */}
        {categorySuggestions.length > 0 && (
          <div className="mt-2">
            <label className="block text-xs text-parchment/40 mb-1">Quick Select (tap to fill)</label>
            <div className="flex flex-wrap gap-1.5">
              {categorySuggestions.slice(0, 6).map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setCategory(s.label)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${category === s.label
                    ? 'bg-gold/15 border-gold/40 text-gold'
                    : 'bg-black/20 border-white/10 text-parchment/50 hover:border-white/25'
                    }`}
                >
                  {s.icon} {s.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-parchment/50 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
          placeholder="What was this for?"
        />
      </div>

      {/* Comments */}
      <div>
        <label className="block text-xs text-parchment/50 mb-1">Comments (Optional)</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={2}
          className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
          placeholder="Any notes about this transaction..."
        />
      </div>

      {/* Purse selector */}
      <div>
        <label className="block text-xs text-parchment/50 mb-1">
          Purse {type === 'income' && <span className="text-parchment/40">(income always goes to Main)</span>}
        </label>
        <select
          value={purse}
          onChange={(e) => setPurse(e.target.value)}
          disabled={type === 'income'}
          className={`w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 ${type === 'income' ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {purses.map(p => (
            <option key={p.id} value={p.name}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
        {type === 'income' && (
          <p className="text-xs text-parchment/40 mt-1">
            All income is deposited into the 👜 Main purse. Use transfers to move funds to other purses.
          </p>
        )}
      </div>

      {/* Section selector for expenses */}
      {type === 'expense' && (
        <div>
          <label className="block text-xs text-parchment/50 mb-1">Section (Budget Category)</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setSection('Need')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Need' ? 'bg-[#B8935A]/15 text-[#B8935A] ring-2 ring-[#B8935A]/40' : 'bg-black/20 text-parchment/50'}`}
            >
              💪 Need
            </button>
            <button
              type="button"
              onClick={() => setSection('Want')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Want' ? 'bg-[#CF8F78]/15 text-[#CF8F78] ring-2 ring-[#CF8F78]/40' : 'bg-black/20 text-parchment/50'}`}
            >
              🌟 Want
            </button>
            <button
              type="button"
              onClick={() => setSection('Offerings')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Offerings' ? 'bg-[#7FA871]/15 text-[#7FA871] ring-2 ring-[#7FA871]/40' : 'bg-black/20 text-parchment/50'}`}
            >
              🙏 Offerings
            </button>
            <button
              type="button"
              onClick={() => setSection('Savings')}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${section === 'Savings' ? 'bg-[#8FA3BF]/15 text-[#8FA3BF] ring-2 ring-[#8FA3BF]/40' : 'bg-black/20 text-parchment/50'}`}
            >
              🏦 Savings
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gold text-ink hover:bg-[#cbaa6f] font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
      >
        {loading ? 'Adding...' : `Add to ${getPurseIcon(purse)} ${purse || 'Purse'}`}
      </button>
    </form>
  )
}