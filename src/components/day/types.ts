import type { Item, Task } from '@/stores/hierarchyStore'

export type GraphRange = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'

// How much of a repeating deed/habit a delete should take out. Mirrors the
// `scope` query param accepted by DELETE /api/tasks/[id].
export type DeleteScope = 'single' | 'future' | 'all'

export type DeedModalData = {
  task: Task
  parentGoal: Item | null
}

export type GoogleEventView = {
  id: string
  title: string
  startTime: string
  endTime: string
  type?: string
}

/** One habit instance row as returned by GET /api/habits. */
export type HabitHistoryEntry = {
  date: string
  title: string
  completed: boolean
}

/** One habit definition as returned by GET /api/habits/overview. */
export type HabitOverviewEntry = {
  title: string
  scheduled: boolean
  pattern: string
  nextDue: string | null
}

export type HabitDetail = {
  days: { date: Date; done: boolean }[]
  streak: number
  rate: number
  total: number
  done: number
}

export type DayNote = {
  id: string
  title: string
  content: string
  createdAt: string
  [key: string]: unknown
}

export type NewDeedValues = {
  title: string
  start: string
  end: string
  categoryId: string
  isRecurring: boolean
  recurrencePattern: string
  recurrenceEnd: string
  isFrog: boolean
  isHabit: boolean
  isImportant: boolean
  reminder: string
  notify: boolean
  endWarn: string
  color: string
}

export type CountdownTask = Pick<Task, 'startTime' | 'endTime'>

export const HABIT_PATTERN_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

/** Shared modal chrome: bottom sheet on phones, centred card from sm up. */
export const BACKDROP_CLASS =
  'fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center sm:p-4'
export const SHEET_SAFE_AREA = 'pb-[env(safe-area-inset-bottom)]'
