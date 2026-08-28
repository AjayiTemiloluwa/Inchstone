'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, X } from 'lucide-react'
import type { BudgetCategoryOption } from './budgetCategories'
import {
    addCustomCategory,
    CUSTOM_CATEGORY_ICON,
    isKnownCategory,
    useCustomCategories,
    type CustomCategoryScope,
} from './customCategories'

/**
 * CategorySelect — the one standard finance category dropdown.
 *
 * A proper select-style control: a trigger button, a scrolling menu with
 * icon + label rows and a check on the active one, click-outside/Escape to
 * close — and, pinned at the bottom, an "Others…" row. Picking Others opens
 * a small inline field: type anything ("Barbing", "Data top-up", …), hit
 * Enter/Add and it is saved to your custom categories, so it shows up in
 * every dropdown for that scope from the next time on.
 *
 * `options` are the built-in suggestions; `exclude` hides labels that are
 * already budgeted (used by the budget card). Custom categories are read
 * from the customCategories store via `scope` and appended after a divider.
 */
export function CategorySelect({
    scope,
    value,
    onChange,
    options,
    exclude = [],
    placeholder = 'Choose a category…',
    id,
}: {
    scope: CustomCategoryScope
    value: string
    onChange: (label: string) => void
    /** Built-in suggestions for this scope. */
    options: BudgetCategoryOption[]
    /** Labels to hide (e.g. already-budgeted categories). */
    exclude?: string[]
    placeholder?: string
    id?: string
}) {
    const [open, setOpen] = useState(false)
    const [othersMode, setOthersMode] = useState(false)
    const [draft, setDraft] = useState('')
    const rootRef = useRef<HTMLDivElement>(null)
    const othersInputRef = useRef<HTMLInputElement>(null)

    const custom = useCustomCategories(scope)

    const close = () => {
        setOpen(false)
        setOthersMode(false)
        setDraft('')
    }

    // Close on click-outside or Escape while open.
    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close()
        }
        window.addEventListener('pointerdown', onDown, { capture: true })
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('pointerdown', onDown, { capture: true })
            window.removeEventListener('keydown', onKey)
        }
    }, [open])

    // Focus the Others field as soon as it appears.
    useEffect(() => {
        if (othersMode) othersInputRef.current?.focus()
    }, [othersMode])

    const hidden = (label: string) => exclude.some(x => x.toLowerCase() === label.toLowerCase())
    const builtIns = options.filter(o => !hidden(o.label))
    const customs = custom.filter(o => !hidden(o.label))

    const pick = (label: string) => {
        onChange(label)
        close()
    }

    const saveOthers = () => {
        const clean = draft.trim()
        if (!clean) return
        // Typing something that nearly matches an existing category selects
        // that one instead of filing a near-duplicate.
        if (isKnownCategory(builtIns, customs.map(c => c.label), clean)) {
            const match =
                builtIns.find(o => o.label.toLowerCase() === clean.toLowerCase()) ||
                customs.find(o => o.label.toLowerCase() === clean.toLowerCase())
            if (match) {
                pick(match.label)
                return
            }
        }
        addCustomCategory(scope, clean)
        pick(clean)
    }

    const selected =
        builtIns.find(o => o.label === value) ||
        customs.find(o => o.label === value) ||
        null

    return (
        <div ref={rootRef} className="relative">
            {/* Trigger — styled like the app's standard form field */}
            <button
                type="button"
                id={id}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`flex w-full items-center gap-2 rounded-lg border py-2.5 pl-3 pr-2.5 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-gold/30 ${
                    open
                        ? 'border-gold/40 bg-black/25'
                        : value
                            ? 'border-white/10 bg-black/25 text-parchment hover:border-white/20'
                            : 'border-white/10 bg-black/25 text-parchment/40 hover:border-white/20'
                }`}
            >
                <span className="min-w-0 flex-1 truncate">
                    {selected ? (
                        <>
                            <span className="mr-1.5">{selected.icon}</span>
                            {selected.label}
                        </>
                    ) : (
                        placeholder
                    )}
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-parchment/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-label="Category"
                    className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#16120f] shadow-[0_18px_50px_rgba(0,0,0,0.55)] animate-fadeIn"
                >
                    {othersMode ? (
                        /* ── Others: type your own, saved for next time ── */
                        <div className="p-2.5">
                            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-parchment/35">
                                Your own category
                            </p>
                            <div className="flex gap-1.5">
                                <input
                                    ref={othersInputRef}
                                    type="text"
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            saveOthers()
                                        }
                                    }}
                                    maxLength={48}
                                    placeholder="e.g. Data top-up, Barbing…"
                                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-sm text-parchment placeholder:text-parchment/25 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/30"
                                />
                                <button
                                    type="button"
                                    onClick={saveOthers}
                                    disabled={!draft.trim()}
                                    className="flex shrink-0 items-center gap-1 rounded-lg bg-gold px-3 py-2 text-xs font-bold text-ink transition hover:bg-[#cbaa6f] disabled:opacity-40"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setOthersMode(false); setDraft('') }}
                                    aria-label="Cancel"
                                    className="flex shrink-0 items-center rounded-lg border border-white/10 px-2 text-parchment/50 transition hover:text-parchment"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-parchment/40">
                                Saved to this dropdown, so it&apos;s here next time.
                            </p>
                        </div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto" data-lenis-prevent>
                            {builtIns.length === 0 && customs.length === 0 && (
                                <p className="px-3.5 py-4 text-sm text-parchment/40">
                                    Nothing here yet — add your own below.
                                </p>
                            )}

                            {builtIns.map(o => (
                                <button
                                    key={o.label}
                                    type="button"
                                    role="option"
                                    aria-selected={o.label === value}
                                    onClick={() => pick(o.label)}
                                    className={`flex min-h-[40px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${
                                        o.label === value
                                            ? 'bg-gold/[0.08] text-parchment'
                                            : 'text-parchment/80 hover:bg-white/[0.06] hover:text-parchment'
                                    }`}
                                >
                                    <span className="w-5 shrink-0 text-center">{o.icon}</span>
                                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                    {o.label === value && <Check className="h-4 w-4 shrink-0 text-gold" />}
                                </button>
                            ))}

                            {customs.length > 0 && (
                                <>
                                    <p className="border-t border-white/[0.06] px-3.5 pb-1 pt-2.5 font-mono text-[9px] uppercase tracking-[0.22em] text-parchment/35">
                                        Your categories
                                    </p>
                                    {customs.map(o => (
                                        <button
                                            key={o.label}
                                            type="button"
                                            role="option"
                                            aria-selected={o.label === value}
                                            onClick={() => pick(o.label)}
                                            className={`flex min-h-[40px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${
                                                o.label === value
                                                    ? 'bg-gold/[0.08] text-parchment'
                                                    : 'text-parchment/80 hover:bg-white/[0.06] hover:text-parchment'
                                            }`}
                                        >
                                            <span className="w-5 shrink-0 text-center">{o.icon}</span>
                                            <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                            {o.label === value && <Check className="h-4 w-4 shrink-0 text-gold" />}
                                        </button>
                                    ))}
                                </>
                            )}

                            {/* ── Pinned: the Others escape hatch ── */}
                            <button
                                type="button"
                                role="option"
                                aria-selected={false}
                                onClick={() => setOthersMode(true)}
                                className="flex min-h-[44px] w-full items-center gap-2.5 border-t border-white/[0.07] px-3.5 py-2.5 text-left text-sm font-semibold text-gold transition-colors hover:bg-gold/[0.08]"
                            >
                                <span className="flex w-5 shrink-0 justify-center">
                                    <Pencil className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    Others… <span className="font-normal text-parchment/45">— type anything</span>
                                </span>
                                {value && !selected && (
                                    <span className="max-w-[45%] truncate font-mono text-[10px] text-parchment/35">
                                        {CUSTOM_CATEGORY_ICON} {value}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
