// Shared types for the Long-Term Plans module.
// Dates arrive over JSON as ISO strings; month fields are "YYYY-MM" keys.

export const GOAL_STATUSES = ['not_started', 'in_progress', 'at_risk', 'achieved'] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export const REVIEW_CADENCES = ['weekly', 'monthly', 'quarterly', 'biannual', 'annual'] as const
export type ReviewCadence = (typeof REVIEW_CADENCES)[number]

export const CADENCE_LABELS: Record<ReviewCadence, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  biannual: 'Biannual',
  annual: 'Annual',
}

export interface PlanMilestoneRecord {
  id: string
  goalId: string
  title: string
  targetDate: string
  status: GoalStatus
  notes: string | null
  linkedItemId: string | null
}

export interface PlanGoalRecord {
  id: string
  sectionId: string
  overallGoal: string | null
  developmentOpportunity: string | null
  actionsPlanned: string | null
  resourcesAndSupport: string | null
  successCriteria: string | null
  startDate: string
  targetDate: string
  status: GoalStatus
  isDraft: boolean
  archived: boolean
  orderIndex: number
  linkedItemId: string | null
  milestones?: PlanMilestoneRecord[]
}

export interface PlanSectionRecord {
  id: string
  planId: string
  name: string
  description: string | null
  orderIndex: number
  goals?: PlanGoalRecord[]
}

export interface ReviewSessionRecord {
  id: string
  planId: string
  conductedAt: string
  summaryNote: string | null
}

export interface LongTermPlanRecord {
  id: string
  title: string
  startMonth: string
  endMonth: string
  anchorNote: string | null
  reviewCadence: ReviewCadence
  createdAt: string
  updatedAt: string
  sections?: PlanSectionRecord[]
  reviewSessions?: ReviewSessionRecord[]
}

/** A plan as listed on the /plans dashboard: tree included but light */
export interface PlanSummary extends LongTermPlanRecord {
  sections: PlanSectionRecord[]
  reviewSessions: ReviewSessionRecord[]
}

export interface StatusLogEntryRecord {
  id: string
  parentType: 'goal' | 'milestone'
  parentId: string
  oldStatus: string | null
  newStatus: string
  note: string | null
  loggedAt: string
}

export interface StatusCounts {
  total: number
  notStarted: number
  inProgress: number
  atRisk: number
  achieved: number
}