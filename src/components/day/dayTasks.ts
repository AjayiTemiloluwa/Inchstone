import type { Item, Task } from '@/stores/hierarchyStore'
import { dedupeTasks } from './dedupe'

/** The calendar day a task is on, as the Day page reads it (the date part of the stored instant). */
export const taskDayKey = (t: Pick<Task, 'date'>) => new Date(t.date).toISOString().substring(0, 10)

/**
 * Every deed on one day: ANY task whose date is that day, wherever it hangs in the plan (a day's own
 * goal, a habit under a yearly goal, a deed pinned to a week…). This is the single definition the Day
 * page, the Week board and anything else that lists "today's tasks" must share, so they can never
 * disagree about what is on a day.
 *
 * @param items every item of the plan, flattened (useHierarchyStore().getFlatItems())
 * @param dateStr the day as yyyy-MM-dd
 */
export function tasksOnDay(items: Item[], dateStr: string): Task[] {
  const seen = new Set<string>()
  const out: Task[] = []
  for (const item of items) {
    for (const t of item.tasks ?? []) {
      if (seen.has(t.id) || taskDayKey(t) !== dateStr) continue
      seen.add(t.id)
      out.push(t)
    }
  }
  // Same tidy-up the Day page applies (stacked copies of one recurring deed collapse into one), then timed deeds first, in order.
  return dedupeTasks(out).sort((a, b) => {
    const at = a.startTime ? new Date(a.startTime).getTime() : Infinity
    const bt = b.startTime ? new Date(b.startTime).getTime() : Infinity
    return at - bt || a.title.localeCompare(b.title)
  })
}

/** 0–100: weight-averaged completion of a day's deeds (a deed with partial progress counts that share). */
export function dayScoreOf(tasks: Task[]): number {
  const total = tasks.reduce((s, t) => s + (t.weight || 0), 0)
  if (total <= 0) return tasks.length ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0
  const earned = tasks.reduce((s, t) => s + (t.completed ? t.weight : ((t.progress || 0) / 100) * t.weight), 0)
  return Math.round((earned / total) * 100)
}
