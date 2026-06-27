'use client'

import { useHierarchyStore } from '@/store/hierarchyStore'
import { Card } from '@/components/ui/Card'
import { X, Check, Calendar, ExternalLink, Plus, Trash2, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface DayModalProps {
  deedId: string
  onClose: () => void
}

interface FinancialEntry {
  id: string
  deedId: string | null
  entryDate: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category: string
  description: string | null
}

const CATEGORIES = ['Food', 'Transport', 'Utilities', 'Salary', 'Freelance', 'Shopping', 'Health', 'Education', 'Giving', 'Other']

export function DayModal({ deedId, onClose }: DayModalProps) {
  const { items, toggleDeed, completedMap } = useHierarchyStore()
  const [calendarEvents, setCalendarEvents] = useState<any[]>([])
  const [calLoading, setCalLoading] = useState(false)
  const [calError, setCalError] = useState<string | null>(null)
  const [calConnected, setCalConnected] = useState<boolean | null>(null)

  // Financial state
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([])
  const [finLoading, setFinLoading] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: 'Other',
    description: '',
    currency: 'USD',
  })
  const [addingTransaction, setAddingTransaction] = useState(false)

  // Reflection state
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [reflection, setReflection] = useState('')
  const [tomorrowTop3, setTomorrowTop3] = useState('')
  const [savingReflection, setSavingReflection] = useState(false)
  const [reflectionSaved, setReflectionSaved] = useState(false)

  // Find the specific deed
  let deed: any = null;
  const findDeed = (nodes: any[]) => {
    for (const n of nodes) {
      if (n.id === deedId) {
        deed = n;
        return;
      }
      if (n.children) findDeed(n.children)
    }
  }
  findDeed(items)

  useEffect(() => {
    if (!deed?.startDate) return

    const startOfDay = new Date(deed.startDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(deed.startDate)
    endOfDay.setHours(23, 59, 59, 999)

    setCalLoading(true)
    setCalError(null)

    fetch(`/api/calendar/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.needsAuth) {
          setCalConnected(false)
          setCalendarEvents([])
        } else {
          setCalConnected(true)
          setCalendarEvents(data.events || [])
        }
      })
      .catch(err => {
        setCalError('Failed to load calendar events')
        setCalendarEvents([])
      })
      .finally(() => setCalLoading(false))

    // Fetch financial entries for this day
    setFinLoading(true)
    fetch(`/api/financial?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.entries) setFinancialEntries(data.entries)
      })
      .catch(() => {})
      .finally(() => setFinLoading(false))
  }, [deed?.startDate])

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch('/api/calendar/auth')
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      console.error('Failed to get auth URL', err)
    }
  }

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.category) return
    setAddingTransaction(true)
    try {
      const res = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deedId,
          entryDate: deed?.startDate,
          type: newTransaction.type,
          amount: parseFloat(newTransaction.amount),
          currency: newTransaction.currency,
          category: newTransaction.category,
          description: newTransaction.description || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setFinancialEntries(prev => [data.entry, ...prev])
        setShowAddTransaction(false)
        setNewTransaction({ type: 'expense', amount: '', category: 'Other', description: '', currency: 'USD' })
      }
    } catch (err) {
      console.error('Failed to add transaction', err)
    } finally {
      setAddingTransaction(false)
    }
  }

  const handleDeleteTransaction = async (id: string) => {
    try {
      await fetch('/api/financial', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setFinancialEntries(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      console.error('Failed to delete transaction', err)
    }
  }

  const handleSaveReflection = async () => {
    setSavingReflection(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: deedId,
          periodType: 'daily',
          periodStart: deed?.startDate,
          mood,
          energy,
          reflection,
          tomorrowTop3: tomorrowTop3 ? tomorrowTop3.split('\n').filter(Boolean) : null,
        }),
      })
      if (res.ok) {
        setReflectionSaved(true)
        setTimeout(() => setReflectionSaved(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save reflection', err)
    } finally {
      setSavingReflection(false)
    }
  }

  const moodLabels = ['🙁 Low', '😐 Okay', '🙂 Good', '😄 Great']
  const moodColors = ['bg-coral/20 text-coral', 'bg-gold/20 text-gold', 'bg-sage/20 text-sage', 'bg-sage text-surface']
  const totalIncome = financialEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const totalExpense = financialEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const netTotal = totalIncome - totalExpense

  if (!deed) return null

  const isCompleted = completedMap[deed.id]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
      <div className="bg-paper w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-mist bg-surface flex items-center justify-between px-6 shrink-0">
          <div>
            <h2 className="text-xl font-display font-bold text-ink">
              {new Date(deed.startDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-mist rounded-full transition-colors text-ink/60 hover:text-ink">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-mist overflow-hidden">

          {/* Column 1: Event Timeline */}
          <div className="p-6 overflow-y-auto bg-surface/50">
            <h3 className="font-bold text-ink mb-4">Event Timeline</h3>
            <div className="space-y-4">
              {calLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-ink/40" />
                </div>
              ) : calError ? (
                <div className="text-sm text-coral text-center py-4">{calError}</div>
              ) : calConnected === false ? (
                <div className="text-center py-6 space-y-4">
                  <Calendar className="w-12 h-12 mx-auto text-gold/50" />
                  <p className="text-sm text-ink/60">Connect Google Calendar to see your events here.</p>
                  <button
                    onClick={handleConnectCalendar}
                    className="px-4 py-2 bg-gold text-surface text-sm font-semibold rounded-lg hover:bg-gold/90 transition"
                  >
                    Connect Calendar
                  </button>
                </div>
              ) : calendarEvents.length === 0 ? (
                <div className="text-sm text-ink/60 italic text-center mt-10">No events scheduled for today.</div>
              ) : (
                calendarEvents.map((event: any, idx: number) => (
                  <div key={event.id || idx} className="flex items-start space-x-3 p-3 bg-surface rounded-lg border border-mist">
                    <div className="w-2 h-2 rounded-full bg-gold mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{event.summary}</p>
                      {event.start?.dateTime && (
                        <p className="text-xs text-ink/50 mt-0.5">
                          {new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {event.end?.dateTime && ` - ${new Date(event.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-xs text-ink/60 mt-1 line-clamp-2">{event.description}</p>
                      )}
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs text-gold hover:underline mt-1"
                        >
                          Open in Calendar <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Deed Checklist */}
          <div className="p-6 overflow-y-auto">
            <h3 className="font-bold text-ink mb-4">Daily Deeds</h3>
            <Card className="p-4 hover:border-gold cursor-pointer transition-colors" onClick={() => toggleDeed(deed.id, !isCompleted)}>
              <div className="flex items-center space-x-4">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${isCompleted ? 'bg-sage border-sage text-surface' : 'border-mist'}`}>
                  {isCompleted && <Check className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${isCompleted ? 'line-through text-ink/50' : 'text-ink'}`}>{deed.title}</p>
                  {deed.category && <p className="text-xs text-ink/50 mt-1">{deed.category}</p>}
                </div>
              </div>
            </Card>
          </div>

          {/* Column 3: Reflection & Finances */}
          <div className="p-6 overflow-y-auto bg-surface/50 space-y-8">
            <div>
              <h3 className="font-bold text-ink mb-4">Financial Log</h3>
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-sage/10 rounded p-2 text-sage">
                  <div className="text-xs">Income</div>
                  <div className="font-mono font-bold">${totalIncome.toFixed(2)}</div>
                </div>
                <div className="bg-coral/10 rounded p-2 text-coral">
                  <div className="text-xs">Expense</div>
                  <div className="font-mono font-bold">${totalExpense.toFixed(2)}</div>
                </div>
                <div className={`rounded p-2 ${netTotal >= 0 ? 'bg-sage/10 text-sage' : 'bg-coral/10 text-coral'}`}>
                  <div className="text-xs">Net</div>
                  <div className="font-mono font-bold">${netTotal.toFixed(2)}</div>
                </div>
              </div>

              {finLoading ? (
                <div className="text-xs text-ink/50 text-center py-2">Loading...</div>
              ) : financialEntries.length > 0 && (
                <div className="space-y-1 mb-3 max-h-28 overflow-y-auto">
                  {financialEntries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between text-xs py-1 px-2 bg-surface rounded border border-mist">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-sage' : 'bg-coral'}`} />
                        <span className="text-ink/70 truncate">{entry.category}</span>
                        {entry.description && <span className="text-ink/40 truncate">· {entry.description}</span>}
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className={`font-mono font-bold ${entry.type === 'income' ? 'text-sage' : 'text-coral'}`}>
                          {entry.type === 'income' ? '+' : '-'}${entry.amount.toFixed(2)}
                        </span>
                        <button onClick={() => handleDeleteTransaction(entry.id)} className="text-ink/30 hover:text-coral transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {showAddTransaction && (
                <div className="space-y-3 border border-mist rounded-lg p-3 bg-surface">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setNewTransaction(prev => ({ ...prev, type: 'expense' }))}
                      className={`flex-1 py-1.5 text-xs font-bold rounded ${newTransaction.type === 'expense' ? 'bg-coral/20 text-coral' : 'bg-mist/50 text-ink/50'}`}
                    >
                      Expense
                    </button>
                    <button
                      onClick={() => setNewTransaction(prev => ({ ...prev, type: 'income' }))}
                      className={`flex-1 py-1.5 text-xs font-bold rounded ${newTransaction.type === 'income' ? 'bg-sage/20 text-sage' : 'bg-mist/50 text-ink/50'}`}
                    >
                      Income
                    </button>
                  </div>
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-ink/50 block mb-0.5">Amount</label>
                      <input
                        type="number" step="0.01" value={newTransaction.amount}
                        onChange={e => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full rounded border border-mist p-1.5 text-xs bg-paper" placeholder="0.00"
                      />
                    </div>
                    <div className="w-16">
                      <label className="text-[10px] font-bold text-ink/50 block mb-0.5">Currency</label>
                      <select
                        value={newTransaction.currency}
                        onChange={e => setNewTransaction(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full rounded border border-mist p-1.5 text-xs bg-paper"
                      >
                        <option value="USD">$</option>
                        <option value="NGN">₦</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-ink/50 block mb-0.5">Category</label>
                      <select
                        value={newTransaction.category}
                        onChange={e => setNewTransaction(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full rounded border border-mist p-1.5 text-xs bg-paper"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <input
                    type="text" value={newTransaction.description}
                    onChange={e => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded border border-mist p-1.5 text-xs bg-paper" placeholder="Description (optional)"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddTransaction}
                      disabled={addingTransaction || !newTransaction.amount}
                      className="flex-1 py-1.5 text-xs bg-ink text-surface rounded font-medium hover:bg-ink/90 disabled:opacity-50"
                    >
                      {addingTransaction ? 'Adding...' : 'Add'}
                    </button>
                    <button onClick={() => setShowAddTransaction(false)} className="py-1.5 text-xs text-ink/60 hover:text-ink">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!showAddTransaction && (
                <button
                  onClick={() => setShowAddTransaction(true)}
                  className="w-full py-2 text-sm border border-mist rounded-lg hover:bg-mist transition flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Transaction</span>
                </button>
              )}
            </div>

            <div className="border-t border-mist pt-6">
              <h3 className="font-bold text-ink mb-4">Daily Reflection</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-ink/70 mb-1 block">Mood</label>
                  <div className="flex justify-between gap-2">
                    {moodLabels.map((label, idx) => (
                      <button
                        key={label}
                        onClick={() => setMood(idx + 1)}
                        className={`flex-1 py-2 text-sm border rounded transition-all ${
                          mood === idx + 1
                            ? `${moodColors[idx]} border-transparent font-bold`
                            : 'border-mist hover:bg-mist text-ink/70'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-ink/70 mb-1 block">Energy (0-10)</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range" min="0" max="10"
                      value={energy ?? 5}
                      onChange={e => setEnergy(parseInt(e.target.value))}
                      className="flex-1 accent-gold"
                    />
                    <span className="text-sm font-mono font-bold text-ink/70 w-6 text-center">{energy ?? 5}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-ink/70 mb-1 block">Notes</label>
                  <textarea
                    value={reflection}
                    onChange={e => setReflection(e.target.value)}
                    className="w-full rounded border border-mist p-2 text-sm bg-paper h-24 resize-none"
                    placeholder="How did today go?"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink/70 mb-1 block">Tomorrow's Top 3 (one per line)</label>
                  <textarea
                    value={tomorrowTop3}
                    onChange={e => setTomorrowTop3(e.target.value)}
                    className="w-full rounded border border-mist p-2 text-sm bg-paper h-20 resize-none"
                    placeholder="1.&#10;2.&#10;3."
                  />
                </div>
                <button
                  onClick={handleSaveReflection}
                  disabled={savingReflection}
                  className={`w-full py-2 rounded-lg font-medium transition ${
                    reflectionSaved
                      ? 'bg-sage text-surface'
                      : 'bg-ink text-surface hover:bg-ink/90'
                  }`}
                >
                  {savingReflection ? 'Saving...' : reflectionSaved ? 'Saved!' : 'Save Reflection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
