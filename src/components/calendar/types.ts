export interface DayGoal {
  itemId: string
  title: string
  description?: string
}

// Keep for backward compatibility with the calendar types used elsewhere
export type { Item, Task } from '@/store/hierarchyStore'