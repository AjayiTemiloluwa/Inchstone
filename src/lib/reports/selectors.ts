import type { ReportDay, ReportTask } from './types'

export type StatusFilter = 'all' | 'completed' | 'incomplete'
export type TaskSort = 'date-desc' | 'date-asc' | 'score-desc' | 'tasks-desc'

export interface TaskFilters {
    status: StatusFilter
    category: string // 'all' or category id
    priority: string // 'all' | 'high' | 'medium' | 'low' | 'Unassigned'
    frogsOnly: boolean
    habitsOnly: boolean
    search: string
}

export const DEFAULT_FILTERS: TaskFilters = {
    status: 'all',
    category: 'all',
    priority: 'all',
    frogsOnly: false,
    habitsOnly: false,
    search: '',
}

export const DEFAULT_SORT: TaskSort = 'date-asc'

/** Should a task pass the active filters? Caller handles grouping (frog/habit). */
export function taskPasses(task: ReportTask, filters: TaskFilters): boolean {
    if (filters.status === 'completed' && !task.completed) return false
    if (filters.status === 'incomplete' && task.completed) return false
    if (filters.category !== 'all' && (task.categoryId ?? 'uncategorized') !== filters.category) return false
    if (filters.priority !== 'all' && (task.priority ?? 'Unassigned') !== filters.priority) return false
    if (filters.frogsOnly && !task.isFrog) return false
    if (filters.habitsOnly && !task.isHabit) return false
    if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase()
        const title = task.title?.toLowerCase() ?? ''
        const goal = task.goalTitle?.toLowerCase() ?? ''
        const cat = task.categoryTitle?.toLowerCase() ?? ''
        if (!title.includes(q) && !goal.includes(q) && !cat.includes(q)) return false
    }
    return true
}

/** Returns the subset of a day's tasks that pass the filters. */
export function filterDayTasks(day: ReportDay, filters: TaskFilters): ReportTask[] {
    return day.tasks.filter(t => taskPasses(t, filters))
}

/** Whether a day has any visible content once filters are applied. */
export function dayVisible(day: ReportDay, filters: TaskFilters): boolean {
    const tasks = filterDayTasks(day, filters)
    if (tasks.length > 0) return true
    // Notes are not filtered by status/category but should respect frog/habit toggles when active.
    if (filters.frogsOnly || filters.habitsOnly || filters.category !== 'all' || filters.search.trim()) return false
    return day.notes.length > 0
}

/** Sort days for the daily breakdown panel. */
export function sortDays(days: ReportDay[], sort: TaskSort): ReportDay[] {
    const arr = [...days]
    switch (sort) {
        case 'date-asc':
            return arr.sort((a, b) => a.date.localeCompare(b.date))
        case 'date-desc':
            return arr.sort((a, b) => b.date.localeCompare(a.date))
        case 'score-desc':
            return arr.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
        case 'tasks-desc':
            return arr.sort((a, b) => b.total - a.total || b.date.localeCompare(a.date))
        default:
            return arr
    }
}