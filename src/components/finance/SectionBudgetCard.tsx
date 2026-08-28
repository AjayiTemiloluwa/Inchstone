'use client'

import React, { useState } from 'react'
import { BudgetProgress } from './BudgetProgress'
import { SECTION_CATEGORIES, BudgetCategoryOption, getSectionIcon } from './budgetCategories'
import { CategorySelect } from './CategorySelect'

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
    onAllocate: (amount: number) => void
    onAddBudget: (category: string, amount: number) => void
    onDeleteBudget: (id: string) => void
    onDeleteEntry: (id: string) => void
    onAddTransaction?: (entry: { type: string; amount: number; category: string; description: string; purse: string; priority: string }) => Promise<boolean>
}

/* v2 editorial palette — one accent per section, gradient reserved for the
   progress fill and the single primary action button. No currency glyphs:
   figures stand alone in mono with tabular numerals, labels carry meaning. */
const sectionConfig = {
    Need: {
        dot: '#B8935A',
        barGradient: 'linear-gradient(90deg, #B8935A 0%, #8a6d42 100%)',
        accentGradient: 'from-[#B8935A] to-[#8a6d42]',
        lightAccent: 'bg-[#B8935A]/10',
        text: 'text-[#B8935A]',
        hoverBorder: 'hover:border-[#B8935A]/45',
        tag: 'Foundation',
        description: 'Essentials you cannot skip',
    },
    Want: {
        dot: '#CF8F78',
        barGradient: 'linear-gradient(90deg, #CF8F78 0%, #7a3b2e 100%)',
        accentGradient: 'from-[#CF8F78] to-[#7a3b2e]',
        lightAccent: 'bg-[#CF8F78]/10',
        text: 'text-[#CF8F78]',
        hoverBorder: 'hover:border-[#CF8F78]/45',
        tag: 'Delight',
        description: 'Lifestyle and small joys',
    },
    Offerings: {
        dot: '#7FA871',
        barGradient: 'linear-gradient(90deg, #7FA871 0%, #4A5D45 100%)',
        accentGradient: 'from-[#7FA871] to-[#4A5D45]',
        lightAccent: 'bg-[#7FA871]/10',
        text: 'text-[#7FA871]',
        hoverBorder: 'hover:border-[#7FA871]/45',
        tag: 'Giving',
        description: 'Tithes, gifts and charity',
    },
    Savings: {
        dot: '#8FA3BF',
        barGradient: 'linear-gradient(90deg, #8FA3BF 0%, #5c6b8a 100%)',
        accentGradient: 'from-[#8FA3BF] to-[#5c6b8a]',
        lightAccent: 'bg-[#8FA3BF]/10',
        text: 'text-[#8FA3BF]',
        hoverBorder: 'hover:border-[#8FA3BF]/45',
        tag: 'Future',
        description: 'Reserves and long-term goals',
    },
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
    onAllocate,
    onAddBudget,
    onDeleteBudget,
    onDeleteEntry,
    onAddTransaction,
}: SectionBudgetCardProps) {
    const config = sectionConfig[section]
    const [showAllocate, setShowAllocate] = useState(false)
    const [allocateAmount, setAllocateAmount] = useState('')
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

    // Ring gauge geometry
    const RING_R = 17
    const RING_C = 2 * Math.PI * RING_R

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
    }

    const handleAllocate = (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(allocateAmount)
        if (!isNaN(val) && val > 0) { onAllocate(val); setAllocateAmount(''); setShowAllocate(false) }
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

    return (
        <div className={`spotlight-card relative rounded-[8px] border border-white/[0.06] bg-surface-solid ${config.hoverBorder} overflow-hidden transition-colors duration-300 flex flex-col h-full`}>
            {/* Left accent spine — a quiet thread of the section's colour */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[2px]" style={{ background: `linear-gradient(180deg, ${config.dot}, transparent)` }} />

            {/* ── Header: identity + usage ring ── */}
            <div className="pl-5 pr-4 pt-5 pb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <span className={`h-8 w-8 grid place-items-center rounded-lg ${config.lightAccent} text-base shrink-0`}>
                            {getSectionIcon(section)}
                        </span>
                        <div className="min-w-0">
                            <h3 className="font-display text-base font-bold text-parchment leading-tight">{section}</h3>
                            <p className="text-[11px] text-parchment/45 truncate">{config.description}</p>
                        </div>
                    </div>
                    <p className={`mt-2 inline-block font-mono text-[9px] uppercase tracking-[0.22em] ${config.text} opacity-70`}>
                        {config.tag}
                    </p>
                </div>

                {/* Usage ring — the one glanceable figure */}
                <div className="relative shrink-0" title={`${percentage.toFixed(0)}% of allocation used`}>
                    <svg width="52" height="52" viewBox="0 0 52 52">
                        <circle cx="26" cy="26" r={RING_R} fill="none" stroke="rgba(243,239,230,0.08)" strokeWidth="3.5" />
                        <circle
                            cx="26" cy="26" r={RING_R} fill="none"
                            stroke={isOver ? '#cf8f78' : config.dot}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={RING_C}
                            strokeDashoffset={RING_C * (1 - Math.max(percentage / 100, 0.02))}
                            transform="rotate(-90 26 26)"
                            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s ease' }}
                        />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                        <span className={`font-mono text-[11px] font-bold tabular-nums ${isOver ? 'text-[#e0a093]' : 'text-parchment'}`}>
                            {Math.round(percentage)}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Figures row: allocated · spent · left/over ── */}
            <div className="mx-5 grid grid-cols-3 divide-x divide-white/[0.06] rounded-lg border border-white/[0.06] bg-black/20 py-2.5">
                <div className="px-3 first:pl-3.5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-parchment/35">Plan</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-parchment">{totalAllocated.toFixed(0)}</p>
                </div>
                <div className="px-3">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-parchment/35">Used</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-parchment">{totalSpent.toFixed(0)}</p>
                </div>
                <div className="px-3 last:pr-3.5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-parchment/35">{isOver ? 'Over' : 'Left'}</p>
                    <p className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${isOver ? 'text-[#e0a093]' : 'text-[#a9c79f]'}`}>
                        {Math.abs(remaining).toFixed(0)}
                    </p>
                </div>
            </div>

            {/* ── Spend bar with quarter ticks ── */}
            <div className="mx-5 mt-4">
                <div className="relative h-1.5 w-full rounded-full bg-white/[0.06] overflow-visible">
                    <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${Math.max(percentage, totalSpent > 0 ? 2 : 0)}%`,
                            background: isOver ? 'linear-gradient(90deg, #cf8f78, #7a3b2e)' : config.barGradient,
                        }}
                    />
                    {[25, 50, 75].map(t => (
                        <span key={t} className="absolute top-[-2px] h-[10px] w-px bg-parchment/15" style={{ left: `${t}%` }} />
                    ))}
                </div>
            </div>

            {/* ── Quiet actions: allocate · category · expenses ── */}
            <div className="px-5 py-4 mt-auto">
                <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] p-1">
                    <button
                        onClick={() => togglePanel('allocate')}
                        className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors active:opacity-70 ${showAllocate ? 'bg-white/[0.07] text-parchment' : 'text-parchment/55 hover:text-parchment hover:bg-white/[0.03]'}`}
                    >
                        Allocate
                    </button>
                    <button
                        onClick={() => togglePanel('category')}
                        className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors active:opacity-70 ${showAddCategory ? 'bg-white/[0.07] text-parchment' : 'text-parchment/55 hover:text-parchment hover:bg-white/[0.03]'}`}
                    >
                        Category
                    </button>
                    <button
                        onClick={() => togglePanel('expenses')}
                        className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold tabular-nums transition-colors active:opacity-70 ${showExpenses ? 'bg-white/[0.07] text-parchment' : 'text-parchment/55 hover:text-parchment hover:bg-white/[0.03]'}`}
                    >
                        {sectionEntries.length}
                        <span className={config.text}>{showExpenses ? 'Hide' : 'Entries'}</span>
                    </button>
                </div>
            </div>

            {/* ── Allocate form ── */}
            {showAllocate && (
                <div className="mx-5 mb-4 animate-fadeIn">
                    <form onSubmit={handleAllocate} className="flex gap-2">
                        <input
                            type="number" step="0.01" value={allocateAmount}
                            onChange={(e) => setAllocateAmount(e.target.value)} required autoFocus
                            className="w-full bg-black/25 border border-white/10 rounded-lg py-2.5 px-3 font-mono text-sm font-semibold tabular-nums placeholder:text-parchment/25 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/40 transition-all"
                            placeholder="Set this month's plan…"
                        />
                        <button type="submit"
                            data-cursor="Set this month's plan"
                            className={`shrink-0 px-5 py-2.5 rounded-lg text-sm font-bold text-ink bg-gradient-to-r ${config.accentGradient} hover:brightness-110 active:opacity-80 transition-all`}>
                            Set
                        </button>
                    </form>
                </div>
            )}

            {/* ── Add category form ── */}
            {showAddCategory && (
                <div className="mx-5 mb-4 animate-fadeIn space-y-3">
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
                                className="w-full bg-black/25 border border-white/10 rounded-lg py-2.5 px-3 font-mono text-sm font-semibold tabular-nums placeholder:text-parchment/25 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/40 transition-all"
                                placeholder="Monthly limit" />
                            <button type="submit"
                                data-cursor="Add the category"
                                className={`shrink-0 px-5 py-2.5 rounded-lg text-sm font-bold text-ink bg-gradient-to-r ${config.accentGradient} hover:brightness-110 active:opacity-80 transition-all`}>
                                Add
                            </button>
                        </div>
                    </form>
                    {suggestedUnused.length > 0 && (
                        <div>
                            <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-parchment/35">Common picks</p>
                            <div className="flex flex-wrap gap-1.5">
                                {suggestedUnused.slice(0, 6).map(cat => (
                                    <button key={cat.label} type="button" onClick={() => handleQuickAdd(cat)}
                                        title={`${cat.label} — ${defaultBudgetAmounts[cat.label] || 100}`}
                                        className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-parchment/70 transition-all hover:border-gold/40 hover:text-parchment active:opacity-70 flex items-center gap-1">
                                        <span>{cat.icon}</span>
                                        <span className="font-mono font-semibold tabular-nums">{defaultBudgetAmounts[cat.label] || 100}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Category budgets ── */}
            <div className="px-5 pb-5 flex-1">
                {budgets.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/[0.08] py-5 text-center">
                        <p className="text-xs font-medium text-parchment/45">No categories yet</p>
                        <p className="mt-0.5 text-[10px] text-parchment/30">Open Category above to split this plan.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-parchment/35">
                            Categories · {budgets.length}
                        </p>
                        {budgets.map(budget => (
                            <div key={budget.id}>
                                <div className="relative group">
                                    <BudgetProgress category={budget.category} budgeted={budget.amount} spent={categorySpending[budget.category] || 0} />
                                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button
                                            onClick={() => {
                                                setQuickAddCategory(quickAddCategory === budget.category ? null : budget.category)
                                                setQuickAddAmount('')
                                                setQuickAddDesc('')
                                            }}
                                            className="w-5 h-5 bg-gold text-ink rounded-full text-xs leading-none flex items-center justify-center hover:bg-[#cbaa6f] transition-all shadow-md"
                                            title="Log an expense here"
                                        >
                                            +
                                        </button>
                                        <button onClick={() => onDeleteBudget(budget.id)}
                                            className="w-5 h-5 bg-ember text-parchment rounded-full text-xs leading-none flex items-center justify-center hover:brightness-125 transition-all shadow-md"
                                            title="Remove category">
                                            ×
                                        </button>
                                    </div>
                                    {onAddTransaction && quickAddCategory === budget.category && (
                                        <form onSubmit={(e) => handleQuickTransaction(e, budget.category)}
                                            className="mt-1.5 space-y-1.5 rounded-lg border border-gold/20 bg-black/30 p-2 animate-fadeIn">
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="number" step="0.01" value={quickAddAmount}
                                                    onChange={(e) => setQuickAddAmount(e.target.value)}
                                                    required autoFocus
                                                    className="w-full rounded-md border border-white/10 bg-black/25 py-1.5 pl-2.5 pr-2 font-mono text-xs font-semibold tabular-nums placeholder:text-parchment/25 focus:outline-none focus:ring-1 focus:ring-gold/40"
                                                    placeholder="How much?"
                                                />
                                                <select
                                                    value={quickAddPurse}
                                                    onChange={(e) => setQuickAddPurse(e.target.value)}
                                                    className="rounded-md border border-white/10 bg-black/25 px-1 py-1.5 text-[10px] text-parchment/70 focus:outline-none focus:ring-1 focus:ring-gold/40"
                                                >
                                                    {purses.map(p => (
                                                        <option key={p.id} value={p.name}>{p.icon} {p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="text" value={quickAddDesc}
                                                    onChange={(e) => setQuickAddDesc(e.target.value)}
                                                    className="flex-1 rounded-md border border-white/10 bg-black/25 py-1.5 px-2 text-[10px] placeholder:text-parchment/25 focus:outline-none focus:ring-1 focus:ring-gold/40"
                                                    placeholder="Note (optional)"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={quickAddLoading || !quickAddAmount}
                                                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold text-ink bg-gradient-to-r ${config.accentGradient} hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}>
                                                    {quickAddLoading ? '···' : 'Log'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Recent expenses (expandable ledger) ── */}
            {showExpenses && (
                <div className="border-t border-white/[0.06] bg-black/25">
                    {sectionEntries.length === 0 ? (
                        <p className="px-5 py-4 text-[11px] italic text-parchment/40">No spending logged in this section yet.</p>
                    ) : (
                        <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]" data-lenis-prevent>
                            <p className="px-5 pt-3 pb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-parchment/35">
                                Recent entries
                            </p>
                            {sectionEntries.slice(0, 12).map(entry => (
                                <div key={entry.id} className="group flex items-center gap-3 px-5 py-2 transition-colors hover:bg-white/[0.02]">
                                    <span className="w-14 shrink-0 font-mono text-[10px] tabular-nums text-parchment/45">
                                        {new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[11px] text-parchment/70">
                                        {entry.category}
                                        {entry.description && <span className="ml-1.5 text-[10px] text-parchment/35">· {entry.description}</span>}
                                    </span>
                                    <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-[#e0a093]">
                                        −{Number(entry.amount).toFixed(0)}
                                    </span>
                                    <button onClick={() => onDeleteEntry(entry.id)}
                                        className="shrink-0 text-parchment/30 opacity-0 transition-all hover:text-[#cf8f78] group-hover:opacity-100"
                                        title="Delete entry">
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}