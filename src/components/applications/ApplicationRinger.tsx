'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, X } from 'lucide-react'

/**
 * Foreground half of the application deadline alarm. Polls
 * /api/applications/due every minute; when a reminder is due it chimes and
 * shows a card with Open / Dismiss. Either button stamps the reminder so the
 * push cron (the background half) does not send it again.
 */

interface Due {
  id: string
  title: string
  organization: string | null
  deadline: string
  offset: number
  message: string
}

const POLL_MS = 60_000

export function ApplicationRinger() {
  const router = useRouter()
  const [due, setDue] = useState<Due | null>(null)
  const showing = useRef(false)
  const handled = useRef<Set<string>>(new Set())

  const chime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      ;[659.25, 880, 1108.73, 880].forEach((f, i) => {
        const t = ctx.currentTime + i * 0.2
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.2, t + 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
        o.connect(g).connect(ctx.destination)
        o.start(t)
        o.stop(t + 0.55)
      })
      navigator.vibrate?.([300, 120, 300])
      window.setTimeout(() => { ctx.close().catch(() => {}) }, 1600)
    } catch {
      /* audio unavailable: the card still shows */
    }
  }, [])

  const check = useCallback(async () => {
    if (showing.current) return
    try {
      const res = await fetch('/api/applications/due', { cache: 'no-store' })
      if (!res.ok) return
      const { due: list } = (await res.json()) as { due: Due[] }
      const next = list.find((d) => !handled.current.has(`${d.id}:${d.offset}`))
      if (next) {
        showing.current = true
        setDue(next)
        chime()
      }
    } catch {
      /* offline: the push cron still covers it */
    }
  }, [chime])

  useEffect(() => {
    const first = window.setTimeout(check, 4000)
    const id = window.setInterval(check, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  const close = (open: boolean) => {
    if (!due) return
    handled.current.add(`${due.id}:${due.offset}`)
    fetch('/api/applications/due', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: due.id, offset: due.offset }),
    }).catch(() => {})
    const target = `/challenge/applications/${due.id}`
    setDue(null)
    showing.current = false
    if (open) router.push(target)
  }

  if (!due) return null
  const urgent = due.offset <= 1440
  const deadline = new Date(due.deadline)

  return (
    <div
      className={urgent
        ? 'fixed inset-0 z-[94] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md'
        : 'pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 lg:bottom-10'}
    >
      <div
        role="alertdialog"
        aria-labelledby="app-ring-title"
        className={urgent
          ? 'w-full max-w-sm rounded-3xl border border-gold/25 bg-surface-solid p-8 text-center shadow-[0_0_80px_rgb(var(--gold-rgb)_/_0.25)] animate-fadeIn'
          : 'pointer-events-auto w-full max-w-md rounded-2xl border border-gold/40 bg-surface-solid p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)] animate-fadeIn'}
      >
        <div className={urgent ? '' : 'flex items-start gap-3'}>
          <CalendarClock className={urgent ? 'mx-auto h-10 w-10 animate-bounce text-gold' : 'mt-0.5 h-5 w-5 shrink-0 text-gold'} aria-hidden="true" />
          <div className={urgent ? 'mt-4' : 'min-w-0 flex-1'}>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-parchment/45">Application deadline</p>
            <p id="app-ring-title" className={urgent ? 'mt-2 font-display text-2xl leading-snug text-parchment' : 'mt-1 text-sm font-semibold text-parchment'}>
              {due.title}
            </p>
            <p className={urgent ? 'mt-2 text-parchment/75' : 'text-caption text-parchment/60'}>
              {due.organization ? `${due.organization} · ` : ''}{due.message.replace(/^is /, '')}
            </p>
            <p className="mt-1 font-mono text-xs text-parchment/45">
              {deadline.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className={urgent ? 'mt-8 flex gap-3' : 'mt-3 flex justify-end gap-2'}>
          <button
            type="button"
            onClick={() => close(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gold/20 py-3 text-sm text-parchment/80 transition hover:bg-gold/[0.06] sm:flex-none sm:px-4"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Dismiss
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className="flex-1 rounded-xl bg-gold py-3 text-sm font-bold text-ink transition hover:bg-gold-glow sm:flex-none sm:px-4"
          >
            Open application
          </button>
        </div>
      </div>
    </div>
  )
}
