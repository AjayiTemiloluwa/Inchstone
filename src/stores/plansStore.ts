
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic API payloads at network boundary */
// Client state for the Long-Term Plans module.
// Mirrors hierarchyStore's fetch-then-set style: mutations hit the API then
// refresh the affected slice.
import { create } from 'zustand'
import type {
  GoalStatus,
  LongTermPlanRecord,
  PlanGoalRecord,
  PlanSectionRecord,
  PlanSummary,
  StatusLogEntryRecord,
} from '@/lib/plans/types'

export interface MutationResult {
  ok: boolean
  error?: string
  warnings?: string[]
}

/** Light projection of a yearly-tracker Item used for §8 rollups */
export interface TrackerItemLite {
  id: string
  title: string
  progress: number
}

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as any).error || `Request failed (${res.status})`)
  return json as T
}

interface PlansState {
  plans: PlanSummary[]
  loadingPlans: boolean
  plansError: string | null

  currentPlan: LongTermPlanRecord | null
  loadingPlan: boolean
  planError: string | null

  fetchPlans: () => Promise<void>
  fetchPlan: (id: string) => Promise<LongTermPlanRecord | null>
  createPlan: (data: Record<string, unknown>) => Promise<LongTermPlanRecord | null>
  updatePlan: (id: string, data: Record<string, unknown>) => Promise<MutationResult>
  deletePlan: (id: string) => Promise<boolean>

  addSection: (planId: string, name: string, description?: string) => Promise<MutationResult>
  updateSection: (sectionId: string, data: Record<string, unknown>) => Promise<MutationResult>
  deleteSection: (sectionId: string) => Promise<boolean>
  reorderSections: (sectionIds: string[]) => Promise<MutationResult>

  addGoal: (sectionId: string, data: Record<string, unknown>) => Promise<MutationResult>
  updateGoal: (goalId: string, data: Record<string, unknown>) => Promise<MutationResult>
  deleteGoal: (goalId: string) => Promise<boolean>
  reorderGoals: (goalIds: string[]) => Promise<MutationResult>

  addMilestone: (goalId: string, data: Record<string, unknown>) => Promise<MutationResult>
  updateMilestone: (milestoneId: string, data: Record<string, unknown>) => Promise<MutationResult>
  deleteMilestone: (milestoneId: string) => Promise<boolean>

  fetchStatusLog: (parentType: 'goal' | 'milestone', parentId: string) => Promise<StatusLogEntryRecord[]>
  saveReviewSession: (planId: string, summaryNote?: string) => Promise<MutationResult>

  // Yearly-tracker rollup source data (§8), loaded once per session
  trackerItems: Record<string, TrackerItemLite>
  trackerLoaded: boolean
  fetchTrackerItems: () => Promise<void>
}

export const usePlansStore = create<PlansState>((set, get) => ({
  plans: [],
  loadingPlans: false,
  plansError: null,

  currentPlan: null,
  loadingPlan: false,
  planError: null,

  fetchPlans: async () => {
    set({ loadingPlans: true, plansError: null })
    try {
      const json = await api<{ plans: PlanSummary[] }>('/api/plans')
      set({ plans: json.plans, loadingPlans: false })
    } catch (e: any) {
      set({ loadingPlans: false, plansError: e.message || 'Failed to load plans' })
    }
  },

  fetchPlan: async (id) => {
    set({ loadingPlan: true, planError: null })
    try {
      const json = await api<{ plan: LongTermPlanRecord }>(`/api/plans/${id}`)
      set({ currentPlan: json.plan, loadingPlan: false })
      return json.plan
    } catch (e: any) {
      set({ loadingPlan: false, planError: e.message || 'Failed to load plan' })
      return null
    }
  },

  createPlan: async (data) => {
    try {
      const json = await api<{ plan: LongTermPlanRecord }>('/api/plans', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchPlans()
      return json.plan
    } catch {
      return null
    }
  },

  updatePlan: async (id, data) => {
    try {
      await api(`/api/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
      const s = get()
      await Promise.all([
        s.fetchPlans(),
        s.currentPlan?.id === id ? s.fetchPlan(id) : Promise.resolve(),
      ])
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to update plan' }
    }
  },

  deletePlan: async (id) => {
    try {
      await api(`/api/plans/${id}`, { method: 'DELETE' })
      set(s => ({
        plans: s.plans.filter(p => p.id !== id),
        currentPlan: s.currentPlan?.id === id ? null : s.currentPlan,
      }))
      return true
    } catch {
      return false
    }
  },

  addSection: async (planId, name, description) => {
    try {
      await api('/api/plan-sections', {
        method: 'POST',
        body: JSON.stringify({ planId, name, description }),
      })
      await get().fetchPlan(planId)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to add section' }
    }
  },

  updateSection: async (sectionId, data) => {
    try {
      await api(`/api/plan-sections/${sectionId}`, { method: 'PATCH', body: JSON.stringify(data) })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to update section' }
    }
  },

  deleteSection: async (sectionId) => {
    try {
      await api(`/api/plan-sections/${sectionId}`, { method: 'DELETE' })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return true
    } catch {
      return false
    }
  },

  reorderSections: async (sectionIds) => {
    try {
      await api('/api/plan-sections/reorder', { method: 'PATCH', body: JSON.stringify({ sectionIds }) })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to reorder sections' }
    }
  },

  addGoal: async (sectionId, data) => {
    try {
      const json = await api<{ warnings?: string[] }>('/api/plan-goals', {
        method: 'POST',
        body: JSON.stringify({ sectionId, ...data }),
      })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return { ok: true, warnings: json.warnings }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to save goal' }
    }
  },

  updateGoal: async (goalId, data) => {
    try {
      const json = await api<{ warnings?: string[] }>(`/api/plan-goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return { ok: true, warnings: json.warnings }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to save goal' }
    }
  },

  deleteGoal: async (goalId) => {
    try {
      await api(`/api/plan-goals/${goalId}`, { method: 'DELETE' })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return true
    } catch {
      return false
    }
  },

  reorderGoals: async (goalIds) => {
    try {
      await api('/api/plan-goals/reorder', { method: 'PATCH', body: JSON.stringify({ goalIds }) })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to reorder goals' }
    }
  },

  addMilestone: async (goalId, data) => {
    try {
      await api('/api/plan-milestones', { method: 'POST', body: JSON.stringify({ goalId, ...data }) })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to add milestone' }
    }
  },

  updateMilestone: async (milestoneId, data) => {
    try {
      await api(`/api/plan-milestones/${milestoneId}`, { method: 'PATCH', body: JSON.stringify(data) })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to save milestone' }
    }
  },

  deleteMilestone: async (milestoneId) => {
    try {
      await api(`/api/plan-milestones/${milestoneId}`, { method: 'DELETE' })
      const plan = get().currentPlan
      if (plan) await get().fetchPlan(plan.id)
      return true
    } catch {
      return false
    }
  },

  fetchStatusLog: async (parentType, parentId) => {
    try {
      const json = await api<{ entries: StatusLogEntryRecord[] }>(
        `/api/status-log?parentType=${parentType}&parentId=${parentId}`
      )
      return json.entries
    } catch {
      return []
    }
  },

  saveReviewSession: async (planId, summaryNote) => {
    try {
      await api(`/api/plans/${planId}/review-sessions`, {
        method: 'POST',
        body: JSON.stringify({ summaryNote }),
      })
      await Promise.all([get().fetchPlan(planId), get().fetchPlans()])
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to save review session' }
    }
  },

  trackerItems: {},
  trackerLoaded: false,
  fetchTrackerItems: async () => {
    if (get().trackerLoaded) return
    try {
      const json = await api<{
        items?: Array<{ id: string; title: string; layer: number; progress?: number }>
      }>('/api/items')
      const map: Record<string, TrackerItemLite> = {}
      for (const i of json.items ?? []) {
        if (i.layer >= 1 && i.layer <= 2 && i.title) {
          map[i.id] = { id: i.id, title: i.title, progress: i.progress ?? 0 }
        }
      }
      set({ trackerItems: map, trackerLoaded: true })
    } catch {
      // Silent — linking is optional; pickers just stay empty
    }
  },
}))

// Convenience re-export so callers can name these without another import path
export type { GoalStatus, PlanGoalRecord, PlanSectionRecord }