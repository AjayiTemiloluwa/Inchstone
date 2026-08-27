'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TransactionForm } from '@/components/finance/TransactionForm'
import { BudgetProgress } from '@/components/finance/BudgetProgress'
import { SectionBudgetCard } from '@/components/finance/SectionBudgetCard'
import { CountUp, SectionHeading, Scramble, Reveal, RevealLines } from '@/components/ui/motion'
import { Loader } from '@/components/ui/Loader'
import { Float } from '@/components/effects/fluid'

const SECTION_KEYS = ['Need', 'Want', 'Offerings', 'Savings'] as const
const SECTION_TINT: Record<string, string> = { Need: '#B8935A', Want: '#CF8F78', Offerings: '#7FA871', Savings: '#8FA3BF' }
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

  // Month under inspection — toggle it from the header arrows
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = viewMonth === nowKey

  const shiftMonth = (delta: number) => {
    const [y, m] = viewMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const viewMonthLabel = new Date(
    Number(viewMonth.slice(0, 4)),
    Number(viewMonth.slice(5, 7)) - 1,
    1,
  ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => {
    const stored = localStorage.getItem('monthlySavingsTarget')
    if (stored) setSavingsTarget(parseFloat(stored))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [finRes, budRes, purseRes] = await Promise.all([
        fetch('/api/financial'),
        fetch(`/api/budgets?month=${viewMonth}`),
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
  }, [viewMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle section allocation
  const handleAllocateToSection = async (section: Section, amount: number) => {
    await fetch('/api/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, amount, month: viewMonth })
    })
    fetchData()
  }

  // Handle adding a budget category under a section
  const handleAddBudgetCategory = async (section: Section, category: string, amount: number) => {
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, category, amount, month: viewMonth })
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
    if (entry.type === 'expense' && entry.entryDate?.startsWith(viewMonth)) {
      categorySpending[entry.category] = (categorySpending[entry.category] || 0) + entry.amount
    }
  })

  // Calculate spending per section
  const sectionSpending: Record<string, number> = { Need: 0, Want: 0, Offerings: 0, Savings: 0 }
  entries.forEach(entry => {
    if (entry.type === 'expense' && entry.entryDate?.startsWith(viewMonth)) {
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

  // Running balance across the FULL history (chronological), displayed newest-first
  const chronological = [...entries].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  const balanceById = new Map<string, number>()
  let runningBalance = 0
  chronological.forEach(entry => {
    if (entry.type === 'income' || entry.type === 'transfer_in') runningBalance += entry.amount
    else runningBalance -= entry.amount
    balanceById.set(entry.id, runningBalance)
  })
  // Transactions inside the viewed month (balance column still reads full history)
  const entriesInMonth = entries.filter(e => e.entryDate?.startsWith(viewMonth))
  const recentEntries = [...entriesInMonth]
    .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
    .slice(0, 30)

  const getPurseIcon = (name: string) => {
    const purse = purses.find(p => p.name === name)
    return purse?.icon || '👜'
  }

  const getPurseColor = (name: string) => {
    const purse = purses.find(p => p.name === name)
    return purse?.color || '#8a6d42'
  }

  if (loading) {
    return <Loader label="Counting your coins…" routeKey="finance" />
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24">
      {/* ── Meta strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-white/5 pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-parchment/40">Ledger · {entries.length} entries</p>
        <div className="flex items-center gap-1.5 rounded-lg bg-black/20 border border-white/10 px-1.5 py-1">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month"
            className="w-7 h-7 grid place-items-center rounded-md text-parchment/50 hover:text-parchment hover:bg-white/5 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-xs font-mono text-parchment/80 tabular-nums">
            {viewMonthLabel}
          </span>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" disabled={isCurrentMonth}
            className="w-7 h-7 grid place-items-center rounded-md text-parchment/50 hover:text-parchment hover:bg-white/5 transition-colors disabled:opacity-25 disabled:hover:bg-transparent">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentMonth && (
            <button onClick={() => setViewMonth(nowKey)}
              className="ml-1 px-2 py-1 rounded-md bg-gold/15 border border-gold/30 text-[10px] font-bold uppercase tracking-wider text-gold hover:bg-gold/25 transition-colors">
              Today
            </button>
          )}
        </div>
      </div>

      {/* ── Hero: masked-line reveal, dion-style ── */}
      <header data-noreveal>
        <h1 className="font-display text-[clamp(2.6rem,6.5vw,4.6rem)] leading-[1.04] text-parchment">
          <RevealLines
            delay={80}
            fluid
            lines={[
              'Every sum,',
              'accounted for.',
            ]}
          />
        </h1>
        <div className="mt-5 flex items-center gap-4">
          <span aria-hidden="true" className="h-px w-12 shrink-0 bg-gold/60" />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-parchment/50">
            Income, expenses & savings — {viewMonthLabel}
          </p>
        </div>
      </header>

      {/* ── Figures strip ── */}
      <Float delay={0.5} duration={10} amp={6}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="spotlight-card rounded-xl border border-white/10 bg-surface-solid p-4">
          <p className="text-[10px] uppercase tracking-wider text-parchment/50 font-bold flex items-center gap-1.5"><span>📥</span> Income</p>
          <p className="mt-1 text-xl font-bold font-mono text-[#7fa871]"><CountUp value={totalIncome} format={n => `₦${n.toFixed(2)}`} /></p>
        </div>
        <div className="spotlight-card rounded-xl border border-white/10 bg-surface-solid p-4">
          <p className="text-[10px] uppercase tracking-wider text-parchment/50 font-bold flex items-center gap-1.5"><span>💸</span> Expenses</p>
          <p className="mt-1 text-xl font-bold font-mono text-[#cf8f78]"><CountUp value={totalExpense} format={n => `₦${n.toFixed(2)}`} /></p>
        </div>
        <div className="spotlight-card rounded-xl border border-white/10 bg-surface-solid p-4">
          <p className="text-[10px] uppercase tracking-wider text-parchment/50 font-bold flex items-center gap-1.5"><span>⚖️</span> Net</p>
          <p className={`mt-1 text-xl font-bold font-mono ${currentSavings >= 0 ? 'text-parchment' : 'text-[#cf8f78]'}`}><CountUp value={currentSavings} format={n => `₦${n.toFixed(2)}`} /></p>
        </div>
        <div className={`spotlight-card rounded-xl border border-white/10 bg-surface-solid p-4 ${savingsProgress >= 100 ? 'border-beam' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-parchment/50 font-bold truncate">🎯 Savings Goal</p>
            <button onClick={() => { setEditSavings(!editSavings); setSavingsInput(savingsTarget.toString()) }} className="text-[10px] font-bold text-gold hover:text-[#cbaa6f] transition-colors shrink-0">
              {editSavings ? 'Cancel' : savingsTarget > 0 ? 'Edit' : 'Set'}
            </button>
          </div>
          {editSavings ? (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-parchment/40 text-xs">₦</span>
                <input type="number" step="0.01" value={savingsInput} onChange={(e) => setSavingsInput(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg py-1.5 pl-6 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/30" placeholder="500" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveSavingsTarget()} />
              </div>
              <button onClick={handleSaveSavingsTarget} className="px-2.5 py-1.5 rounded-lg bg-gold text-ink text-xs font-bold hover:bg-[#cbaa6f] transition-colors shrink-0">Save</button>
            </div>
          ) : savingsTarget > 0 ? (
            <>
              <p className="mt-1 text-lg font-bold font-mono tabular-nums text-parchment truncate">
                ₦{Math.max(currentSavings, 0).toFixed(0)} <span className="text-xs text-parchment/40 font-sans">/ ₦{savingsTarget.toFixed(0)}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${savingsProgress >= 100 ? 'bg-moss' : 'bg-gold'}`} style={{ width: `${Math.max(savingsProgress, 2)}%` }} />
              </div>
              {savingsProgress >= 100 && <p className="mt-1 text-[10px] font-bold text-[#7fa871]">Goal reached ✓</p>}
            </>
          ) : (
            <p className="mt-1 text-xs text-parchment/40">Tap Set to add a monthly target.</p>
          )}
        </div>
      </div>
      </Float>

      {/* Balance Sheet Overview */}
      <div>
        <SectionHeading
          icon="👛"
          text="Purses"
          className="mb-4"
          right={
            <button
              onClick={() => setShowAddPurse(!showAddPurse)}
              className="link-slide text-xs font-bold text-gold hover:text-[#cbaa6f] transition-colors"
            >
              {showAddPurse ? 'Cancel' : '+ Add Purse'}
            </button>
          }
        />

        {/* Add Purse Form */}
        {showAddPurse && (
          <form onSubmit={handleAddPurse} className="mb-4 p-4 bg-surface-solid border-hairline rounded-xl border border-gold-dim/20 space-y-3">
            <div>
              <label className="block text-xs text-parchment/50 mb-1">Purse Name</label>
              <input
                type="text"
                value={newPurseName}
                onChange={(e) => setNewPurseName(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                placeholder="e.g. Emergency Fund, Travel, Business..."
              />
            </div>
            <div>
              <label className="block text-xs text-parchment/50 mb-1">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {PURSE_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewPurseIcon(icon)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-all ${newPurseIcon === icon ? 'ring-2 ring-gold bg-gold/15 scale-110' : 'bg-black/20 border border-white/10 hover:border-white/25'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-parchment/50 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {PURSE_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewPurseColor(color)}
                    className={`w-8 h-8 rounded-lg transition-all ${newPurseColor === color ? 'ring-2 ring-offset-2 ring-ink ring-parchment/60 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={addPurseLoading}
              className="w-full bg-gold text-ink hover:bg-[#cbaa6f] font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {addPurseLoading ? 'Creating...' : 'Create Purse'}
            </button>
          </form>
        )}

        {/* Purse Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {purses.map((purse, i) => {
            const balance = purseBalances[purse.name] || 0
            return (
              <Reveal key={purse.id} delay={i * 70}>
              <div
                className="tilt-card spotlight-card relative group rounded-xl p-4 text-white transition-all shadow-lg shadow-black/20"
                style={{ backgroundColor: purse.color }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{purse.icon}</span>
                  {purses.length > 1 && (
                    <button
                      onClick={() => setDeleteConfirm(deleteConfirm === purse.id ? null : purse.id)}
                      className="text-white/70 hover:text-white text-base leading-none transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-white/85 mb-1">{purse.name}</div>
                <div className="text-xl font-bold font-mono tabular-nums">₦{balance.toFixed(2)}</div>

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
              </Reveal>
            )
          })}
        </div>
      </div>

      {/* Section Budgets (Need, Want, Offerings, Savings) */}
      <div>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>📊</span> <Scramble text="Budget by Sections" />
          </h2>
          <p className="text-xs text-parchment/40 font-mono tabular-nums">
            Allocated {totalAllocated.toFixed(0)} · Spent {Object.values(sectionSpending).reduce((s: number, v: number) => s + v, 0).toFixed(0)}
          </p>
        </div>
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
              currentMonth={viewMonth}
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
          <h2 className="text-lg font-semibold"><span className="mr-2">🔄</span><Scramble text="Transfer Between Purses" /></h2>
          <button
            onClick={() => setShowTransfer(!showTransfer)}
            className="text-xs font-bold text-gold hover:text-[#cbaa6f] transition-colors"
          >
            {showTransfer ? 'Cancel' : 'Transfer'}
          </button>
        </div>

        {showTransfer && (
          <form onSubmit={handleTransfer} className="space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-parchment/50 mb-1">From</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm"
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
                <label className="block text-xs text-parchment/50 mb-1">To</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm"
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
                <label className="block text-xs text-parchment/50 mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-parchment/40">₦</span>
                  <input
                    type="number"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-7 pr-3 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-parchment/50 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-sm"
                  placeholder="e.g. Building savings"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={transferLoading || transferFrom === transferTo}
              className="w-full bg-gold text-ink hover:bg-[#cbaa6f] font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {transferLoading ? 'Transferring...' : `Transfer ${transferFrom ? getPurseIcon(transferFrom) : ''} → ${transferTo ? getPurseIcon(transferTo) : ''}`}
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
<div className="space-y-6">
          {/* Add Transaction */}
          <div>
            <h2 className="text-lg font-semibold mb-3"><Scramble text="Add Transaction" /></h2>
            <TransactionForm onSuccess={fetchData} purses={purses} />
          </div>

          {/* Monthly Budget Overview */}
          <div>
            <h2 className="text-lg font-semibold mb-3"><Scramble text="All Budgets Overview" /></h2>
            <div className="space-y-3">
              {budgets.length === 0 ? (
                <div className="text-sm text-parchment/50 italic p-4 bg-black/20 rounded-xl">
                  No budgets set for {viewMonthLabel}. Use the section cards above to give each part of your plan a job!
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
      </div>

{/* Ledger */}
      <div>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🧾</span> <Scramble text="Ledger" />
          </h2>
          <p className="text-xs text-parchment/40 font-mono">{entries.length} transactions · newest first</p>
        </div>
        <div className="bg-surface-solid border border-white/10 rounded-xl overflow-hidden">
          {entries.length === 0 ? (
            <div className="p-6 text-sm text-parchment/40 text-center">No transactions yet. Add your first one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20">
                    <th className="text-left p-3 font-semibold text-parchment/50 text-[10px] uppercase tracking-wider">Date</th>
                    <th className="text-left p-3 font-semibold text-parchment/50 text-[10px] uppercase tracking-wider">Transaction</th>
                    <th className="text-left p-3 font-semibold text-parchment/50 text-[10px] uppercase tracking-wider">Purse</th>
                    <th className="text-right p-3 font-semibold text-parchment/50 text-[10px] uppercase tracking-wider">Amount</th>
                    <th className="text-right p-3 font-semibold text-parchment/50 text-[10px] uppercase tracking-wider">Balance</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentEntries.map(entry => {
                    const isCredit = entry.type === 'income' || entry.type === 'transfer_in'
                    return (
                      <tr key={entry.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="p-3 whitespace-nowrap text-xs text-parchment/40 font-mono">
                          {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-parchment truncate max-w-[280px]">{entry.description || entry.category}</div>
                          <div className="text-[11px] text-parchment/40 flex items-center gap-1.5 mt-0.5 min-w-0">
                            <span className="truncate">{entry.category}</span>
                            {entry.priority && ['Need', 'Want', 'Offerings', 'Savings'].includes(entry.priority) && (
                              <span className="px-1 py-px rounded text-[9px] font-bold shrink-0"
                                style={{ backgroundColor: `${SECTION_TINT[entry.priority]}22`, color: SECTION_TINT[entry.priority] }}>
                                {entry.priority}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                            style={{ backgroundColor: `${getPurseColor(entry.purse)}22`, color: getPurseColor(entry.purse) }}>
                            {getPurseIcon(entry.purse)} {entry.purse}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-mono tabular-nums whitespace-nowrap font-medium ${isCredit ? 'text-[#7fa871]' : 'text-[#cf8f78]'}`}>
                          {isCredit ? '+' : '−'}₦{entry.amount.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-parchment/80 whitespace-nowrap">
                          ₦{(balanceById.get(entry.id) ?? 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => handleDeleteEntry(entry.id)} aria-label="Delete transaction"
                            className="w-7 h-7 rounded-lg text-parchment/30 hover:text-[#cf8f78] hover:bg-ember/10 transition-colors leading-none opacity-100 lg:opacity-0 lg:group-hover:opacity-100">×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {recentEntries.length >= 30 && (
          <p className="text-xs text-parchment/40 mt-2 text-center">
            Showing latest 30 of {entriesInMonth.length} transactions in {viewMonthLabel}.
          </p>
        )}
      </div>
    </div>
  )
}