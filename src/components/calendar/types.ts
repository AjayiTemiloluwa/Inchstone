export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  source: 'google' | 'local'
  color?: string
  description?: string
  type?: 'event' | 'task'
  completed?: boolean
  scheduledTime?: string
  score?: number
}

export interface DayGoal {
  itemId: string
  title: string
  description?: string
}

export interface DailyTask {
  id: string
  title: string
  scheduledTime?: string
  completed: boolean
  score?: number
}