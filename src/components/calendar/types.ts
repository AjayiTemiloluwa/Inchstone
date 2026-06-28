export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  source: 'google' | 'local'
  color?: string
  description?: string
}

export interface DayGoal {
  itemId: string
  title: string
  description?: string
}
