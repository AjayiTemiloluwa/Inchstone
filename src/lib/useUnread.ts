'use client'

import { useEffect, useState } from 'react'

/** Fired after messages are marked seen, so unread badges update at once. */
export const UNREAD_CHANGED = 'inchstone:unread-changed'

/** Mark partner nudges/messages as seen (the sender then sees "Seen"). */
export async function markNudgesSeen(ids: string[]) {
  if (!ids.length) return
  try {
    await fetch('/api/nudges', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, read: true }) })
    window.dispatchEvent(new Event(UNREAD_CHANGED))
  } catch { /* offline: they stay unread and are marked next time */ }
}

/** Unread partner messages, refreshed every 30s while the app is visible. */
export function useUnread(): number {
  const [total, setTotal] = useState(0)
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/messages/unread', { cache: 'no-store' })
        if (res.ok && alive) setTotal((await res.json()).total || 0)
      } catch { /* offline */ }
    }
    const first = setTimeout(load, 1500)
    const id = setInterval(load, 30_000)
    document.addEventListener('visibilitychange', load)
    window.addEventListener(UNREAD_CHANGED, load)
    return () => { alive = false; clearTimeout(first); clearInterval(id); document.removeEventListener('visibilitychange', load); window.removeEventListener(UNREAD_CHANGED, load) }
  }, [])
  return total
}
