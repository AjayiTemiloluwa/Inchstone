import type { Item } from '@/stores/hierarchyStore'

const QUARTERS = [
  { title: 'Q1 Objective', startMonth: 0, endMonth: 2 },
  { title: 'Q2 Objective', startMonth: 3, endMonth: 5 },
  { title: 'Q3 Objective', startMonth: 6, endMonth: 8 },
  { title: 'Q4 Objective', startMonth: 9, endMonth: 11 },
]

interface CreateGoalOptions {
  categoryId: string
  title: string
  weight: number
  yearItem: Item | null | undefined
  /** Used when the year item has no dates of its own. */
  fallbackStart?: string
  fallbackEnd?: string
  /** Calendar year for the quarter windows (defaults to the year item's start). */
  year?: number
}

/**
 * Create a yearly goal in a category plus its four quarter objectives.
 * Returns the new goal (undefined when the API did not report success).
 */
export async function createYearlyGoalWithQuarters({
  categoryId, title, weight, yearItem, fallbackStart, fallbackEnd, year: yearOverride,
}: CreateGoalOptions): Promise<Item | undefined> {
  const now = new Date().toISOString()
  const goalRes = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      layer: 2,
      parentId: categoryId,
      title,
      weight,
      startDate: yearItem?.startDate || fallbackStart || now,
      endDate: yearItem?.endDate || fallbackEnd || now,
    }),
  })
  const goalData: { success?: boolean; item?: Item } = await goalRes.json()
  const goal = goalData.success ? goalData.item : undefined
  if (!goal) return undefined

  const year = yearOverride ?? new Date(yearItem?.startDate || now).getFullYear()
  await Promise.all(QUARTERS.map(q => fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      layer: 3, parentId: goal.id, title: q.title, weight: 25,
      startDate: new Date(year, q.startMonth, 1).toISOString(),
      endDate: new Date(year, q.endMonth + 1, 0).toISOString(),
    }),
  })))
  return goal
}
