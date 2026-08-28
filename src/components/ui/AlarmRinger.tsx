'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, X, Clock3, Star, Activity } from 'lucide-react'
import { useCountdown, formatCountdown, compactCountdownLabel } from '@/lib/useCountdown'

/**
 * AlarmRinger — the foreground half of the alarm + deed-reminder system.
 * Polls /api/alarms (recurring alarms) and /api/tasks/due (deed reminders:
 * the very-important alarm and the starting-now cue) and, when one is due,
 * rings: a looping three-note chime (Web Audio, no asset needed), device
 * vibration, and a full-screen takeover with Dismiss / Snooze / Open.
 * The background half is the external cron → web push pipeline, which fires
 * even when the PWA is closed.
 */

interface Alarm {
  id: string
  title: string
  time: string
  days: string
  enabled: boolean
  nextFire: string | null
  due: boolean
}

interface DueTask {
  taskId: string
  kind: 'countdown' | 'reminder' | 'start'
  title: string
  startTime: string | null
  endTime: string | null
  reminderMinutes: number | null
  isImportant: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

export function AlarmRinger() {
  const router = useRouter()
  const [ringing, setRinging] = useState<Alarm | null>(null)
  const [ringingTask, setRingingTask] = useState<DueTask | null>(null)
  const ringingAnyRef = useRef(false)
  const dismissed = useRef<Set<string>>(new Set())
  const audioRef = useRef<{ ctx: AudioContext; timer: number } | null>(null)
  const countdownNow = useCountdown()

  const stopSound = useCallback(() => {
    if (audioRef.current) {
      window.clearInterval(audioRef.current.timer)
      audioRef.current.ctx.close().catch(() => {})
      audioRef.current = null
    }
  }, [])

  const startSound = useCallback(() => {
    if (audioRef.current) return
    try {
      const Ctx = window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const notes = [880, 1108.73, 1318.51] // A5 · C#6 · E6 — bright major arpeggio
      const ring = () => {
        navigator.vibrate?.([380, 160, 380])
        notes.forEach((f, i) => {
          const t = ctx.currentTime + i * 0.18
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'sine'
          o.frequency.value = f
          g.gain.setValueAtTime(0.0001, t)
          g.gain.exponentialRampToValueAtTime(0.22, t + 0.03)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
          o.connect(g).connect(ctx.destination)
          o.start(t)
          o.stop(t + 0.6)
        })
      }
      ring()
      const timer = window.setInterval(ring, 2400)
      audioRef.current = { ctx, timer }
    } catch {
      /* audio unavailable — vibration + UI still fire */
    }
  }, [])

  const stampTask = useCallback((taskId: string, kind: string) => {
    // Tell the server this deed notification was delivered, so the cron
    // pusher won't fire it again once the in-app ring has been handled.
    fetch('/api/tasks/due', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, kind }),
    }).catch(() => {})
  }, [])

  const check = useCallback(async () => {
    if (ringingAnyRef.current) return
    try {
      const res = await fetch('/api/alarms', { cache: 'no-store' })
      if (res.ok) {
        const { alarms } = (await res.json()) as { alarms: Alarm[] }
        const due = alarms.find(
          a => a.due && !dismissed.current.has(`${a.id}:${a.nextFire ? new Date(a.nextFire).getTime() : 0}`)
        )
        if (due) {
          ringingAnyRef.current = true
          setRinging(due)
          startSound()
          return
        }
      }
    } catch {
      /* offline — cron push still covers background delivery */
    }
    try {
      const res = await fetch('/api/tasks/due', { cache: 'no-store' })
      if (res.ok) {
        const { due } = (await res.json()) as { due: DueTask[] }
        const next = due.find(t => !dismissed.current.has(`${t.taskId}:${t.kind}`))
        if (next) {
          ringingAnyRef.current = true
          setRingingTask(next)
          startSound()
        }
      }
    } catch {
      /* offline — cron push still covers background delivery */
    }
  }, [startSound])

  useEffect(() => {
    check()
    const poll = window.setInterval(check, 20000)
    const wake = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', wake)
    return () => {
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', wake)
      stopSound()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearRinging = () => {
    ringingAnyRef.current = false
    stopSound()
  }

  const dismiss = () => {
    if (ringing) {
      const key = `${ringing.id}:${ringing.nextFire ? new Date(ringing.nextFire).getTime() : 0}`
      dismissed.current.add(key)
      // Ack: tell the server this occurrence was delivered so it advances
      // nextFire — otherwise a due alarm rings again on every reload/poll.
      fetch(`/api/alarms/${ringing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack' }),
      }).catch(() => {})
      // Self-heal: drop keys older than a day so the set can't grow forever.
      const cutoff = Date.now() - DAY_MS
      dismissed.current = new Set(
        [...dismissed.current].filter(k => {
          const stamp = parseInt(k.split(':')[1] || '', 10)
          return Number.isNaN(stamp) || stamp > cutoff // NaN = deed keys (no stamp)
        })
      )
    }
    clearRinging()
    setRinging(null)
  }

  const dismissTask = () => {
    if (ringingTask) {
      dismissed.current.add(`${ringingTask.taskId}:${ringingTask.kind}`)
      stampTask(ringingTask.taskId, ringingTask.kind)
    }
    clearRinging()
    setRingingTask(null)
  }

  const openTask = () => {
    if (ringingTask) {
      const day = ringingTask.startTime
        ? new Date(ringingTask.startTime).toISOString().substring(0, 10)
        : null
      dismissed.current.add(`${ringingTask.taskId}:${ringingTask.kind}`)
      stampTask(ringingTask.taskId, ringingTask.kind)
      clearRinging()
      setRingingTask(null)
      if (day) router.push(`/day/${day}`)
      return
    }
    clearRinging()
    setRingingTask(null)
  }

  const snooze = async () => {
    if (ringing) await fetch(`/api/alarms/${ringing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snooze' }),
    }).catch(() => {})
    clearRinging()
    setRinging(null)
  }

  if (!ringing && !ringingTask) return null

  // ── Deed ring: very-important reminder alarm / starting-now cue ────────
  if (ringingTask) {
    const start = ringingTask.startTime ? new Date(ringingTask.startTime) : null
    const end = ringingTask.endTime ? new Date(ringingTask.endTime) : null
    const parts = start ? formatCountdown(countdownNow, start, end) : null
    const headline =
      ringingTask.kind === 'start' ? 'Starting now' : ringingTask.kind === 'reminder' ? 'Very important' : 'Countdown'
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
        <div className="w-full max-w-sm rounded-3xl border border-gold/25 bg-[#161311]/95 p-8 text-center shadow-[0_0_80px_rgba(212,175,55,0.25)]">
          {ringingTask.isImportant ? (
            <Star className="mx-auto h-10 w-10 fill-gold text-gold animate-bounce" />
          ) : (
            <Activity className="mx-auto h-10 w-10 text-gold animate-bounce" />
          )}
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-parchment/40">{headline}</p>
          <p className="mt-2 font-display text-2xl leading-snug text-parchment">{ringingTask.title}</p>
          {start && parts && (
            <p className={`mt-3 font-mono text-3xl tabular-nums ${parts.state === 'live' ? 'text-sage' : 'text-gold'}`}>
              {compactCountdownLabel(parts)}
            </p>
          )}
          {start && (
            <p className="mt-1 font-mono text-xs text-parchment/45">
              {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {end ? ` – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <button
              onClick={openTask}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-medium text-parchment/80 hover:bg-white/10 active:opacity-70 transition"
            >
              <Clock3 className="h-4 w-4" /> Open day
            </button>
            <button
              onClick={dismissTask}
              className="flex-1 rounded-xl bg-gold py-3.5 text-sm font-bold text-ink hover:bg-[#cbaa6f] active:opacity-70 transition"
            >
              <span className="inline-flex items-center gap-1.5"><X className="h-4 w-4" /> Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!ringing) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <div className="w-full max-w-sm rounded-3xl border border-gold/25 bg-[#161311]/95 p-8 text-center shadow-[0_0_80px_rgba(212,175,55,0.25)]">
        <BellRing className="mx-auto h-10 w-10 text-gold animate-bounce" />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-parchment/40">Alarm</p>
        <p className="mt-1 font-display text-6xl tabular-nums text-parchment">{ringing.time}</p>
        <p className="mt-3 text-lg text-parchment/85">{ringing.title}</p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={snooze}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-medium text-parchment/80 hover:bg-white/10 active:opacity-70 transition"
          >
            <Clock3 className="h-4 w-4" /> Snooze 5m
          </button>
          <button
            onClick={dismiss}
            className="flex-1 rounded-xl bg-gold py-3.5 text-sm font-bold text-ink hover:bg-[#cbaa6f] active:opacity-70 transition"
          >
            <span className="inline-flex items-center gap-1.5"><X className="h-4 w-4" /> Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  )
}