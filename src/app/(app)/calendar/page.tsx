'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, isToday, getHours } from 'date-fns'
import { CalendarEvent, DayGoal } from '@/components/calendar/types'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { DayPanel } from '@/components/calendar/DayPanel'

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'day' | 'week'>('week')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayGoals, setDayGoals] = useState<Map<string, DayGoal>>(new Map())
  const [dayReports, setDayReports] = useState<Map<string, string>>(new Map())
  const gridRef = useRef<HTMLDivElement>(null)

  // Google Calendar auth check
  useEffect(() => {
    fetch('/api/calendar/events?timeMin=2000-01-01T00:00:00Z&timeMax=2100-01-01T00:00:00Z')
      .then(r => r.json()).then(d => {
        if (d.needsAuth) setGoogleConnected(false)
        else { setGoogleConnected(true); setEvents(d.events || []) }
        setCheckingAuth(false)
      }).catch(() => { setGoogleConnected(false); setCheckingAuth(false) })
  }, [])

  const fetchGoogleEvents = useCallback(async () => {
    const start = new Date(currentDate); start.setDate(start.getDate() - 7)
    const end = new Date(currentDate); end.setDate(end.getDate() + 14)
    const r = await fetch(`/api/calendar/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`)
    const d = await r.json()
    if (!d.needsAuth) {
      setEvents((d.events || []).map((e: any) => ({
        id: e.id || `g-${Date.now()}`,
        title: e.summary || '(No title)',
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        source: 'google' as const,
        description: e.description || ''
      })))
      setGoogleConnected(true)
    }
  }, [currentDate])

  const fetchLocalEvents = useCallback(async () => {
    const start = new Date(currentDate); start.setDate(start.getDate() - 7)
    const end = new Date(currentDate); end.setDate(end.getDate() + 14)
    const r = await fetch(`/api/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
    const d = await r.json()
    if (d.events) {
      const m: CalendarEvent[] = d.events.map((e: any) => ({
        id: e.id, title: e.title, start: e.startTime, end: e.endTime, source: 'local' as const, description: e.comment || ''
      }))
      setEvents(p => [...p.filter(e => e.source !== 'local'), ...m].sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()))
    }
  }, [currentDate])

  useEffect(() => { if (googleConnected) fetchGoogleEvents(); fetchLocalEvents() }, [currentDate, googleConnected, fetchGoogleEvents, fetchLocalEvents])

  const displayDates = (() => {
    if (view === 'day') return [currentDate]
    const s = startOfWeek(currentDate, { weekStartsOn: 0 })
    return Array.from({ length: 7 }, (_, i) => addDays(s, i))
  })()

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getEventsForSlot = useCallback((date: Date, hour?: number) => {
    return events.filter(e => {
      const s = new Date(e.start), en = new Date(e.end)
      const ds = new Date(date); ds.setHours(0,0,0,0)
      const de = new Date(ds); de.setDate(de.getDate() + 1)
      if (s >= de || en <= ds) return false
      if (hour !== undefined) {
        const ss = new Date(date); ss.setHours(hour,0,0,0)
        const se = new Date(date); se.setHours(hour+1,0,0,0)
        return s < se && en > ss
      }
      return true
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [events])

  const navigate = (dir: 'prev' | 'next') => {
    if (view === 'day') setCurrentDate(dir === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1))
    else setCurrentDate(dir === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
  }

  const goToToday = () => setCurrentDate(new Date())

  const handleSlotClick = async (date: Date, hour: number) => {
    const ss = new Date(date); ss.setHours(hour,0,0,0)
    const se = new Date(date); se.setHours(hour+1,0,0,0)
    const title = prompt('Event title:')
    if (!title) return
    setLoading(true)
    try {
      await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, startTime: ss.toISOString(), endTime: se.toISOString() }) })
      await fetchLocalEvents()
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return
    await fetch('/api/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setEvents(p => p.filter(e => e.id !== id))
  }

  const connectGoogle = () => { window.location.href = '/api/calendar/auth' }

  const simulateGoogleSync = () => {
    const fakes: CalendarEvent[] = []
    displayDates.forEach(date => {
      for (let h = 9; h < 17; h++) {
        if (Math.random() > 0.7) {
          const s = new Date(date); s.setHours(h,0,0,0)
          const en = new Date(date); en.setHours(h+1,0,0,0)
          fakes.push({ id: `sim-${date.toISOString()}-${h}`, title: ['Team Meeting','Focus Block','Client Call','Planning','Review'][Math.floor(Math.random()*5)], start: s.toISOString(), end: en.toISOString(), source: 'google' as const })
        }
      }
    })
    setEvents(p => [...p.filter(e => e.source !== 'google'), ...fakes].sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()))
  }

  const openDayPanel = (date: Date) => setSelectedDay(date)
  const updateDayReport = (date: Date, text: string) => setDayReports(p => { const n = new Map(p); n.set(format(date,'yyyy-MM-dd'), text); return n })
  const loadDayReport = (date: Date) => dayReports.get(format(date, 'yyyy-MM-dd')) || ''
  const getDayGoalFor = (date: Date): DayGoal | null => dayGoals.get(format(date, 'yyyy-MM-dd')) || null
  const setDayGoal = (date: Date, goal: DayGoal | null) => {
    const k = format(date, 'yyyy-MM-dd')
    if (goal) setDayGoals(p => { const n = new Map(p); n.set(k, goal); return n })
    else { const n = new Map(dayGoals); n.delete(k); setDayGoals(n) }
  }

  if (checkingAuth) return <div className="flex items-center justify-center h-full"><span className="text-ink/60">Loading calendar...</span></div>

  const dayRangeStr = view === 'day'
    ? format(currentDate, 'EEEE, MMMM d, yyyy')
    : `${format(displayDates[0], 'MMM d')} – ${format(displayDates[6], 'MMM d, yyyy')}`

  const formatHour = (h: number) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`

  return (
    <div className="flex h-full">
      <div className="w-64 bg-surface border-r border-mist p-4 flex flex-col shrink-0">
        <MiniCalendar currentDate={currentDate} onDateClick={setCurrentDate} displayDates={displayDates} events={events} />
        <div className="mt-4 space-y-3">
          <button onClick={goToToday} className="w-full py-2 text-sm font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition">Today</button>
          <div className="flex rounded-lg border border-mist overflow-hidden">
            <button onClick={() => setView('day')} className={`flex-1 py-2 text-sm font-medium transition ${view === 'day' ? 'bg-gold text-surface' : 'bg-surface text-ink hover:bg-mist'}`}>Day</button>
            <button onClick={() => setView('week')} className={`flex-1 py-2 text-sm font-medium transition ${view === 'week' ? 'bg-gold text-surface' : 'bg-surface text-ink hover:bg-mist'}`}>Week</button>
          </div>
        </div>
        {!googleConnected ? (
          <div className="mt-4 border-t border-mist pt-4 space-y-2">
            <p className="text-xs text-ink/60">Connect Google Calendar</p>
            <button onClick={connectGoogle} className="w-full py-2 text-sm font-medium text-white bg-[#4285F4] rounded-lg hover:opacity-90 transition">Connect</button>
            <button onClick={simulateGoogleSync} className="w-full py-2 text-xs text-ink/60 hover:text-ink transition">Demo: Simulate Sync</button>
          </div>
        ) : (
          <div className="mt-4 border-t border-mist pt-4">
            <div className="flex items-center space-x-2 text-xs text-sage"><div className="w-2 h-2 rounded-full bg-sage" /><span>Google Calendar synced</span></div>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-mist bg-surface">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-display font-bold text-ink">{dayRangeStr}</h2>
            <div className="flex items-center space-x-1">
              <button onClick={() => navigate('prev')} className="p-2 hover:bg-mist rounded-full transition"><ChevronLeft className="w-5 h-5 text-ink/70" /></button>
              <button onClick={() => navigate('next')} className="p-2 hover:bg-mist rounded-full transition"><ChevronRight className="w-5 h-5 text-ink/70" /></button>
            </div>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition">Today</button>
          </div>
          {googleConnected && <button onClick={fetchGoogleEvents} className="flex items-center space-x-2 px-3 py-1.5 text-sm text-ink/70 hover:text-ink transition"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /><span>Sync</span></button>}
        </div>
        <div className="flex-1 overflow-y-auto" ref={gridRef}>
          <div className="grid grid-cols-7 min-h-[1440px]">
            {displayDates.map(date => (
              <div key={`col-${date.toISOString()}`} className="col-span-1 relative border-r border-mist/50 last:border-r-0">
                <div className="sticky top-0 z-20 bg-surface/90 backdrop-blur-sm px-2 py-2 text-center border-b-2 border-transparent hover:border-gold cursor-pointer" onClick={() => openDayPanel(date)}>
                  <div className="text-xs text-ink/60 uppercase font-mono">{format(date, 'EEE')}</div>
                  <div className={`text-lg font-bold mt-0.5 ${isToday(date) ? 'w-8 h-8 rounded-full bg-gold text-surface flex items-center justify-center mx-auto' : 'text-ink'}`}>{format(date, 'd')}</div>
                </div>
                {hours.map(hour => {
                  const slotEvents = getEventsForSlot(date, hour)
                  const isCurrent = isToday(date) && getHours(new Date()) === hour
                  return (
                    <div key={hour} className={`border-b border-mist/50 relative h-[60px] ${isCurrent ? 'bg-gold/5' : ''}`}>
                      <div className={`absolute inset-0 z-10 ${slotEvents.length === 0 ? 'cursor-pointer hover:bg-mist/20' : ''} transition-colors`} onClick={() => slotEvents.length === 0 && handleSlotClick(date, hour)} />
                      {slotEvents.map(evt => (
                        <div key={evt.id} className={`absolute left-1 right-1 rounded-md px-2 py-1 cursor-pointer overflow-hidden z-20 text-xs ${evt.source === 'google' ? 'bg-blue-100 border-l-2 border-blue-500 text-blue-900' : 'bg-gold/20 border-l-2 border-gold text-ink'}`} onClick={(e) => { e.stopPropagation(); if (evt.source === 'local') handleDeleteEvent(evt.id) }} title={`${evt.title} (${format(new Date(evt.start), 'h:mm a')} – ${format(new Date(evt.end), 'h:mm a')})`}>
                          <div className="font-medium truncate">{evt.title}</div>
                          <div className="opacity-80">{format(new Date(evt.start), 'h:mm a')}</div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {selectedDay && (
        <DayPanel date={selectedDay} events={getEventsForSlot(selectedDay)} dayGoal={getDayGoalFor(selectedDay)} reportText={loadDayReport(selectedDay)} onClose={() => setSelectedDay(null)} onSetGoal={(g) => setDayGoal(selectedDay, g)} onUpdateReport={(t) => updateDayReport(selectedDay, t)} onRefreshLocalEvents={fetchLocalEvents} />
      )}
    </div>
  )
}

