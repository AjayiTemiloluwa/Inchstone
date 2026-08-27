import type { TimeOfDay } from '@/components/effects/atmosphere'

/**
 * VoiceKey — one stable identifier for every recurring bit of user-facing
 * copy that should vary (loading lines, empty states, confirmations, toasts,
 * celebrations, nudges) instead of repeating a single hardcoded string.
 *
 * Naming convention:
 *   loading.*        — shown while data loads, per route
 *   empty.*          — empty states, per surface
 *   confirm.*        — destructive / confirm-dialog prompts
 *   toast.*          — success / info / error snackbars
 *   celebrate.*      — milestone / perfect-day wins
 *   nudge.*          — partner nudges and streak steering
 *
 * Design: extend by adding keys here + entries in copy-bank.ts. No logic
 * changes needed to keep adding voice.
 */
export type VoiceKey =
  // Loading (per route / domain) — mirrors the RouteKey used by <Loader/>
  | 'loading.calendar'
  | 'loading.day'
  | 'loading.week'
  | 'loading.month'
  | 'loading.quarter'
  | 'loading.year'
  | 'loading.goal'
  | 'loading.finance'
  | 'loading.notes'
  | 'loading.partners'
  | 'loading.reports'
  | 'loading.plans'
  | 'loading.reviews'
  | 'loading.settings'
  | 'loading.dashboard'
  | 'loading.year-quarter'
  | 'loading.year-quarter-month'
  | 'loading.year-quarter-month-week'
  // Empty states
  | 'empty.calendar'
  | 'empty.day'
  | 'empty.week'
  | 'empty.goals'
  | 'empty.hierarchy'
  | 'empty.notes'
  | 'empty.reviews'
  | 'empty.finance'
  | 'empty.plans'
  | 'empty.partners'
  // Confirmation dialogs (destructive / cascade)
  | 'confirm.deleteCascade'
  | 'confirm.deleteGoal'
  | 'confirm.deleteMilestone'
  | 'confirm.deleteSection'
  | 'confirm.deleteTransaction'
  | 'confirm.deleteCategory'
  | 'confirm.deleteHabitAll'
  | 'confirm.unlink'
  // Toasts (success / info)
  | 'toast.changesSaved'
  | 'toast.deleted'
  | 'toast.deedAdded'
  | 'toast.habitAdded'
  | 'toast.streakContinued'
  | 'toast.pdfGenerated'
  | 'toast.categoryCreated'
  // Celebrations
  | 'celebrate.perfectDay'
  | 'celebrate.milestoneComplete'
  // Nudges
  | 'nudge.behindOnWeek'
  | 'nudge.aheadOfWeek'

/** One bank slot: variants per time band, plus a time-independent fallback. */
export type Slot =
  Partial<Record<TimeOfDay, string[]>> & { any?: string[] }

export type CopyBank = Record<VoiceKey, Slot>