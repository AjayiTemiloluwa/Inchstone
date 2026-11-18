'use client'

/**
 * deedEvents — one app-wide signal for "a deed was just finished".
 *
 * Deeds are ticked off from many places (day grid, agenda, cards, frogs,
 * habits, the dashboard). Rather than wire every one of them, this watches
 * the app's own requests: a successful PUT/PATCH to /api/tasks/<id> whose
 * body sets `completed: true` fires DEED_DONE, carrying where the finger or
 * pointer last pressed so the reward can pop from that exact spot.
 *
 * Installed once (MomentumChip calls installDeedEvents on mount).
 */

export const DEED_DONE = 'inchstone:deed-done'
export type DeedDoneDetail = { taskId: string; x: number; y: number }

let installed = false
let lastPress = { x: 0, y: 0 }

const TASK_URL = /\/api\/tasks\/([^/?#]+)(?:[?#]|$)/

export function installDeedEvents() {
  if (installed || typeof window === 'undefined') return
  installed = true
  lastPress = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPress = { x: e.clientX, y: e.clientY }
    },
    { capture: true, passive: true },
  )

  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init)
    try {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      if ((method === 'PUT' || method === 'PATCH') && res.ok && typeof init?.body === 'string') {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const m = TASK_URL.exec(url)
        if (m && init.body.includes('"completed":true')) {
          const body = JSON.parse(init.body) as { completed?: boolean }
          if (body.completed === true) {
            const detail: DeedDoneDetail = { taskId: decodeURIComponent(m[1]), ...lastPress }
            window.dispatchEvent(new CustomEvent<DeedDoneDetail>(DEED_DONE, { detail }))
          }
        }
      }
    } catch {
      /* never let the observer break a real request */
    }
    return res
  }
}
