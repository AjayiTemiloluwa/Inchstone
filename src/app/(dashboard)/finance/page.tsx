﻿'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { TransactionForm } from '@/components/finance/TransactionForm'
import { BudgetProgress } from '@/components/finance/BudgetProgress'
import { SectionBudgetCard } from '@/components/finance/SectionBudgetCard'
import { getSectionIcon } from '@/components/finance/budgetCategories'

const SECTION_KEYS = ['Need', 'Want', 'Offerings', 'Savings'] as const
type Section = typeof SECTION_KEYS[number]

interface Entry {
  id: string
  type: string
  amount: number
  category: string
  description: string | null
  comments: string | null
  entryDate: string
  priority: string | null
  purse: string
  section?: string
  balance?: number
}

interface Budget {
  id: string
  category: string
  amount: number
  section: string
  month: string
}

interface Allocation {
  id: string
  section: string
  amount: number
  month: string
}

interface Purse {
  id: string
  name: string
  icon: string
  color: string
}

const PURSE_ICONS = ['👜', '🏦', '💰', '💳', '🐷', '🏪', '📦', '🎯', '⭐', '💎', '🌴', '🚗', '🏠', '📚', '✈️', '🎓']

const PURSE_COLORS = [
  '#8a6d42', '#b8935a', '#4a5d45', '#7fa871',
  '#7a3b2e', '#cf8f78', '#5c6b8a', '#6b5c7a',
  '#7a6f5c', '#3f5a5a', '#6b7a4a', '#8a6a4a',
  '#9a8f7a', '#4a5a6b', '#5a4a3f', '#7a6a8a',
]

export default function FinancePage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [purses, setPurses] = useState<Purse[]>([])
  const [purseBalances, setPurseBalances] = useState<Record<string, number>>({})
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingsTarget, setSavingsTarget] = useState(0)
  const [editSavings, setEditSavings] = useState(false)
  const [savingsInput, setSavingsInput] = useState('')

  // Transfer modal state
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferDesc, setTransferDesc] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)

  // Add purse modal state
  const [showAddPurse, setShowAddPurse] = useState(false)
  const [newPurseName, setNewPurseName] = useState('')
  const [newPurseIcon, setNewPurseIcon] = useState('👜')
  const [newPurseColor, setNewPurseColor] = useState('#8a6d42')
  const [addPurseLoading, setAddPurseLoading] = useState(false)

  // Delete purse state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  useEffect(() => {
    const stored = localStorage.getItem('monthlySavingsTarget')
    if (stored) setSavingsTarget(parseFloat(stored))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [finRes, budRes, purseRes] = await Promise.all([
        fetch('/api/financial'),
        fetch(`/api/budgets?month=${currentMonth}`),
        fetch('/api/purses'),
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
        setAllocations(budData.allocations || [])
      }

      if (purseRes.ok) {
        const purseData = await purseRes.json()
        setPurses(purseData.purses || [])
        setPurseBalances(purseData.purseBalances || {})
        // Set default transfer selections
        if (purseData.purses?.length >= 2) {
          setTransferFrom(purseData.purses[0].name)
          setTransferTo(purseData.purses[1].name)
        } else if (purseData.purses?.length === 1) {
          setTransferFrom(purseData.purses[0].name)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle section allocation
  const handleAllocateToSection = async (section: Section, amount: number) => {
    await fetch('/api/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, amount, month: currentMonth })
    })
    fetchData()
  }

  // Handle adding a budget category under a section
  const handleAddBudgetCategory = async (section: Section, category: string, amount: number) => {
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, category, amount, month: currentMonth })
    })
    fetchData()
  }

  // Handle deleting a budget
  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Delete this budget category?')) return
    await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
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

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferAmount || !transferFrom || !transferTo) return

    setTransferLoading(true)
    try {
      const res = await fetch('/api/financial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(transferAmount),
          from: transferFrom,
          to: transferTo,
          description: transferDesc
        })
      })

      if (res.ok) {
        setTransferAmount('')
        setTransferDesc('')
        setShowTransfer(false)
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Transfer failed')
      }
    } catch (err) {
      console.error('Transfer failed:', err)
      alert('Transfer failed. Please try again.')
    } finally {
      setTransferLoading(false)
    }
  }

  const handleAddPurse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPurseName.trim()) return

    setAddPurseLoading(true)
    try {
      const res = await fetch('/api/purses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPurseName.trim(),
          icon: newPurseIcon,
          color: newPurseColor,
        })
      })

      if (res.ok) {
        setNewPurseName('')
        setNewPurseIcon('👜')
        setNewPurseColor('#3B82F6')
        setShowAddPurse(false)
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create purse')
      }
    } catch (err) {
      console.error('Failed to create purse:', err)
    } finally {
      setAddPurseLoading(false)
    }
  }

  const handleDeletePurse = async (id: string) => {
    try {
      const res = await fetch('/api/purses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (res.ok) {
        setDeleteConfirm(null)
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete purse')
      }
    } catch (err) {
      console.error('Failed to delete purse:', err)
    }
  }

  // Calculate spent amounts per category
  const categorySpending: Record<string, number> = {}
  entries.forEach(entry => {
    if (entry.type === 'expense' && entry.entryDate?.startsWith(currentMonth)) {
      categorySpending[entry.category] = (categorySpending[entry.category] || 0) + entry.amount
    }
  })

  // Calculate spending per section
  const sectionSpending: Record<string, number> = { Need: 0, Want: 0, Offerings: 0, Savings: 0 }
  entries.forEach(entry => {
    if (entry.type === 'expense' && entry.entryDate?.startsWith(currentMonth)) {
      const section = entry.priority && ['Need', 'Want', 'Offerings', 'Savings'].includes(entry.priority) ? entry.priority as Section : 'Need'
      sectionSpending[section] = (sectionSpending[section] || 0) + entry.amount
    }
  })

  // Group budgets by section
  const budgetsBySection: Record<string, Budget[]> = { Need: [], Want: [], Offerings: [], Savings: [] }
  budgets.forEach(budget => {
    if (budgetsBySection[budget.section]) {
      budgetsBySection[budget.section].push(budget)
    }
  })

  // Section totals from allocations
  const sectionAllocations: Record<string, number> = { Need: 0, Want: 0, Offerings: 0, Savings: 0 }
  allocations.forEach(a => {
    sectionAllocations[a.section] = a.amount
  })

  const totalAllocated = Object.values(sectionAllocations).reduce((sum, v) => sum + v, 0)

  const currentSavings = totalIncome - totalExpense
  const savingsProgress = savingsTarget > 0 ? Math.min((currentSavings / savingsTarget) * 100, 100) : 0

  // Build entries with running balance
  const sortedEntries = [...entries].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  let runningBalance = 0
  const entriesWithBalance = sortedEntries.slice(0, 50).map(entry => {
    if (entry.type === 'income') runningBalance += entry.amount
    else if (entry.type === 'expense') runningBalance -= entry.amount
    return { ...entry, balance: runningBalance }
  })

  const getPurseIcon = (name: string) => {
    const purse = purses.find(p => p.name === name)
    return purse?.icon || '👜'
  }

  const getPurseColor = (name: string) => {
    const purse = purses.find(p => p.name === name)
    return purse?.color || '#8a6d42'
  }

  if (loading) {
    return <div className="p-4">Loading financial data...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24">
      <div>
        <h1 className="text-2xl font-bold mb-1">Finance & Budgeting</h1>
        <p className="text-sm text-gray-500">Track every naira — income, expenses, and savings.</p>
      </div>

      {/* Balance Sheet Overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Purses</h2>
          <button
            onClick={() => setShowAddPurse(!showAddPurse)}
            className="text-sm text-blue-500 hover:underline font-medium"
          >
            {showAddPurse ? 'Cancel' : '+ Add Purse'}
          </button>
        </div>

        {/* Add Purse Form */}
        {showAddPurse && (
          <form onSubmit={handleAddPurse} className="mb-4 p-4 bg-surface-solid border-hairline rounded-xl border border-gold-dim/20 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Purse Name</label>
              <input
                type="text"
                value={newPurseName}
                onChange={(e) => setNewPurseName(e.target.value)}
                required
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gold-dim/20 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Emergency Fund, Travel, Business..."
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {PURSE_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewPurseIcon(icon)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-all ${newPurseIcon === icon ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-110' : 'bg-gray-50 dark:bg-gray-900 border border-gold-dim/20 hover:border-blue-300'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {PURSE_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewPurseColor(color)}
                    className={`w-8 h-8 rounded-lg transition-all ${newPurseColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={addPurseLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {addPurseLoading ? 'Creating...' : 'Create Purse'}
            </button>
          </form>
        )}

        {/* Purse Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {purses.map(purse => {
            const balance = purseBalances[purse.name] || 0
            return (
              <div
                key={purse.id}
                className="relative group rounded-xl border p-4 text-white transition-all "
                style={{ backgroundColor: purse.color }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{purse.icon}</span>
                  {purses.length > 1 && (
                    <button
                      onClick={() => setDeleteConfirm(deleteConfirm === purse.id ? null : purse.id)}
                      className="text-white/60 hover:text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="text-xs text-white/80 mb-1">{purse.name}</div>
                <div className="text-lg font-bold">₦{balance.toFixed(2)}</div>

                {/* Delete confirmation */}
                {deleteConfirm === purse.id && (
                  <div className="absolute inset-0 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 z-10">
                    <div className="text-center">
                      <p className="text-xs text-white/90 mb-2">Delete "{purse.name}"?<br />Entries will move to another purse.</p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleDeletePurse(purse.id)}
                          className="px-3 py-1 bg-ember text-white text-xs rounded-lg hover:bg-ember"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1 bg-white/20 text-white text-xs rounded-lg hover:bg-white/30"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Start of Month: Add Money to Sections */}
      <div className="bg-surface-solid border-hairline p-5 rounded-xl border border-gold-dim/20 ">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>📋</span> Start of Month Allocation
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Assign money to each section for the month of {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
              Allocated: <span className="font-semibold text-parchment">₦{totalAllocated.toFixed(2)}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SECTION_KEYS.map(section => {
            const allocated = sectionAllocations[section]
            const spent = sectionSpending[section]
            const remaining = allocated - spent
            const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0
            return (
              <div key={section} className={`p-4 rounded-xl border ${section === 'Need' ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-900/5 dark:border-blue-800' :
                section === 'Want' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-900/5 dark:border-amber-800' :
                  section === 'Offerings' ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/5 dark:border-emerald-800' :
                    'border-purple-200 bg-purple-50/50 dark:bg-purple-900/5 dark:border-purple-800'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span>{getSectionIcon(section)}</span>
                    <span className="font-semibold text-sm">{section}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${allocated > 0 ? 'bg-moss/15 text-[#7fa871] dark:bg-green-900/30 dark:text-[#7fa871]' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                    ₦{allocated.toFixed(0)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
                  <div
                    className={`h-1.5 rounded-full ${remaining < 0 ? 'bg-ember' : pct > 85 ? 'bg-yellow-500' : section === 'Need' ? 'bg-blue-500' : section === 'Want' ? 'bg-amber-500' : section === 'Offerings' ? 'bg-emerald-500' : 'bg-purple-500'}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-gray-500 flex justify-between">
                  <span>₦{spent.toFixed(0)} spent</span>
                  <span>{remaining >= 0 ? `₦${remaining.toFixed(0)} left` : `₦${Math.abs(remaining).toFixed(0)} over`}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section Budgets (Need, Want, Offerings, Savings) */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>📊</span> Budget by Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {SECTION_KEYS.map(section => (
            <SectionBudgetCard
              key={section}
              section={section}
              totalAllocated={sectionAllocations[section]}
              totalSpent={sectionSpending[section]}
              budgets={budgetsBySection[section]}
              categorySpending={categorySpending}
              entries={entries}
              currentMonth={currentMonth}
              onAllocate={(amount) => handleAllocateToSection(section, amount)}
              onAddBudget={(category, amount) => handleAddBudgetCategory(section, category, amount)}
              onDeleteBudget={handleDeleteBudget}
              onDeleteEntry={handleDeleteEntry}
            />
          ))}
        </div>
      </div>

      {/* Transfer Card */}
      <div className="bg-surface-solid border-hairline p-5 rounded-xl border border-gold-dim/20 ">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">🔄 Transfer Between Purses</h2>
          <button
            onClick={() => setShowTransfer(!showTransfer)}
            className="text-sm text-blue-500 hover:underline"
          >
            {showTransfer ? 'Cancel' : 'Transfer'}
          </button>
        </div>

        {showTransfer && (
          <form onSubmit={handleTransfer} className="space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gold-dim/20 rounded-lg py-2 px-3 text-sm"
                >
                  {purses.map(p => (
                    <option key={p.id} value={p.name}>
                      {p.icon} {p.name} (₦{(purseBalances[p.name] || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-8 text-center text-parchment/40 pb-2">→</div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gold-dim/20 rounded-lg py-2 px-3 text-sm"
                >
                  {purses.filter(p => p.name !== transferFrom).map(p => (
                    <option key={p.id} value={p.name}>
                      {p.icon} {p.name} (₦{(purseBalances[p.name] || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-parchment/40">₦</span>
                  <input
                    type="number"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gold-dim/20 rounded-lg py-2 pl-7 pr-3 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gold-dim/20 rounded-lg py-2 px-3 text-sm"
                  placeholder="e.g. Building savings"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={transferLoading || transferFrom === transferTo}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {transferLoading ? 'Transferring...' : `Transfer ${transferFrom ? getPurseIcon(transferFrom) : ''} → ${transferTo ? getPurseIcon(transferTo) : ''}`}
            </button>
          </form>
        )}
      </div>

      {/* Savings Target */}
      <div className="bg-surface-solid border-hairline p-5 rounded-xl border border-gold-dim/20 ">
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
              <span className="absolute left-3 top-2.5 text-parchment/40">₦</span>
              <input
                type="number"
                step="0.01"
                value={savingsInput}
                onChange={(e) => setSavingsInput(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gold-dim/20 rounded-lg py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <span className="font-semibold text-purple-600">₦{Math.min(currentSavings, savingsTarget).toFixed(2)}</span> saved of <span className="font-semibold">₦{savingsTarget.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    ₦{Math.max(savingsTarget - currentSavings, 0).toFixed(2)} remaining
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full ${savingsProgress >= 100 ? 'bg-moss/100' : savingsProgress >= 50 ? 'bg-purple-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.max(savingsProgress, 2)}%` }}
                  ></div>
                </div>
                {currentSavings >= savingsTarget && (
                  <p className="text-xs text-[#7fa871] mt-2 font-medium">✓ Savings goal reached this month!</p>
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
            <TransactionForm onSuccess={fetchData} purses={purses} />
          </div>

          {/* Monthly Budget Overview */}
          <div>
            <h2 className="text-lg font-semibold mb-3">All Budgets Overview</h2>
            <div className="space-y-3">
              {budgets.length === 0 ? (
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  No budgets set for {currentMonth}. Use the section cards above to assign every naira a job!
                </div>
              ) : (
                budgets.map(budget => (
                  <BudgetProgress
                    key={budget.id}
                    category={`${budget.section} › ${budget.category}`}
                    budgeted={budget.amount}
                    spent={categorySpending[budget.category] || 0}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Transactions Table with Running Balance */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Transactions Ledger</h2>
          <div className="bg-surface-solid border-hairline rounded-xl border border-gold-dim/20 overflow-hidden">
            {entries.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No transactions yet. Add your first one!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Description</th>
                      <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Debit (₦)</th>
                      <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Credit (₦)</th>
                      <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Balance (₦)</th>
                      <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Purse</th>
                      <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Section</th>
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
                          <div className="font-medium text-parchment">{entry.description || entry.category}</div>
                          <div className="text-xs text-parchment/40">
                            {entry.category}
                            {entry.priority && <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">({entry.priority})</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right font-medium text-[#cf8f78] whitespace-nowrap">
                          {entry.type === 'expense' || entry.type === 'transfer_out' ? `₦${entry.amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-right font-medium text-[#7fa871] whitespace-nowrap">
                          {entry.type === 'income' || entry.type === 'transfer_in' ? `₦${entry.amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-right font-semibold whitespace-nowrap">
                          <span className={entry.balance >= 0 ? 'text-parchment' : 'text-[#cf8f78]'}>
                            ₦{entry.balance.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1"
                            style={{
                              backgroundColor: `${getPurseColor(entry.purse)}20`,
                              color: getPurseColor(entry.purse),
                            }}
                          >
                            {getPurseIcon(entry.purse)} {entry.purse}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          {entry.priority && ['Need', 'Want', 'Offerings', 'Savings'].includes(entry.priority) ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.priority === 'Need' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-parchment' :
                              entry.priority === 'Want' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                entry.priority === 'Offerings' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              }`}>
                              {entry.priority === 'Need' ? '💪' : entry.priority === 'Want' ? '🌟' : entry.priority === 'Offerings' ? '🙏' : '🏦'} {entry.priority}
                            </span>
                          ) : (
                            <span className="text-[10px] text-parchment/40">-</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-gray-500 max-w-[120px] truncate">
                          {entry.comments || '-'}
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => handleDeleteEntry(entry.id)} className="text-parchment/40 hover:text-[#cf8f78] text-lg leading-none">
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