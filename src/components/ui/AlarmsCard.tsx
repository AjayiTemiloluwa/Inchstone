'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, AlarmClock } from 'lucide-react'

/**
 * AlarmsCard — manage scheduled alarms in Settings. Alarms fire as web
 * push notifications when the app is closed (Vercel cron) and ring
 * in-app with sound when it's open (AlarmRinger).
 */

interface Alarm {
  id: string
  title: string
  time: string
  days: string
  enabled: boolean
  nextFire: string | null
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function AlarmsCard() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('07:00')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/alarms', { cache: 'no-store' })
      if (res.ok) setAlarms((await res.json()).alarms)
    } catch {
      /* ignore */
    }
  }, [])

  // Initial fetch — async IIFE so no setState runs synchronously in the effect.
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const res = await fetch('/api/alarms', { cache: 'no-store' })
        if (live && res.ok) setAlarms((await res.json()).alarms)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const create = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, time, days, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      if (res.ok) {
        setTitle('')
        load()
      }
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (a: Alarm) => {
    await fetch(`/api/alarms/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    })
    load()
  }

  const remove = async (id: string) => {
    await fetch(`/api/alarms/${id}`, { method: 'DELETE' })
    load()
  }

  const daySet = (a: Alarm) => new Set(a.days.split(',').map(Number))

  return (
    <div className="space-y-3">
      {/* Add form */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="Alarm name (e.g. Morning prayer)…"
          className="flex-1 px-3.5 py-2.5 text-sm bg-black/25 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-parchment/30 min-h-[44px]"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="px-3 py-2.5 text-sm bg-black/25 border border-white/10 rounded-xl text-parchment focus:outline-none focus:ring-2 focus:ring-gold/30 min-h-[44px]"
        />
        <button
          onClick={create}
          disabled={busy || !title.trim()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-gold/15 text-gold border border-gold/30 rounded-xl hover:bg-gold/25 disabled:opacity-40 active:opacity-70 transition min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Day picker */}
      <div className="flex gap-1.5">
        {DAY_LABELS.map((d, i) => {
          const on = days.includes(i)
          return (
            <button
              key={i}
              onClick={() => setDays(on ? days.filter(x => x !== i) : [...days, i])}
              className={`h-9 w-9 rounded-full text-xs font-bold transition active:opacity-70 ${
                on ? 'bg-gold text-ink' : 'bg-white/5 text-parchment/40 border border-white/10'
              }`}
            >
              {d}
            </button>
          )
        })}
      </div>

      {/* List */}
      {alarms.length === 0 ? (
        <p className="text-sm text-parchment/40 italic flex items-center gap-2 pt-1">
          <AlarmClock className="h-4 w-4" /> No alarms yet — add one above.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {alarms.map(a => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <span className="font-display text-2xl tabular-nums text-parchment w-[72px]">{a.time}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-parchment truncate">{a.title}</p>
                <p className="text-[11px] text-parchment/40 font-mono">
                  {a.days.split(',').length === 7
                    ? 'Every day'
                    : [...daySet(a)].sort().map(i => DAY_LABELS[i]).join(' ')}
                  {a.enabled && a.nextFire && ` · next ${new Date(a.nextFire).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
              <button
                onClick={() => toggle(a)}
                className={`relative h-6 w-11 rounded-full transition ${a.enabled ? 'bg-gold' : 'bg-white/15'}`}
                aria-label={a.enabled ? 'Disable alarm' : 'Enable alarm'}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    a.enabled ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
              <button
                onClick={() => remove(a.id)}
                className="p-2 text-parchment/40 hover:text-ember transition"
                aria-label="Delete alarm"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}