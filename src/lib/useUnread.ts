'use client'

import { useEffect, useState } from 'react'

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
    return () => { alive = false; clearTimeout(first); clearInterval(id); document.removeEventListener('visibilitychange', load) }
  }, [])
  return total
}
