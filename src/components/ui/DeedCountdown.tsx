'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCountdown } from '@/lib/useCountdown'

/**
 * DeedCountdown — ONE quiet card in your phone's notification bar for the deed
 * you are on (or the next one, from 15 min before it starts).
 *
 *  · One card, not one per deed: the running deed that ends soonest, else the
 *    next deed to start. Any other deed's card is closed.
 *  · Fixed wording ("Running · ends at 3:45 PM", "Starts at 3:30 PM"), so the
 *    card stays true without ticking. It is redrawn only when its words change
 *    (up next → running → a different deed), always silently. It used to be
 *    redrawn every second to show a m:ss clock, which phones treat as a new
 *    notification each time — that was the spam.
 *  · When a deed's end time passes: a quiet "✓ Finished" card that tidies
 *    itself away after a few seconds, stamped so the server never repeats it.
 *  · The server's pushes (sw.js) use the same tag, so they update this same
 *    card while the app is closed instead of stacking new ones.
 *
 * Only runs where Notifications permission is granted and a service worker
 * registration exists (the PWA's sw.js). The live m:ss countdown lives inside
 * the app (work clock, day view), not in the notification bar.
 */

interface DeedTimer {
  taskId: string
  title: string
  startTime: string
  endTime: string | null
  estimatedEnd: string | null
  isImportant: boolean
  color: string | null
  /** The "finished" note was already sent for this deed. */
  finished?: boolean
}

const PIN_BEFORE_MS = 15 * 60_000 // card appears 15 min before the start
const FINISH_CLOSE_MS = 8_000 // how long the "✓ Finished" card stays
const REFRESH_TIMERS_MS = 60_000 // re-ask the server for today's times
const CHECK_MS = 15_000 // how often to see whether the card's words should change

const tag = (taskId: string) => `deed-countdown-${taskId}`
const finishTag = (taskId: string) => `deed-finish-${taskId}`

/** "3:45 PM" in the device's own time. */
function fmtAt(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** yyyy-MM-dd of an instant in the device's own day (the /day route's key). */
function localDay(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface Span { t: DeedTimer; start: number; end: number }

/** The single deed the bar should show right now, or null. */
export function pickFocus(spans: Span[], nowMs: number): Span | null {
  const running = spans.filter(s => s.start <= nowMs && nowMs < s.end).sort((a, b) => a.end - b.end)
  if (running.length) return running[0]
  const soon = spans
    .filter(s => s.start > nowMs && s.start - nowMs <= PIN_BEFORE_MS)
    .sort((a, b) => a.start - b.start)
  return soon[0] ?? null
}

export function DeedCountdown() {
  // A slow check, not a 1-second tick: the card's words only change at a deed's
  // start or end. Kept running under reduced motion — nothing here animates.
  const now = useCountdown(CHECK_MS, { respectReducedMotion: false })
  const [timers, setTimers] = useState<DeedTimer[]>([])
  // The Android companion app is showing the card itself — the web app stays out of the bar.
  const [phone, setPhone] = useState(false)
  const firedFinish = useRef<Set<string>>(new Set())
  const shown = useRef<{ taskId: string; key: string } | null>(null)

  const fetchTimers = useCallback(async () => {
    try {
      const res = await fetch('/api/deed-timers', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { timers?: DeedTimer[]; phone?: boolean }
      if (Array.isArray(data.timers)) setTimers(data.timers)
      setPhone(!!data.phone)
    } catch {
      /* offline — keep the last known list */
    }
  }, [])

  // Keep the feed fresh (mount, interval, and whenever the app comes back).
  useEffect(() => {
    const first = window.setTimeout(fetchTimers, 0)
    const id = window.setInterval(fetchTimers, REFRESH_TIMERS_MS)
    const onVis = () => { if (document.visibilityState === 'visible') fetchTimers() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetchTimers])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!('serviceWorker' in navigator)) return

    const nowMs = now.getTime()
    const spans: Span[] = timers
      .map(t => ({ t, start: new Date(t.startTime).getTime(), end: t.estimatedEnd ? new Date(t.estimatedEnd).getTime() : NaN }))
      .filter(s => Number.isFinite(s.start) && Number.isFinite(s.end))

    navigator.serviceWorker.ready
      .then(async reg => {
        // Deeds whose end passed while the app was open: one quiet "finished" card each.
        for (const s of spans) {
          if (phone) break
          if (s.t.finished || nowMs < s.end || nowMs - s.end > 10 * 60_000 || firedFinish.current.has(s.t.taskId)) continue
          firedFinish.current.add(s.t.taskId)
          reg.showNotification(`✓ Finished: ${s.t.title}`, {
            body: 'You wrapped this deed. Great work.',
            tag: finishTag(s.t.taskId),
            silent: true,
            icon: '/icon-192.png',
            badge: '/notify-badge.png',
            data: { url: `/day/${localDay(s.start)}` },
          } as NotificationOptions)
          // Stamp it server-side so the ringer/cron never double-fire.
          fetch('/api/tasks/due', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: s.t.taskId, kind: 'finish' }),
          }).catch(() => {})
          window.setTimeout(() => {
            navigator.serviceWorker.ready.then(r =>
              r.getNotifications({ tag: finishTag(s.t.taskId) }).then(list => list.forEach(n => n.close()))
            )
          }, FINISH_CLOSE_MS)
        }
        if (firedFinish.current.size > 200) firedFinish.current = new Set([...firedFinish.current].slice(-200))

        const focus = phone ? null : pickFocus(spans, nowMs)

        // Close every other deed card (finished, completed, deleted, or simply not the focus).
        const open = await reg.getNotifications()
        for (const n of open) {
          if (n.tag.startsWith('deed-countdown-') && (!focus || n.tag !== tag(focus.t.taskId))) n.close()
        }
        if (!focus) { shown.current = null; return }

        const running = nowMs >= focus.start
        const title = running ? `▶ ${focus.t.title}` : `Up next: ${focus.t.title}`
        const body = running
          ? `Running · ends at ${fmtAt(focus.end)}`
          : `Starts at ${fmtAt(focus.start)} · until ${fmtAt(focus.end)}`
        const key = `${title}\u0000${body}`
        // Same words as last time → leave it alone (and if you swiped it away, it stays away
        // until the deed moves on).
        if (shown.current?.taskId === focus.t.taskId && shown.current.key === key) return
        shown.current = { taskId: focus.t.taskId, key }

        reg.showNotification(title, {
          body,
          tag: tag(focus.t.taskId),
          silent: true, // replaces in place: no sound, no buzz, no pop-up
          renotify: false,
          icon: '/icon-192.png',
          badge: '/notify-badge.png',
          // Android shows this as the card's time: the moment that matters next.
          timestamp: running ? focus.end : focus.start,
          // Act on the deed straight from the notification bar (handled in sw.js).
          actions: running
            ? [{ action: 'done', title: 'Done ✓' }, { action: 'extend', title: '+15 min' }]
            : [{ action: 'open', title: 'Open day' }],
          data: { url: `/day/${localDay(focus.start)}`, taskId: focus.t.taskId },
        } as NotificationOptions)
      })
      .catch(() => {})
  }, [now, timers, phone])

  return null
}
