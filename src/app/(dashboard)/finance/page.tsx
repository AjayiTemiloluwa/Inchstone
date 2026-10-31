'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { TransactionForm } from '@/components/finance/TransactionForm'
import { BudgetProgress } from '@/components/finance/BudgetProgress'
import { SectionBudgetCard } from '@/components/finance/SectionBudgetCard'
import { ProgressBar, PurseMark, RowAction, labelClass } from '@/components/finance/ui'
import { CountUp } from '@/components/ui/motion'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Page,
  PageHeader,
  Panel,
  Section as PageSection,
  Stat,
  StatGrid,
  cx,
  inputClass,
} from '@/components/ds'

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
  sourcePurse: string
  purse: string
}

interface Purse {
  id: string
  name: string
  icon: string
  color: string
}

// Stored with each purse (the API keeps an icon and a color). The page shows
// purses neutrally; these stay as the user's opt-in choices in the add form.
const PURSE_ICONS = ['👜', '🏦', '💰', '💳', '🐷', '🏪', '📦', '🎯', '⭐', '💎', '🌴', '🚗', '🏠', '📚', '✈️', '🎓']

const PURSE_COLORS = [
  '#8a6d42', '#b8935a', '#4a5d45', '#7fa871',
  '#7a3b2e', '#cf8f78', '#5c6b8a', '#6b5c7a',
  '#7a6f5c', '#3f5a5a', '#6b7a4a', '#8a6a4a',
  '#9a8f7a', '#4a5a6b', '#5a4a3f', '#7a6a8a',
]

function SectionTag({ priority }: { priority: string | null }) {
  if (!priority || !(SECTION_KEYS as readonly string[]).includes(priority)) return null
  return <Badge>{priority}</Badge>
}

/** Ledger figures: mono, sized to hold long naira amounts inside a 2x2 phone grid. */
function Figure({ children }: { children: React.ReactNode }) {
  return <span className="block break-all font-mono text-heading">{children}</span>
}

const formatNaira = (n: number) => `₦${n.toFixed(2)}`

export default function FinancePage() {
  const { showToast, confirm } = useToast()
  const [entries, setEntries] = useState<Entry[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [purses, setPurses] = useState<Purse[]>([])
  const [purseBalances, setPurseBalances] = useState<Record<string, number>>({})
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)
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
  const loading = refreshing || loadedMonth !== viewMonth
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
    const timer = setTimeout(() => {
      const stored = localStorage.getItem('monthlySavingsTarget')
      if (stored) setSavingsTarget(parseFloat(stored))
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const loadData = useCallback(async () => {

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
      setRefreshing(false)
      setLoadedMonth(viewMonth)
    }
  }, [viewMonth])

  const fetchData = useCallback(() => {
    setRefreshing(true)
    return loadData()
  }, [loadData])

  useEffect(() => {
    const timer = setTimeout(() => { void loadData() }, 0)
    return () => clearTimeout(timer)
  }, [loadData])

  // Handle section allocation — this moves real money between purses, so the
  // server's answer matters (insufficient funds, same purse both ends) and is
  // handed back to the card to show inline.
  const handleAllocateToSection = async (
    section: Section,
    amount: number,
    sourcePurse: string,
    purse: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, amount, month: viewMonth, sourcePurse, purse })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: data.error || `Could not set the plan (${res.status}).` }
      }
      fetchData()
      return { ok: true }
    } catch (err) {
      console.error('Allocate failed:', err)
      return { ok: false, error: 'Network error. Please try again.' }
    }
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
    if (!(await confirm('Delete this budget category?'))) return
    await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    fetchData()
  }

  const handleDeleteEntry = async (id: string) => {
    if (!(await confirm('Are you sure you want to delete this transaction?'))) return
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
        showToast(data.error || 'Transfer failed', 'error')
      }
    } catch (err) {
      console.error('Transfer failed:', err)
      showToast('Transfer failed. Please try again.', 'error')
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
        showToast(data.error || 'Failed to create purse', 'error')
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
        showToast(data.error || 'Failed to delete purse', 'error')
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
  const allocationBySection: Record<string, Allocation | undefined> = {}
  allocations.forEach(a => {
    sectionAllocations[a.section] = a.amount
    allocationBySection[a.section] = a
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

  if (loading) {
    return <Loader label="Counting your coins…" routeKey="finance" />
  }

  const totalSectionSpent = Object.values(sectionSpending).reduce((s: number, v: number) => s + v, 0)

  const monthStepper = (
    <div className="flex items-center gap-1">
      <IconButton icon={ChevronLeft} label="Previous month" onClick={() => shiftMonth(-1)} />
      <span className="min-w-[8.5rem] text-center font-mono text-mono tabular-nums text-parchment/80">
        {viewMonthLabel}
      </span>
      <IconButton icon={ChevronRight} label="Next month" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} />
      {!isCurrentMonth && (
        <Button size="sm" variant="ghost" onClick={() => setViewMonth(nowKey)} data-cursor="Back to now" className="text-gold">
          Today
        </Button>
      )}
    </div>
  )

  return (
    <Page width="wide">
      <PageHeader
        eyebrow={<>Ledger · <span className="tabular-nums">{entries.length}</span> entries</>}
        title="Every sum, accounted for."
        description={`Income, expenses & savings — ${viewMonthLabel}`}
        actions={monthStepper}
      />

      {/* ── Summary: Income / Expenses / Net / Offerings, then the savings goal ── */}
      <PageSection id="finance-summary" title="Summary">
        <div className="space-y-3 sm:space-y-4">
          <StatGrid>
            <Stat label="Income" tone="moss" value={<Figure><CountUp value={totalIncome} format={formatNaira} /></Figure>} />
            <Stat label="Expenses" tone="ember" value={<Figure><CountUp value={totalExpense} format={formatNaira} /></Figure>} />
            <Stat label="Net" tone={currentSavings >= 0 ? 'gold' : 'ember'} value={<Figure><CountUp value={currentSavings} format={formatNaira} /></Figure>} />
            <Stat label="Offerings" value={<Figure><CountUp value={sectionSpending.Offerings || 0} format={formatNaira} /></Figure>} caption={`Given in ${viewMonthLabel}`} />
          </StatGrid>

          <Panel className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className={labelClass}>Monthly savings goal</p>
              <Button size="sm" variant="ghost" className="text-gold" onClick={() => { setEditSavings(!editSavings); setSavingsInput(savingsTarget.toString()) }}>
                {editSavings ? 'Cancel' : savingsTarget > 0 ? 'Edit' : 'Set'}
              </Button>
            </div>
            {editSavings ? (
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-parchment/40">₦</span>
                  <input type="number" step="0.01" value={savingsInput} onChange={(e) => setSavingsInput(e.target.value)}
                    aria-label="Monthly savings target"
                    className={cx(inputClass, 'pl-7 font-mono tabular-nums')} placeholder="500" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveSavingsTarget()} />
                </div>
                <Button variant="secondary" onClick={handleSaveSavingsTarget} className="shrink-0">Save</Button>
              </div>
            ) : savingsTarget > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-mono text-heading tabular-nums text-parchment">
                    ₦{Math.max(currentSavings, 0).toFixed(0)} <span className="text-mono text-parchment/45">/ ₦{savingsTarget.toFixed(0)}</span>
                  </p>
                  {savingsProgress >= 100 && <Badge tone="moss">Goal reached</Badge>}
                </div>
                <ProgressBar value={savingsProgress} min={2} tone={savingsProgress >= 100 ? 'bg-moss' : 'bg-gold'} label="Savings goal progress" />
              </div>
            ) : (
              <p className="text-caption text-parchment/50">Tap Set to add a monthly target.</p>
            )}
          </Panel>
        </div>
      </PageSection>

      {/* ── Purses + transfers between them ── */}
      <PageSection
        id="finance-purses"
        title="Purses"
        action={
          <>
            <Button size="sm" variant="ghost" icon={ArrowLeftRight} onClick={() => setShowTransfer(!showTransfer)} data-cursor="Move money between purses" aria-expanded={showTransfer}>
              {showTransfer ? 'Cancel' : 'Transfer'}
            </Button>
            <Button size="sm" variant="ghost" icon={showAddPurse ? undefined : Plus} onClick={() => setShowAddPurse(!showAddPurse)} data-cursor="Make a new purse" aria-expanded={showAddPurse}>
              {showAddPurse ? 'Cancel' : 'Add purse'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Add purse form */}
          {showAddPurse && (
            <Panel className="animate-fadeIn">
              <form onSubmit={handleAddPurse} className="space-y-5">
                <Field label="Purse name">
                  <input
                    type="text"
                    value={newPurseName}
                    onChange={(e) => setNewPurseName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="e.g. Emergency Fund, Travel, Business..."
                  />
                </Field>
                <fieldset className="space-y-2">
                  <legend className={labelClass}>Icon</legend>
                  <div className="flex flex-wrap gap-2">
                    {PURSE_ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setNewPurseIcon(icon)}
                        aria-pressed={newPurseIcon === icon}
                        className={cx(
                          'grid h-11 w-11 place-items-center rounded-lg border text-lg transition-colors pointer-fine:h-9 pointer-fine:w-9',
                          newPurseIcon === icon ? 'border-gold/60 bg-gold/[0.1]' : 'border-gold/15 hover:border-gold/35',
                        )}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className={labelClass}>Color</legend>
                  <div className="flex flex-wrap gap-2">
                    {PURSE_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewPurseColor(color)}
                        aria-label={`Color ${color}`}
                        aria-pressed={newPurseColor === color}
                        className={cx(
                          'h-11 w-11 rounded-full border-2 transition-colors pointer-fine:h-8 pointer-fine:w-8',
                          newPurseColor === color ? 'border-parchment' : 'border-transparent',
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </fieldset>
                <Button type="submit" variant="primary" disabled={addPurseLoading} className="w-full sm:w-auto">
                  {addPurseLoading ? 'Creating...' : 'Create purse'}
                </Button>
              </form>
            </Panel>
          )}

          {/* Transfer form */}
          {showTransfer && (
            <Panel className="animate-fadeIn">
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <Field label="From">
                    <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} className={inputClass}>
                      {purses.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} (₦{(purseBalances[p.name] || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <span aria-hidden="true" className="hidden h-11 items-center text-parchment/40 sm:flex">→</span>
                  <Field label="To">
                    <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className={inputClass}>
                      {purses.filter(p => p.name !== transferFrom).map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} (₦{(purseBalances[p.name] || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Amount">
                    <div className="relative">
                      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-parchment/40">₦</span>
                      <input
                        type="number"
                        step="0.01"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        required
                        className={cx(inputClass, 'pl-7 font-mono tabular-nums')}
                        placeholder="0.00"
                      />
                    </div>
                  </Field>
                  <Field label="Note (optional)">
                    <input
                      type="text"
                      value={transferDesc}
                      onChange={(e) => setTransferDesc(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Building savings"
                    />
                  </Field>
                </div>
                <Button type="submit" variant="primary" disabled={transferLoading || transferFrom === transferTo} className="w-full sm:w-auto">
                  {transferLoading ? 'Transferring...' : `Transfer ${transferFrom} → ${transferTo}`}
                </Button>
              </form>
            </Panel>
          )}

          {/* Purse balances */}
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {purses.map(purse => {
              const balance = purseBalances[purse.name] || 0
              return (
                <li key={purse.id} className="min-w-0">
                  <Panel className="group relative flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <PurseMark name={purse.name} color={purse.color} />
                      {purses.length > 1 && (
                        <RowAction
                          icon={Trash2}
                          label={`Delete ${purse.name}`}
                          className="-mr-2 -mt-2"
                          onClick={() => setDeleteConfirm(deleteConfirm === purse.id ? null : purse.id)}
                        />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className={cx(labelClass, 'truncate')}>{purse.name}</p>
                      <p className="break-all font-mono text-heading tabular-nums text-parchment">₦{balance.toFixed(2)}</p>
                    </div>

                    {/* Delete confirmation */}
                    {deleteConfirm === purse.id && (
                      <div role="alertdialog" aria-label={`Delete ${purse.name}`} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-ember/40 bg-surface-solid p-3 text-center animate-fadeIn">
                        <p className="text-caption !text-parchment/80">Delete &quot;{purse.name}&quot;?<br />Entries will move to another purse.</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button size="sm" variant="danger" onClick={() => handleDeletePurse(purse.id)}>Delete</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </Panel>
                </li>
              )
            })}
          </ul>
        </div>
      </PageSection>

      {/* ── Section budgets (Need, Want, Offerings, Savings) ── */}
      <PageSection
        id="finance-sections"
        title="Budget by sections"
        action={
          <span className="font-mono text-mono tabular-nums text-parchment/45">
            Allocated {totalAllocated.toFixed(0)} · Spent {totalSectionSpent.toFixed(0)}
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
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
              purses={purses}
              allocation={allocationBySection[section]}
              onAllocate={(amount, sourcePurse, purse) => handleAllocateToSection(section, amount, sourcePurse, purse)}
              onAddBudget={(category, amount) => handleAddBudgetCategory(section, category, amount)}
              onDeleteBudget={handleDeleteBudget}
              onDeleteEntry={handleDeleteEntry}
            />
          ))}
        </div>
      </PageSection>

      {/* ── Record a transaction + every budget line at a glance ── */}
      <div className="grid grid-cols-1 items-start gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-6">
        <PageSection id="finance-add" title="Add transaction">
          <TransactionForm onSuccess={fetchData} purses={purses} />
        </PageSection>

        <PageSection id="finance-budgets" title="All budgets">
          {budgets.length === 0 ? (
            <EmptyState
              title={`No budgets set for ${viewMonthLabel}.`}
              body="Use the section cards above to give each part of your plan a job."
            />
          ) : (
            <Panel className="py-1 sm:py-2">
              <ul className="divide-y divide-gold/10">
                {budgets.map(budget => (
                  <li key={budget.id}>
                    <BudgetProgress
                      category={`${budget.section} › ${budget.category}`}
                      budgeted={budget.amount}
                      spent={categorySpending[budget.category] || 0}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </PageSection>
      </div>

      {/* ── Ledger ── */}
      <PageSection
        id="finance-ledger"
        title="Ledger"
        action={<span className="font-mono text-mono tabular-nums text-parchment/45">{entries.length} transactions · newest first</span>}
      >
        {entries.length === 0 ? (
          <EmptyState title="No transactions yet." body="Add your first one above." />
        ) : (
          <Panel padded={false}>
            {/* Phones and tablets: two-line row cards */}
            <ul className="divide-y divide-gold/10 lg:hidden">
              {recentEntries.map(entry => {
                const credit = entry.type === 'income' || entry.type === 'transfer_in'
                return (
                  <li key={entry.id} className="group flex items-center gap-2 py-3 pl-4 pr-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-body text-parchment">{entry.description || entry.category}</p>
                        <p className={cx('shrink-0 font-mono text-body tabular-nums', credit ? 'text-moss' : 'text-ember')}>
                          {credit ? '+' : '−'}₦{entry.amount.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums text-parchment/45">
                        <p className="min-w-0 truncate">
                          {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {entry.category} · {entry.purse}
                          {entry.priority && (SECTION_KEYS as readonly string[]).includes(entry.priority) && <> · {entry.priority}</>}
                        </p>
                        <p className="shrink-0">Bal ₦{(balanceById.get(entry.id) ?? 0).toFixed(2)}</p>
                      </div>
                    </div>
                    <RowAction icon={Trash2} label="Delete transaction" onClick={() => handleDeleteEntry(entry.id)} />
                  </li>
                )
              })}
            </ul>

            {/* lg and up: table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/15">
                    <th scope="col" className={cx(labelClass, 'px-4 py-3 text-left font-normal')}>Date</th>
                    <th scope="col" className={cx(labelClass, 'px-4 py-3 text-left font-normal')}>Transaction</th>
                    <th scope="col" className={cx(labelClass, 'px-4 py-3 text-left font-normal')}>Purse</th>
                    <th scope="col" className={cx(labelClass, 'px-4 py-3 text-right font-normal')}>Amount</th>
                    <th scope="col" className={cx(labelClass, 'px-4 py-3 text-right font-normal')}>Balance</th>
                    <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {recentEntries.map(entry => {
                    const isCredit = entry.type === 'income' || entry.type === 'transfer_in'
                    return (
                      <tr key={entry.id} className="group transition-colors hover:bg-gold/[0.03]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-mono tabular-nums text-parchment/45">
                          {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[16rem] truncate text-parchment xl:max-w-[20rem]">{entry.description || entry.category}</div>
                          <div className="mt-1 flex min-w-0 items-center gap-2 text-caption text-parchment/45">
                            <span className="truncate">{entry.category}</span>
                            <SectionTag priority={entry.priority} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-parchment/70">
                            <PurseMark name={entry.purse} size="sm" />
                            {entry.purse}
                          </span>
                        </td>
                        <td className={cx('whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums', isCredit ? 'text-moss' : 'text-ember')}>
                          {isCredit ? '+' : '−'}₦{entry.amount.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-parchment/75">
                          ₦{(balanceById.get(entry.id) ?? 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <RowAction icon={Trash2} label="Delete transaction" onClick={() => handleDeleteEntry(entry.id)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        {recentEntries.length >= 30 && (
          <p className="mt-3 text-center text-caption text-parchment/45">
            Showing latest 30 of {entriesInMonth.length} transactions in {viewMonthLabel}.
          </p>
        )}
      </PageSection>
    </Page>
  )
}
