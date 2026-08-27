'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BellRing, X, Clock3 } from 'lucide-react'

/**
 * AlarmRinger — the foreground half of the alarm system. Polls /api/alarms
 * and, when the server reports one is due, rings: a looping three-note chime
 * (Web Audio, no asset needed), device vibration, and a full-screen takeover
 * with Dismiss / Snooze. The background half is the Vercel cron → web push
 * pipeline, which fires even when the PWA is closed.
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

const DAY_MS = 24 * 60 * 60 * 1000

export function AlarmRinger() {
  const [ringing, setRinging] = useState<Alarm | null>(null)
  const dismissed = useRef<Set<string>>(new Set())
  const audioRef = useRef<{ ctx: AudioContext; timer: number } | null>(null)

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

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/alarms', { cache: 'no-store' })
      if (!res.ok) return
      const { alarms } = (await res.json()) as { alarms: Alarm[] }
      const due = alarms.find(
        a => a.due && !dismissed.current.has(`${a.id}:${a.nextFire ? new Date(a.nextFire).getTime() : 0}`)
      )
      if (due && !ringing) {
        setRinging(due)
        startSound()
      }
    } catch {
      /* offline — cron push still covers background delivery */
    }
  }, [ringing, startSound])

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

  const dismiss = () => {
    if (ringing) {
      const key = `${ringing.id}:${ringing.nextFire ? new Date(ringing.nextFire).getTime() : 0}`
      dismissed.current.add(key)
      // Self-heal: drop keys older than a day so the set can't grow forever.
      const cutoff = Date.now() - DAY_MS
      dismissed.current = new Set(
        [...dismissed.current].filter(k => parseInt(k.split(':')[1] || '0', 10) > cutoff)
      )
    }
    stopSound()
    setRinging(null)
  }

  const snooze = async () => {
    if (ringing) await fetch(`/api/alarms/${ringing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snooze' }),
    }).catch(() => {})
    stopSound()
    setRinging(null)
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