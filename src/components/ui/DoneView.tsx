'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface DoneTask {
  id: string
  title: string
  completed: boolean
  date: string
  startTime: string | null
  endTime: string | null
  reflection: string | null
  weight: number
  color: string | null
}

interface BottleSummary {
  id: string
  name: string
  emoji?: string | null
  unit?: string | null
}

interface DoneViewProps {
  tasks: DoneTask[]
  onDeleteTask?: (id: string) => void
  className?: string
}

export function DoneView({ tasks, onDeleteTask, className = '' }: DoneViewProps) {
  const [view, setView] = useState<'hour' | 'challenge'>('hour')
  const [bottles, setBottles] = useState<BottleSummary[]>([])
  const [loadingBottles, setLoadingBottles] = useState(false)

  const doneTasks = useMemo(() => tasks.filter(t => t.completed), [tasks])

  const byHour = useMemo(() => {
    const map = new Map<number, DoneTask[]>()
    doneTasks.forEach(t => {
      const hour = t.startTime ? new Date(t.startTime).getHours() : 24
      if (!map.has(hour)) map.set(hour, [])
      map.get(hour)!.push(t)
    })
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [doneTasks])

  const MENTION_RE = /@([^\s@]+)/g
  const byChallenge = useMemo(() => {
    const map = new Map<string, DoneTask[]>()
    doneTasks.forEach(t => {
      const mentions = [...t.reflection?.matchAll(MENTION_RE) || []].map(m => m[1])
      if (mentions.length === 0) {
        if (!map.has('(no challenge)')) map.set('(no challenge)', [])
        map.get('(no challenge)')!.push(t)
        return
      }
      mentions.forEach(name => {
        const key = name.toLowerCase()
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(t)
      })
    })
    return [...map.entries()]
  }, [doneTasks])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoadingBottles(true)
      try {
        const res = await fetch('/api/bottles')
        if (res.ok) {
          const data = await res.json()
          setBottles((data.bottles || []).map((b: any) => ({
            id: b.id,
            name: b.name,
            emoji: b.emoji,
            unit: b.unit,
          })))
        }
      } catch {
        /* non-fatal */
      } finally {
        setLoadingBottles(false)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const bottleFor = (name: string) => bottles.find(b => b.name.toLowerCase() === name.toLowerCase())

  const handleDelete = async (id: string) => {
    if (!onDeleteTask) return
    try {
      await onDeleteTask(id)
    } catch {
      /* errors surfaced by caller */
    }
  }

  const hourLabel = (hour: number) => {
    if (hour === 24) return 'Unscheduled'
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-display font-bold text-ink uppercase tracking-wider">Done today</h2>
        <p className="text-[10px] text-ink/40 font-mono">{doneTasks.length} completed</p>
      </div>

      <div className="flex items-center gap-2 border border-white/10 rounded-lg bg-black/10 p-1">
        <button
          onClick={() => setView('hour')}
          className={`flex-1 sm:flex-none min-h-[40px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${
            view === 'hour'
              ? 'bg-gold/10 text-gold border border-gold/30'
              : 'text-ink/50 hover:text-ink hover:bg-white/5'
          }`}
        >
          <Clock className="w-3 h-3 shrink-0" /> By hour
        </button>
        <button
          onClick={() => setView('challenge')}
          className={`flex-1 sm:flex-none min-h-[40px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition ${
            view === 'challenge'
              ? 'bg-gold/10 text-gold border border-gold/30'
              : 'text-ink/50 hover:text-ink hover:bg-white/5'
          }`}
        >
          <FlaskConical className="w-3 h-3 shrink-0" /> By challenge
        </button>
      </div>

      {view === 'hour' && (
        <div className="space-y-2">
          {byHour.length === 0 && (
            <p className="text-[10px] text-ink/40 text-center py-4">No completed deeds yet today.</p>
          )}
          {byHour.map(([hour, tasks]) => (
            <div key={hour} className="space-y-1.5">
              <div className="flex items-center gap-2 px-2">
                <span className="text-[9px] font-bold text-ink/40 font-mono">{hourLabel(hour)}</span>
                <span className="ml-auto text-[9px] font-mono text-ink/30">{tasks.length} deed{tasks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1">
                {tasks.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-black/20 hover:border-gold/40 transition group"
                  >
                    <CheckIcon completed={true} />
                    <span className={`flex-1 min-w-0 text-sm ${t.completed ? 'line-through text-ink/50' : 'text-ink'}`}>
                      {t.title}
                    </span>
                    {t.startTime && (
                      <span className="text-[10px] font-mono text-ink/40 shrink-0">
                        {format(parseISO(t.startTime), 'h:mm a')}
                      </span>
                    )}
                    {t.reflection && (
                      <span
                        className="hidden sm:block max-w-[40%] truncate text-[10px] text-ink/30 italic shrink-0"
                        title={t.reflection}
                      >
                        “{t.reflection.length > 40 ? t.reflection.slice(0, 40) + '…' : t.reflection}”
                      </span>
                    )}
                    {onDeleteTask && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(t.id) }}
                        className="p-1.5 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-ember/15 rounded transition text-ink/30 hover:text-[#cf8f78] shrink-0"
                        title="Delete"
                      >
                        <DelIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'challenge' && (
        <div className="space-y-2">
          {byChallenge.length === 0 && (
            <p className="text-[10px] text-ink/40 text-center py-4">No completed deeds with challenges yet.</p>
          )}
          {byChallenge.map(([challengeName, tasks]) => {
            const bottle = bottleFor(challengeName)
            const label = challengeName === '(no challenge)' ? 'No challenge' : `@${challengeName}`
            return (
              <div key={challengeName} className="space-y-1.5">
                <div className="flex items-center gap-2 px-2">
                  {bottle?.emoji && <span className="shrink-0">{bottle.emoji}</span>}
                  <span className="text-[9px] font-bold text-ink/40">{label}</span>
                  <span className="ml-auto text-[9px] font-mono text-ink/30">{tasks.length} deed{tasks.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1">
                  {tasks.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-black/20 hover:border-gold/40 transition group"
                    >
                      <CheckIcon completed={true} />
                      <span className={`flex-1 min-w-0 text-sm ${t.completed ? 'line-through text-ink/50' : 'text-ink'}`}>{t.title}</span>
                      {t.startTime && (
                        <span className="text-[10px] font-mono text-ink/40 shrink-0">
                          {format(parseISO(t.startTime), 'h:mm a')}
                        </span>
                      )}
                      {onDeleteTask && (
                        <button
                          onClick={(e) => { e.stopPropagation(); void handleDelete(t.id) }}
                          className="p-1.5 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-ember/15 rounded transition text-ink/30 hover:text-[#cf8f78] shrink-0"
                          title="Delete"
                        >
                          <DelIcon />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {loadingBottles && view === 'challenge' && (
        <p className="text-[10px] text-ink/40 text-center py-2">Loading challenges…</p>
      )}
    </section>
  )
}

function CheckIcon({ completed }: { completed: boolean }) {
  return (
    completed ? (
      <span className="w-4 h-4 text-sage"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg></span>
    ) : (
      <span className="w-4 h-4 text-ink/30"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/></svg></span>
    )
  )
}

function DelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
