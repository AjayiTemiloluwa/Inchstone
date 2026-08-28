'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCountdown } from '@/lib/useCountdown'

/**
 * DeedCountdown — the pinned, LIVE countdown on your device's notification
 * bar for every opt-in scheduled deed (notifyDeed).
 *
 *  · Pin window: a deed with a time gets a pinned notification from 15 min
 *    before its start, showing either "starts in m:ss" or "m:ss left".
 *  · It COUNTs DOWN in place (the service worker re-shows the same tag,
 *    silently) — no server round-trips after the initial feed.
 *  · The moment the end time passes it sends the light "✓ Finished"
 *    notification, stamps it (so the ringer never doubles it), then closes
 *    the pin after a few seconds so your bar doesn't fill with ghosts.
 *  · Completed deeds get their pins closed on the next refresh.
 *
 * Only runs where Notifications permission is granted and a service worker
 * registration exists (the PWA's sw.js). Everything is silent by default —
 * the only audible piece is the short finish alarm, handled by AlarmRinger.
 */

interface DeedTimer {
  taskId: string
  title: string
  startTime: string
  endTime: string | null
  estimatedEnd: string | null
  isImportant: boolean
  color: string | null
}

const PIN_BEFORE_MS = 15 * 60_000 // pin from 15 min before start
const FINISH_CLOSE_MS = 8_000 // how long the "✓ Finished" notification stays
const REFRESH_TIMERS_MS = 60_000 // re-ask the server for today's times

const tag = (taskId: string) => `deed-countdown-${taskId}`
const finishTag = (taskId: string) => `deed-finish-${taskId}`

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function DeedCountdown() {
  const now = useCountdown()
  const [timers, setTimers] = useState<DeedTimer[]>([])
  const firedFinish = useRef<Set<string>>(new Set())
  const lastPinnedBody = useRef<Map<string, string>>(new Map())
  const pinnedActive = useRef<Set<string>>(new Set())

  const fetchTimers = useCallback(async () => {
    try {
      const res = await fetch('/api/deed-timers', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { timers?: DeedTimer[] }
      if (Array.isArray(data.timers)) setTimers(data.timers)
    } catch {
      /* offline — keep the last known list */
    }
  }, [])

  // Keep the feed fresh (mount, interval, and whenever the tab becomes visible).
  useEffect(() => {
    fetchTimers()
    const id = window.setInterval(fetchTimers, REFRESH_TIMERS_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchTimers()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetchTimers])
  // Drive the pinned notifications from the ticking clock.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!('serviceWorker' in navigator)) return

    const nowMs = now.getTime()
    const liveIds = new Set(timers.map(t => t.taskId))

    navigator.serviceWorker.ready
      .then(reg => {
        // Close pins for completed/deleted deeds (no longer in the feed).
        for (const taskId of pinnedActive.current) {
          if (!liveIds.has(taskId)) {
            reg.getNotifications({ tag: tag(taskId) }).then(list => list.forEach(n => n.close()))
            pinnedActive.current.delete(taskId)
          }
        }

        for (const t of timers) {
          const start = new Date(t.startTime).getTime()
          const end = t.estimatedEnd ? new Date(t.estimatedEnd).getTime() : null
          if (!end) continue

          // Finished: send the light note once, stamp it, then close the pin.
          if (nowMs >= end) {
            if (!firedFinish.current.has(t.taskId)) {
              firedFinish.current.add(t.taskId)
              reg.showNotification(`✓ Finished: ${t.title}`, {
                body: `You wrapped this deed. Great work.`,
                tag: finishTag(t.taskId),
                silent: true,
                icon: '/api/icon?sizes=192x192',
                data: { url: `/day/${new Date(t.startTime).toISOString().substring(0, 10)}` },
              } as NotificationOptions)
              reg.getNotifications({ tag: tag(t.taskId) }).then(list => list.forEach(n => n.close()))
              pinnedActive.current.delete(t.taskId)
              // Stamp it server-side so the ringer/cron never double-fire.
              fetch('/api/tasks/due', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: t.taskId, kind: 'finish' }),
              }).catch(() => {})
              // Let the finished note breathe, then tidy it away.
              window.setTimeout(() => {
                navigator.serviceWorker.ready.then(r =>
                  r.getNotifications({ tag: finishTag(t.taskId) }).then(list => list.forEach(n => n.close()))
                )
              }, FINISH_CLOSE_MS)
              // Cap the fired set so it can't grow forever.
              if (firedFinish.current.size > 200) {
                firedFinish.current = new Set([...firedFinish.current].slice(-200))
              }
            }
            continue
          }

          // Outside the pin window yet? Not until 15 min before start.
          if (nowMs < start - PIN_BEFORE_MS) continue

          const body =
            nowMs < start
              ? `${fmtClock(start - nowMs)} until start`
              : `${fmtClock(end - nowMs)} left ⏳`
          const title = nowMs < start ? `Up next: ${t.title}` : t.title

          const prev = lastPinnedBody.current.get(t.taskId)
          if (prev === `${title}\u0000${body}`) continue // unchanged — don't spam

          lastPinnedBody.current.set(t.taskId, `${title}\u0000${body}`)
          pinnedActive.current.add(t.taskId)
          reg.showNotification(title, {
            body,
            tag: tag(t.taskId),
            silent: true, // replace in place — no re-buzz every tick
            icon: '/api/icon?sizes=192x192',
            data: { url: `/day/${new Date(t.startTime).toISOString().substring(0, 10)}` },
          } as NotificationOptions)
        }
      })
      .catch(() => {})
  }, [now, timers])

  return null
}
