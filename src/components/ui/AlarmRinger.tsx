'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, X, Clock3, Clock, Star, Activity, Check } from 'lucide-react'
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
  kind: 'countdown' | 'reminder' | 'start' | 'ending' | 'finish'
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
  const [finishToast, setFinishToast] = useState<{ id: string; title: string; kind: 'ending' | 'finish' } | null>(null)
  const finishFired = useRef<Set<string>>(new Set())
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

  /** Two-note chime — the light "almost done" warning before the end. */
  const startEndingSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const notes = [1318.51, 1046.5] // E6 → C6 — a gentle "heads-up" pair
      notes.forEach((f, i) => {
        const t0 = ctx.currentTime + i * 0.16
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02)
        g.gain.setValueAtTime(0.14, t0 + 0.16)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42)
        o.connect(g).connect(ctx.destination)
        o.start(t0)
        o.stop(t0 + 0.5)
      })
      navigator.vibrate?.([100, 50, 100])
      window.setTimeout(() => { ctx.close().catch(() => {}) }, 1100)
    } catch {
      /* audio unavailable — toast + notification still appear */
    }
  }, [])

  /** Short, soft single-note chime — the light "deed finished" alarm. */
  const startFinishSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 1046.5 // C6 — bright but gentle
      const t0 = ctx.currentTime
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02)
      g.gain.setValueAtTime(0.16, t0 + 0.22)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5)
      o.connect(g).connect(ctx.destination)
      o.start(t0)
      o.stop(t0 + 0.6)
      navigator.vibrate?.([120, 60, 120])
      // One-shot context — release it when the note ends.
      window.setTimeout(() => { ctx.close().catch(() => {}) }, 900)
    } catch {
      /* audio unavailable — toast + notification still appear */
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

        // Light end-of-deed alarms — handled as quiet toasts + short chimes, NOT a
        // full-screen takeover, so they never bulldoze real work.
        //  · 'ending' — fires ~10 min (or the chosen lead) BEFORE the end.
        //  · 'finish' — fires the instant the end time runs out.
        const toastDue = due.find(
          (t): t is DueTask & { kind: 'ending' | 'finish' } =>
            (t.kind === 'ending' || t.kind === 'finish') &&
            !finishFired.current.has(`${t.taskId}:${t.kind}`) &&
            !dismissed.current.has(`${t.taskId}:${t.kind}`)
        )
        if (toastDue) {
          finishFired.current.add(`${toastDue.taskId}:${toastDue.kind}`)
          stampTask(toastDue.taskId, toastDue.kind)
          setFinishToast({ id: toastDue.taskId, title: toastDue.title, kind: toastDue.kind })
          if (toastDue.kind === 'ending') startEndingSound()
          else startFinishSound()
          window.setTimeout(() => {
            setFinishToast(prev => (prev?.id === toastDue.taskId ? null : prev))
          }, 5000)
        }

        // Regular alarm (start / important reminder) — full-screen.
        const next = due.find(t => t.kind !== 'finish' && !dismissed.current.has(`${t.taskId}:${t.kind}`))
        if (next) {
          ringingAnyRef.current = true
          setRingingTask(next)
          startSound()
        }
      }
    } catch {
      /* offline — cron push still covers background delivery */
    }
  }, [startSound, startFinishSound, stampTask])

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

  // ── Light end-of-deed toasts ("almost done" / "time's up") ─────────────
  // Quiet, auto-dismissing pills — never block the screen.
  if (finishToast && !ringing && !ringingTask) {
    const isEnding = finishToast.kind === 'ending'
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 lg:bottom-10">
        <div className={`flex items-center gap-2.5 rounded-full border bg-surface-solid px-4 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] animate-fadeIn ${isEnding ? 'border-gold/40' : 'border-moss/40'}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isEnding ? 'bg-gold/20' : 'bg-moss/20'}`}>
            {isEnding ? (
              <Clock className="h-3.5 w-3.5 text-gold" strokeWidth={2.5} />
            ) : (
              <Check className="h-3.5 w-3.5 text-moss" strokeWidth={3} />
            )}
          </span>
          <p className="text-sm font-semibold text-parchment">
            {isEnding ? (
              <span className="text-gold">Almost done: </span>
            ) : (
              <span className="text-moss">Deed finished: </span>
            )}
            {finishToast.title}
          </p>
        </div>
      </div>
    )
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