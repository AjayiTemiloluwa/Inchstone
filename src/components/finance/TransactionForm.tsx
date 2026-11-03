'use client'

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { format } from 'date-fns'
import { SECTION_CATEGORIES, INCOME_CATEGORIES, BudgetCategoryOption } from './budgetCategories'
import { CategorySelect } from './CategorySelect'
import type { CustomCategoryScope } from './customCategories'
import { useCountdown } from '@/lib/useCountdown'
import { RotateCcw } from 'lucide-react'
import { Button, Field, Panel, Segmented, cx, inputClass } from '@/components/ds'
import { Notice, labelClass } from './ui'
import { newRequestId } from './money'

const SECTION_OPTIONS: { value: CustomCategoryScope; label: string }[] = [
  { value: 'Need', label: 'Need' },
  { value: 'Want', label: 'Want' },
  { value: 'Offerings', label: 'Offerings' },
  { value: 'Savings', label: 'Savings' },
]

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

/** No-op subscription — lets useSyncExternalStore expose a client-only flag. */
const noopSubscribe = () => () => {}

export function TransactionForm({ onSuccess, purses: externalPurses }: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  // One id per logical entry, reused if the same submit is retried, so a double tap or a flaky network can never record it twice.
  const requestIdRef = useRef(newRequestId())
  const [amount, setAmount] = useState('')
  const [lastExpensePurse, setLastExpensePurse] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [comments, setComments] = useState('')
  // '' means "follow today": the date field then tracks the live calendar day
  // until the user picks a day of their own. Keeping that in one piece of state
  // means no setState-in-effect dance to hold a "today" default in sync.
  const [userDate, setUserDate] = useState('')
  const [section, setSection] = useState<CustomCategoryScope>('Need')
  const [purse, setPurse] = useState('')
  // Derived: externally supplied purses win; otherwise the fetched fallback.
  // No setState needed during render or effect.
  const [fetchedPurses, setFetchedPurses] = useState<Purse[]>([])
  const purses = externalPurses && externalPurses.length > 0 ? externalPurses : fetchedPurses
  const effectivePurse = purse || purses[0]?.name || ''

  // The live local day (yyyy-MM-dd). A minute is plenty for a date field, and
  // `respectReducedMotion: false` keeps it truthful for users who asked for
  // calm — a frozen ticker would pin the wrong day. "Now" comes from the shared
  // ticker, never a private setInterval (LIVING_APP_STYLE_GUIDE §1).
  const now = useCountdown(60_000, { respectReducedMotion: false })
  // SSR runs in the server's timezone, which can be a different calendar day
  // than the visitor's, so the real day only lands after hydration — the server
  // render never claims a date (the same guard the dashboard clock uses).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const today = mounted ? format(now, 'yyyy-MM-dd') : ''
  // The day this entry belongs to: today, unless the user chose otherwise.
  const entryDate = userDate || today
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch purses only when none were passed in.
  useEffect(() => {
    if (externalPurses && externalPurses.length > 0) return
    fetch('/api/purses')
      .then(r => r.json())
      .then(data => {
        if (data.purses?.length > 0) setFetchedPurses(data.purses)
      })
      .catch(() => { })
  }, [externalPurses])

  const categorySuggestions: BudgetCategoryOption[] = type === 'expense'
    ? (SECTION_CATEGORIES[section] || [])
    : INCOME_CATEGORIES

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category.trim()) {
      setError('Pick a category — or use "Others…" to type your own.')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount, // sent as typed: the server parses it strictly (commas ok, more than 2 decimals refused)
          category,
          description,
          comments,
          entryDate,
          priority: type === 'expense' ? section : null,
          purse: effectivePurse,
          requestId: requestIdRef.current,
        })
      })

      let data
      try {
        data = await res.json()
      } catch {
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
        requestIdRef.current = newRequestId() // that entry is saved; the next one gets a fresh id
        setAmount('')
        setCategory('')
        setDescription('')
        setComments('')
        setUserDate('') // ready for the next entry — back to today
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
    <Panel>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">Transaction added successfully!</Notice>}

        {/* Type toggle */}
        <Segmented
          ariaLabel="Transaction type"
          value={type}
          onChange={(next) => {
            if (next === 'expense') {
              setType('expense')
              // Restore the previously selected expense purse if any
              if (lastExpensePurse) setPurse(lastExpensePurse)
            } else {
              // Remember the current purse before forcing Main
              if (purse && purse !== 'Main') setLastExpensePurse(purse)
              setType('income')
              setPurse('Main')
            }
          }}
          options={[
            { value: 'expense', label: 'Expense (debit)' },
            { value: 'income', label: 'Income (credit)' },
          ]}
          className="w-full border-b border-gold/15"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Date — today by default and follows the calendar as the day rolls
              over, until you pick a day of your own. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex min-h-[15px] items-center justify-between gap-2">
              <label htmlFor="tx-date" className={labelClass}>Date</label>
              {/* Only after hydration — the server has no idea what "today" means
                  for this visitor, so rendering it during SSR would just flash. */}
              {mounted && (userDate === '' ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/35">today</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setUserDate('')}
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-gold transition-colors hover:text-gold-glow"
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> Back to today
                </button>
              ))}
            </div>
            <input
              id="tx-date"
              type="date"
              value={entryDate}
              onChange={(e) => {
                const next = e.target.value
                // Choosing today again re-arms "follow the day", so the field keeps
                // tracking the calendar instead of freezing on a date that merely
                // happens to be today. Clearing the field falls back to today too.
                setUserDate(next === today ? '' : next)
              }}
              required
              className={inputClass}
            />
          </div>

          <Field label="Amount">
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-parchment/40">₦</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className={cx(inputClass, 'pl-7 font-mono tabular-nums')}
                placeholder="0.00"
              />
            </div>
          </Field>
        </div>

        {/* Section selector for expenses */}
        {type === 'expense' && (
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Section (budget category)</span>
            <Segmented
              ariaLabel="Section"
              value={section}
              onChange={(next) => setSection(next as CustomCategoryScope)}
              options={SECTION_OPTIONS}
              className="w-full border-b border-gold/15"
            />
          </div>
        )}

        {/* Category — the standard dropdown, with "Others…" for custom names */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-category" className={labelClass}>Category</label>
          <CategorySelect
            id="tx-category"
            scope={type === 'expense' ? section : 'Income'}
            value={category}
            onChange={setCategory}
            options={categorySuggestions}
            placeholder={type === 'expense' ? 'e.g. Groceries, Rent, Tithe…' : 'e.g. Salary, Freelance…'}
          />
        </div>

        <Field label="Description">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="What was this for?"
          />
        </Field>

        <Field label="Comments (optional)">
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            className={cx(inputClass, 'resize-none py-2.5')}
            placeholder="Any notes about this transaction..."
          />
        </Field>

        <Field
          label={<>Purse {type === 'income' && <span className="normal-case tracking-normal text-parchment/40">(income always goes to Main)</span>}</>}
          hint={type === 'income' ? 'All income is deposited into the Main purse. Use transfers to move funds to other purses.' : undefined}
        >
          <select
            value={effectivePurse}
            onChange={(e) => setPurse(e.target.value)}
            disabled={type === 'income'}
            className={cx(inputClass, type === 'income' && 'cursor-not-allowed opacity-60')}
          >
            {purses.map(p => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          data-cursor="Log it in the purse"
          className="w-full"
        >
          {loading ? 'Adding...' : `Add to ${effectivePurse || 'Purse'}`}
        </Button>
      </form>
    </Panel>
  )
}
