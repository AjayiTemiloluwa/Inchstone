'use client'

import { create } from 'zustand'
import { useEffect } from 'react'
import type { BudgetCategoryOption } from './budgetCategories'

/**
 * customCategories — user-created finance categories.
 *
 * When you pick "Others…" in a category dropdown and type your own, the name
 * is saved here (and to localStorage under "inchstone-custom-categories"), so
 * from then on it appears in every category dropdown for that scope — the
 * dropdown learns what you actually spend on.
 *
 * Scoped per bucket: Need / Want / Offerings / Savings / Income. Same
 * zustand + localStorage pattern as yearStore, so hydrating never triggers a
 * React setState-in-effect and every dropdown stays in sync.
 */

const STORAGE_KEY = 'inchstone-custom-categories'

export type CustomCategoryScope = 'Need' | 'Want' | 'Offerings' | 'Savings' | 'Income'

/** Icon shown for user-created categories in every dropdown. */
export const CUSTOM_CATEGORY_ICON = '🏷️'

type ScopeMap = Partial<Record<CustomCategoryScope, string[]>>

function readAll(): ScopeMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return typeof parsed === 'object' && parsed !== null ? (parsed as ScopeMap) : {}
    } catch {
        return {}
    }
}

function writeAll(all: ScopeMap) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
        /* storage unavailable (private mode) — in-memory only for this session */
    }
}

type CustomCategoryState = {
    byScope: ScopeMap
    /** false until the first client-side hydrate — SSR renders no customs. */
    hydrated: boolean
    hydrate: () => void
    add: (scope: CustomCategoryScope, label: string) => void
    remove: (scope: CustomCategoryScope, label: string) => void
}

const useCustomCategoryStore = create<CustomCategoryState>((set, get) => ({
    byScope: {},
    hydrated: false,
    hydrate: () =>
        set(state => (state.hydrated ? state : { hydrated: true, byScope: readAll() })),
    add: (scope, label) => {
        const clean = label.trim()
        if (!clean) return
        const current = get().byScope[scope] || []
        // Case-insensitive de-dupe; newest first.
        const next = [clean, ...current.filter(c => c.toLowerCase() !== clean.toLowerCase())]
        const byScope = { ...get().byScope, [scope]: next }
        writeAll(byScope)
        set({ byScope })
    },
    remove: (scope, label) => {
        const current = get().byScope[scope] || []
        const byScope = { ...get().byScope, [scope]: current.filter(c => c !== label) }
        writeAll(byScope)
        set({ byScope })
    },
}))

/** Hydrate-once for the active browser. */
export function useCustomCategoryHydration() {
    const hydrate = useCustomCategoryStore(s => s.hydrate)
    useEffect(() => {
        hydrate()
    }, [hydrate])
}

/** The user's own categories for one scope, ready for a dropdown. */
export function useCustomCategories(scope: CustomCategoryScope): BudgetCategoryOption[] {
    useCustomCategoryHydration()
    const labels = useCustomCategoryStore(s => s.byScope[scope])
    return (labels || []).map(label => ({ label, icon: CUSTOM_CATEGORY_ICON }))
}

/** Persist a typed-in category so it shows up next time. */
export function addCustomCategory(scope: CustomCategoryScope, label: string) {
    useCustomCategoryStore.getState().add(scope, label)
}

export function removeCustomCategory(scope: CustomCategoryScope, label: string) {
    useCustomCategoryStore.getState().remove(scope, label)
}

/** Case-insensitive check across built-ins + customs — used to avoid duplicates. */
export function isKnownCategory(builtIn: BudgetCategoryOption[], custom: string[], label: string): boolean {
    const needle = label.trim().toLowerCase()
    if (!needle) return false
    return (
        builtIn.some(o => o.label.toLowerCase() === needle) ||
        custom.some(c => c.toLowerCase() === needle)
    )
}