'use client'

import { isToday, isSameDay, format, addDays, subMonths, addMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CalendarEvent } from './types'

interface MiniCalendarProps {
  currentDate: Date
  onDateClick: (d: Date) => void
  displayDates: Date[]
  events: CalendarEvent[]
}

export function MiniCalendar({ currentDate, onDateClick, displayDates, events }: MiniCalendarProps) {
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const startDate = new Date(monthStart)
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7))
  const days: Date[] = []
  const d = new Date(startDate)
  while (d <= monthEnd || days.length < 42) { days.push(new Date(d)); d.setDate(d.getDate() + 1); if (days.length >= 42) break }

  const hasEvent = (date: Date) => events.some(e => {
    const ds = new Date(date); ds.setHours(0,0,0,0)
    const de = new Date(ds); de.setDate(de.getDate()+1)
    const es = new Date(e.start); return es >= ds && es < de
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold text-ink text-sm">{format(currentDate, 'MMMM yyyy')}</div>
        <div className="flex space-x-1">
          <button onClick={() => onDateClick(subMonths(currentDate, 1))} className="p-1 hover:bg-mist rounded"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => onDateClick(addMonths(currentDate, 1))} className="p-1 hover:bg-mist rounded"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-ink/60 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 text-center text-sm">
        {days.map((date, i) => {
          const inMonth = date.getMonth() === currentDate.getMonth()
          const isTodayDate = isToday(date)
          const isSelected = displayDates.some(dd => isSameDay(dd, date))
          const hasEvt = hasEvent(date)
          return (
            <button key={i} onClick={() => onDateClick(date)} className={`relative py-1.5 rounded-md transition ${!inMonth ? 'text-ink/30' : 'text-ink hover:bg-mist'} ${isTodayDate ? 'font-bold text-gold' : ''} ${isSelected ? 'bg-gold/20 ring-1 ring-gold' : ''}`}>
              {date.getDate()}
              {hasEvt && <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isTodayDate ? 'bg-gold' : 'bg-coral'}`} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
