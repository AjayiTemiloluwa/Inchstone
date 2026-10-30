import type { Task } from '@/stores/hierarchyStore'
import type { GoogleEventView } from './types'

const stamp = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0)

/**
 * Collapse rows that describe the same deed on the same day (same title and
 * time slot). Older saves of a recurring deed could leave stacked copies; this
 * keeps the page readable regardless. A completed copy wins over a pending one.
 */
export function dedupeTasks(tasks: Task[]): Task[] {
  const byKey = new Map<string, Task>()
  for (const t of tasks) {
    const key = [t.title.trim().toLowerCase(), stamp(t.startTime), stamp(t.endTime), !!t.isHabit].join('|')
    const kept = byKey.get(key)
    if (!kept || (!kept.completed && t.completed)) byKey.set(key, t)
  }
  return Array.from(byKey.values())
}

/** Same idea for Google events: identical title + slot is one event. */
export function dedupeGoogleEvents(events: GoogleEventView[]): GoogleEventView[] {
  const seen = new Set<string>()
  return events.filter(e => {
    const key = [e.title.trim().toLowerCase(), stamp(e.startTime), stamp(e.endTime)].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Hide Google events that duplicate a scheduled deed already on the day. */
export function withoutDeedMirrors(events: GoogleEventView[], tasks: Task[]): GoogleEventView[] {
  const taken = new Set(
    tasks.filter(t => t.startTime && t.endTime).map(t => `${t.title.trim().toLowerCase()}|${stamp(t.startTime)}|${stamp(t.endTime)}`),
  )
  return events.filter(e => !taken.has(`${e.title.trim().toLowerCase()}|${stamp(e.startTime)}|${stamp(e.endTime)}`))
}
