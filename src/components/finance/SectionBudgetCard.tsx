'use client'

import React, { useState } from 'react'
import { BudgetProgress } from './BudgetProgress'
import { SECTION_CATEGORIES, BudgetCategoryOption } from './budgetCategories'
import { CategorySelect } from './CategorySelect'
import { Plus, Trash2, X } from 'lucide-react'
import { Button, Panel, RowActions, cx, inputClass } from '@/components/ds'
import { Notice, ProgressBar, RowAction, SECTION_TONE, labelClass } from './ui'

interface Purse {
    id: string
    name: string
    icon: string
    color: string
}

/** Minimal shape this card reads from an expense record. */
interface BudgetEntry {
    id: string
    entryDate: string
    amount: number
    category: string
    description?: string | null
    /** Optional classification used to bucket the entry under a section. */
    priority?: string | null
    section?: string | null
}

/** Minimal shape this card reads from a saved budget row. */
interface BudgetRow {
    id: string
    category: string
    amount: number
}

interface SectionBudgetCardProps {
    section: 'Need' | 'Want' | 'Offerings' | 'Savings'
    totalAllocated: number
    totalSpent: number
    budgets: BudgetRow[]
    categorySpending: Record<string, number>
    entries: BudgetEntry[]
    currentMonth: string
    purses?: Purse[]
    /** This month's saved plan, so the card can show which purses fund it. */
    allocation?: { amount: number; sourcePurse: string; purse: string } | null
    onAllocate: (amount: number, sourcePurse: string, purse: string) => Promise<{ ok: boolean; error?: string }>
    onAddBudget: (category: string, amount: number) => void
    onDeleteBudget: (id: string) => void
    onDeleteEntry: (id: string) => void
    onAddTransaction?: (entry: { type: string; amount: number; category: string; description: string; purse: string; priority: string }) => Promise<boolean>
}

/* One quiet tag + line per section; color comes from SECTION_TONE tokens. */
const sectionConfig = {
    Need: { tag: 'Foundation', description: 'Essentials you cannot skip' },
    Want: { tag: 'Delight', description: 'Lifestyle and small joys' },
    Offerings: { tag: 'Giving', description: 'Tithes, gifts and charity' },
    Savings: { tag: 'Future', description: 'Reserves and long-term goals' },
}

const defaultBudgetAmounts: Record<string, number> = {
    'Food / Groceries': 400, 'Transport / Gas': 150, 'Rent / Mortgage': 1200,
    'Utilities (Electric, Water, Internet)': 200, 'Healthcare / Insurance': 150,
    'Clothing / Apparel': 80, 'Debt Payments': 300, 'Education / Tuition': 100,
    'Entertainment (Movies, Games)': 50, 'Dining Out / Restaurants': 100,
    'Travel / Vacation': 200, 'Shopping / Hobbies': 80,
    'Subscriptions (Spotify, Netflix)': 30, 'Gym / Fitness': 40,
    'Gadgets / Electronics': 100, 'Gifts / Celebrations': 60,
    'Tithe (10%)': 0, 'Church Offerings': 100, 'Charity / Giving': 50,
    'Missions / Outreach': 50, 'Support Family': 200, 'Ministry / Fellowship': 30,
    'Emergency Fund': 500, 'Retirement / 401k': 500, 'Investment Portfolio': 300,
    'Education Fund': 200,
}

export function SectionBudgetCard({
    section,
    totalAllocated,
    totalSpent,
    budgets,
    categorySpending,
    entries,
    purses: externalPurses,
    allocation,
    onAllocate,
    onAddBudget,
    onDeleteBudget,
    onDeleteEntry,
    onAddTransaction,
}: SectionBudgetCardProps) {
    const config = sectionConfig[section]
    const tone = SECTION_TONE[section]
    const [showAllocate, setShowAllocate] = useState(false)
    const [allocateAmount, setAllocateAmount] = useState('')
    // Empty means "use the derived default", so the purse list can arrive a beat
    // late without a setState-in-effect to seed these.
    const [allocateFrom, setAllocateFrom] = useState('')
    const [allocateTo, setAllocateTo] = useState('')
    const [allocateError, setAllocateError] = useState<string | null>(null)
    const [allocateLoading, setAllocateLoading] = useState(false)
    const [showAddCategory, setShowAddCategory] = useState(false)
    const [newCategory, setNewCategory] = useState('')
    const [newBudgetAmount, setNewBudgetAmount] = useState('')
    const [showExpenses, setShowExpenses] = useState(false)
    const [quickAddCategory, setQuickAddCategory] = useState<string | null>(null)
    const [quickAddAmount, setQuickAddAmount] = useState('')
    const [quickAddDesc, setQuickAddDesc] = useState('')
    const [quickAddPurse, setQuickAddPurse] = useState('')
    const [quickAddLoading, setQuickAddLoading] = useState(false)
    // Derived: externally supplied purses win; otherwise fall back to the
    // once-fetched list. No setState needed during render or effect.
    const [fetchedPurses, setFetchedPurses] = useState<Purse[]>([])
    const purses = externalPurses && externalPurses.length > 0 ? externalPurses : fetchedPurses

    const remaining = totalAllocated - totalSpent
    const isOver = remaining < 0
    const percentage = totalAllocated > 0 ? Math.min((totalSpent / totalAllocated) * 100, 100) : 0
    const sectionEntries = entries.filter(e => e.priority === section || e.section === section)
    const budgetedCategoryLabels = new Set(budgets.map(b => b.category))
    const suggestedUnused: BudgetCategoryOption[] = (SECTION_CATEGORIES[section] || []).filter(
        cat => !budgetedCategoryLabels.has(cat.label)
    )

    // An allocation is a real move between two purses, so it needs somewhere to
    // land: Main is the natural source, and the section's namesake purse
    // (Savings → the Savings purse) the natural destination.
    const purseNames = purses.map(p => p.name)
    const defaultSource = purseNames.includes('Main') ? 'Main' : purseNames[0] ?? ''
    const defaultDest =
        purseNames.find(n => n === section && n !== defaultSource) ??
        purseNames.find(n => n !== defaultSource) ??
        ''
    const fromPurse = allocateFrom || defaultSource
    const toPurse = allocateTo || defaultDest
    const canMoveMoney = purseNames.length >= 2

    // Load purses once per mount when none were passed in. All state updates
    // happen in async callbacks (never synchronously inside the effect).
    React.useEffect(() => {
        if (externalPurses && externalPurses.length > 0) return
        fetch('/api/purses')
            .then(r => r.json())
            .then(data => {
                if (data.purses?.length > 0) {
                    setFetchedPurses(data.purses)
                    setQuickAddPurse(prev => prev || data.purses[0].name)
                }
            })
            .catch(() => { })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const closePanels = () => { setShowAllocate(false); setShowAddCategory(false); setShowExpenses(false); setQuickAddCategory(null) }
    const togglePanel = (panel: 'allocate' | 'category' | 'expenses') => {
        const open = panel === 'allocate' ? showAllocate : panel === 'category' ? showAddCategory : showExpenses
        if (open) { closePanels(); return }
        setShowAllocate(panel === 'allocate')
        setShowAddCategory(panel === 'category')
        setShowExpenses(panel === 'expenses')
        setQuickAddCategory(null)
        if (panel === 'allocate') setAllocateError(null)
    }

    const handleAllocate = async (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(allocateAmount)
        if (isNaN(val) || val <= 0) return
        if (fromPurse === toPurse) {
            setAllocateError('The money must land in a different purse than it came from.')
            return
        }
        setAllocateLoading(true)
        setAllocateError(null)
        const result = await onAllocate(val, fromPurse, toPurse)
        setAllocateLoading(false)
        if (result.ok) {
            setAllocateAmount('')
            setShowAllocate(false)
        } else {
            setAllocateError(result.error || 'Could not set this month\'s plan.')
        }
    }
    const handleAddBudget = (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(newBudgetAmount)
        if (newCategory.trim() && !isNaN(val) && val > 0) { onAddBudget(newCategory.trim(), val); setNewCategory(''); setNewBudgetAmount(''); setShowAddCategory(false) }
    }
    const handleQuickAdd = (cat: BudgetCategoryOption) => {
        onAddBudget(cat.label, defaultBudgetAmounts[cat.label] || 100)
    }

    const handleQuickTransaction = async (e: React.FormEvent, category: string) => {
        e.preventDefault()
        if (!quickAddAmount || !onAddTransaction) return

        setQuickAddLoading(true)
        try {
            await onAddTransaction({
                type: 'expense',
                amount: parseFloat(quickAddAmount),
                category,
                description: quickAddDesc,
                purse: quickAddPurse || (purses.length > 0 ? purses[0].name : 'Main'),
                priority: section,
            })
            setQuickAddAmount('')
            setQuickAddDesc('')
            setQuickAddCategory(null)
        } catch (err) {
            console.error('Quick transaction failed:', err)
        } finally {
            setQuickAddLoading(false)
        }
    }

    const toggleClass = (active: boolean) => cx('flex-1', active && 'border-gold/50 bg-gold/[0.08]')

    return (
        <Panel className="flex h-full flex-col gap-5">
            {/* ── Header: identity + share of plan used ── */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <p className={cx('font-mono text-[10px] uppercase tracking-[0.2em]', tone.text)}>{config.tag}</p>
                    <h3 className="font-display text-heading text-parchment">{section}</h3>
                    <p className="truncate text-caption text-parchment/50">{config.description}</p>
                </div>
                <p className="shrink-0 text-right" title={`${percentage.toFixed(0)}% of allocation used`}>
                    <span className={cx('font-mono text-heading tabular-nums', isOver ? 'text-ember' : 'text-parchment')}>{Math.round(percentage)}</span>
                    <span className="font-mono text-mono text-parchment/40">%</span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/40">used</span>
                </p>
            </div>

            {/* ── Figures: plan · used · left/over, then the bar ── */}
            <div className="space-y-3">
                <dl className="grid grid-cols-3 gap-3">
                    <div className="min-w-0">
                        <dt className={labelClass}>Plan</dt>
                        <dd className="mt-1 truncate font-mono text-body tabular-nums text-parchment">{totalAllocated.toFixed(0)}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className={labelClass}>Used</dt>
                        <dd className="mt-1 truncate font-mono text-body tabular-nums text-parchment">{totalSpent.toFixed(0)}</dd>
                    </div>
                    <div className="min-w-0 text-right">
                        <dt className={labelClass}>{isOver ? 'Over' : 'Left'}</dt>
                        <dd className={cx('mt-1 truncate font-mono text-body tabular-nums', isOver ? 'text-ember' : 'text-moss')}>
                            {Math.abs(remaining).toFixed(0)}
                        </dd>
                    </div>
                </dl>
                <ProgressBar value={percentage} min={totalSpent > 0 ? 2 : 0} tone={isOver ? 'bg-ember' : tone.bar} label={`${section} plan used`} />

                {/* Where this month's plan actually sits — the money has really moved. */}
                {allocation && allocation.amount > 0 && (
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-parchment/45"
                        title={`${allocation.amount.toFixed(2)} moved from ${allocation.sourcePurse} to ${allocation.purse}`}>
                        {allocation.sourcePurse}
                        <span aria-hidden="true" className="mx-1.5 text-parchment/30">→</span>
                        <span className="sr-only"> to </span>
                        {allocation.purse}
                    </p>
                )}
            </div>

            {/* ── Quiet actions: allocate · category · entries ── */}
            <div className="flex gap-2">
                <Button size="sm" aria-pressed={showAllocate} onClick={() => togglePanel('allocate')} className={toggleClass(showAllocate)}>
                    Allocate
                </Button>
                <Button size="sm" aria-pressed={showAddCategory} onClick={() => togglePanel('category')} className={toggleClass(showAddCategory)}>
                    Category
                </Button>
                <Button size="sm" aria-pressed={showExpenses} onClick={() => togglePanel('expenses')} className={toggleClass(showExpenses)}>
                    <span className="font-mono tabular-nums">{sectionEntries.length}</span>
                    {showExpenses ? 'Hide' : 'Entries'}
                </Button>
            </div>

            {/* ── Allocate form — the plan, and which purses fund it ── */}
            {showAllocate && (
                <div className="space-y-3 animate-fadeIn">
                    {!canMoveMoney ? (
                        <Notice tone="error">Allocating moves money between purses, so you need a second purse first.</Notice>
                    ) : (
                        <form onSubmit={handleAllocate} className="space-y-3">
                            <input
                                type="number" step="0.01" value={allocateAmount}
                                onChange={(e) => setAllocateAmount(e.target.value)} required autoFocus
                                aria-label="This month's plan"
                                className={cx(inputClass, 'font-mono tabular-nums')}
                                placeholder="Set this month's plan…"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex min-w-0 flex-col gap-1.5">
                                    <span className={labelClass}>From</span>
                                    <select value={fromPurse} onChange={(e) => setAllocateFrom(e.target.value)} className={inputClass}>
                                        {purses.map(p => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex min-w-0 flex-col gap-1.5">
                                    <span className={labelClass}>To</span>
                                    <select value={toPurse} onChange={(e) => setAllocateTo(e.target.value)} className={inputClass}>
                                        {purses.map(p => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            {fromPurse === toPurse && (
                                <p className="text-caption !text-ember">Pick two different purses — money has to actually move.</p>
                            )}
                            {allocateError && <Notice tone="error">{allocateError}</Notice>}
                            <Button type="submit" variant="primary" className="w-full"
                                disabled={allocateLoading || fromPurse === toPurse}
                                data-cursor="Set this month's plan">
                                {allocateLoading ? 'Moving…' : `Move into ${toPurse || 'purse'}`}
                            </Button>
                        </form>
                    )}
                </div>
            )}

            {/* ── Add category form ── */}
            {showAddCategory && (
                <div className="space-y-4 animate-fadeIn">
                    <form onSubmit={handleAddBudget} className="space-y-2">
                        <CategorySelect
                            scope={section}
                            value={newCategory}
                            onChange={setNewCategory}
                            options={SECTION_CATEGORIES[section] || []}
                            exclude={budgets.map(b => b.category)}
                            placeholder="What is this for?"
                        />
                        <div className="flex gap-2">
                            <input type="number" step="0.01" value={newBudgetAmount} onChange={(e) => setNewBudgetAmount(e.target.value)} required
                                aria-label="Monthly limit"
                                className={cx(inputClass, 'font-mono tabular-nums')}
                                placeholder="Monthly limit" />
                            <Button type="submit" variant="secondary" className="shrink-0" data-cursor="Add the category">
                                Add
                            </Button>
                        </div>
                    </form>
                    {suggestedUnused.length > 0 && (
                        <div className="space-y-2">
                            <p className={labelClass}>Common picks</p>
                            <div className="flex flex-wrap gap-2">
                                {suggestedUnused.slice(0, 6).map(cat => (
                                    <button key={cat.label} type="button" onClick={() => handleQuickAdd(cat)}
                                        title={`${cat.label} — ${defaultBudgetAmounts[cat.label] || 100}`}
                                        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-gold/20 px-3 text-left text-xs text-parchment/75 transition-colors hover:border-gold/45 hover:text-parchment pointer-fine:min-h-9">
                                        <span className="truncate">{cat.label}</span>
                                        <span className="shrink-0 font-mono tabular-nums text-parchment/45">{defaultBudgetAmounts[cat.label] || 100}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Category budgets ── */}
            <div className="flex-1">
                {budgets.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gold/15 px-4 py-5 text-center">
                        <p className="text-body text-parchment/55">No categories yet</p>
                        <p className="mt-0.5 text-caption text-parchment/40">Open Category above to split this plan.</p>
                    </div>
                ) : (
                    <div>
                        <p className={labelClass}>
                            Categories · <span className="tabular-nums">{budgets.length}</span>
                        </p>
                        <ul className="divide-y divide-gold/10">
                            {budgets.map(budget => (
                                <li key={budget.id}>
                                    <div className="group flex items-start gap-1">
                                        <div className="min-w-0 flex-1">
                                            <BudgetProgress category={budget.category} budgeted={budget.amount} spent={categorySpending[budget.category] || 0} />
                                        </div>
                                        <RowActions
                                            className="mt-2"
                                            label={`Actions for ${budget.category}`}
                                            actions={[
                                                {
                                                    label: 'Log an expense here',
                                                    icon: Plus,
                                                    onSelect: () => {
                                                        setQuickAddCategory(quickAddCategory === budget.category ? null : budget.category)
                                                        setQuickAddAmount('')
                                                        setQuickAddDesc('')
                                                    },
                                                },
                                                { label: 'Remove category', icon: Trash2, destructive: true, onSelect: () => onDeleteBudget(budget.id) },
                                            ]}
                                        />
                                    </div>
                                    {onAddTransaction && quickAddCategory === budget.category && (
                                        <form onSubmit={(e) => handleQuickTransaction(e, budget.category)}
                                            className="mb-3 space-y-2 rounded-lg border border-gold/20 p-3 animate-fadeIn">
                                            <div className="flex gap-2">
                                                <input
                                                    type="number" step="0.01" value={quickAddAmount}
                                                    onChange={(e) => setQuickAddAmount(e.target.value)}
                                                    required autoFocus
                                                    aria-label="Amount"
                                                    className={cx(inputClass, 'font-mono tabular-nums')}
                                                    placeholder="How much?"
                                                />
                                                <select
                                                    value={quickAddPurse}
                                                    onChange={(e) => setQuickAddPurse(e.target.value)}
                                                    aria-label="Purse"
                                                    className={cx(inputClass, 'w-auto max-w-[45%]')}
                                                >
                                                    {purses.map(p => (
                                                        <option key={p.id} value={p.name}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text" value={quickAddDesc}
                                                    onChange={(e) => setQuickAddDesc(e.target.value)}
                                                    aria-label="Note"
                                                    className={inputClass}
                                                    placeholder="Note (optional)"
                                                />
                                                <Button type="submit" variant="secondary" className="shrink-0" disabled={quickAddLoading || !quickAddAmount}>
                                                    {quickAddLoading ? '···' : 'Log'}
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* ── Recent expenses (expandable ledger) ── */}
            {showExpenses && (
                <div className="-mx-4 -mb-4 border-t border-gold/10 sm:-mx-6 sm:-mb-6">
                    {sectionEntries.length === 0 ? (
                        <p className="px-4 py-4 text-caption text-parchment/45 sm:px-6">No spending logged in this section yet.</p>
                    ) : (
                        <div className="max-h-64 overflow-y-auto" data-lenis-prevent>
                            <p className={cx(labelClass, 'px-4 pb-1 pt-3 sm:px-6')}>Recent entries</p>
                            <ul className="divide-y divide-gold/[0.06]">
                                {sectionEntries.slice(0, 12).map(entry => (
                                    <li key={entry.id} className="group flex min-h-11 items-center gap-3 px-4 py-1 sm:px-6">
                                        <span className="w-14 shrink-0 font-mono text-mono tabular-nums text-parchment/45">
                                            {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-caption !text-parchment/75">
                                            {entry.category}
                                            {entry.description && <span className="ml-1.5 text-parchment/40">· {entry.description}</span>}
                                        </span>
                                        <span className="shrink-0 font-mono text-mono tabular-nums text-ember">
                                            −{Number(entry.amount).toFixed(0)}
                                        </span>
                                        <RowAction icon={X} label="Delete entry" onClick={() => onDeleteEntry(entry.id)} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </Panel>
    )
}
