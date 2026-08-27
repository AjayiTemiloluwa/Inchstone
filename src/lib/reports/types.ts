export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface ReportTask {
    id: string
    title: string
    weight: number
    completed: boolean
    categoryId: string | null
    categoryTitle?: string | null
    priority: string | null
    isFrog: boolean
    isHabit: boolean
    estimatedDuration: number | null
    actualDuration: number | null
    goalTitle?: string | null
}

export interface ReportNote {
    id: string
    title: string
    createdAt: string
}

export interface ReportDay {
    date: string
    tasks: ReportTask[]
    notes: ReportNote[]
    score: number
    total: number
    completed: number
    active: boolean
}

export interface ReportCategory {
    id: string | null
    title: string
    total: number
    completed: number
}

export interface ReportPriority {
    priority: string
    total: number
    completed: number
}

export interface ReportStats {
    totalTasks: number
    completedTasks: number
    totalNotes: number
    avgScore: number
    // weighted completion (by task weight)
    weightedCompleted: number
    weightedTotal: number
    completion: number // weighted completion as 0-100 round
    // days
    activeDays: number
    bestDay: string | null
    bestDayScore: number
    worstDay: string | null
    worstDayScore: number // lowest score among *active* days
    // streaks (consecutive days with completed-weight > 0)
    bestStreak: number
    currentStreak: number
    // special tasks
    frogsTotal: number
    frogsCompleted: number
    habitsTotal: number
    habitsCompleted: number
    // time
    totalEstimatedMinutes: number
    totalActualMinutes: number
    avgTasksPerActiveDay: number
}

export interface Report {
    type: ReportType
    period: { start: string; end: string }
    days: ReportDay[]
    stats: ReportStats
    categories: ReportCategory[]
    priorities: ReportPriority[]
}