'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

type Entry = { id: string; kind: string; title: string; body: string; url: string | null; late: boolean; createdAt: string }

const SEEN_KEY = 'inchstone-notif-seen'
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }

/** Today's notifications, newest first, including the ones the phone never showed. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Entry[]>([])
  const [seen, setSeen] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?since=${encodeURIComponent(startOfToday())}`, { cache: 'no-store' })
      if (res.ok) setItems((await res.json()).items ?? [])
    } catch { /* offline: keep what we have */ }
  }, [])

  useEffect(() => {
    try { setSeen(Number(localStorage.getItem(SEEN_KEY)) || 0) } catch { /* private mode */ }
    void load()
    const id = window.setInterval(load, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const unread = items.filter((i) => new Date(i.createdAt).getTime() > seen).length

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      void load()
      const now = Date.now()
      setSeen(now)
      try { localStorage.setItem(SEEN_KEY, String(now)) } catch { /* private mode */ }
    }
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} aria-expanded={open}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-parchment/60 transition-colors hover:bg-parchment/[0.06] hover:text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.7} />
        {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-ember ring-2 ring-ink" aria-hidden />}
      </button>
      {open && (
        <div role="dialog" aria-label="Today's notifications"
          className="absolute right-0 top-10 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-parchment/10 bg-surface-solid shadow-xl">
          <div className="flex items-center justify-between border-b border-parchment/10 px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-parchment">Today</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/45">{items.length} sent</span>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && <li className="px-3.5 py-6 text-center text-sm text-parchment/55">Nothing has been sent today yet.</li>}
            {items.map((n) => {
              const row = (
                <div className="flex gap-2.5 px-3.5 py-2.5 hover:bg-parchment/5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-parchment">
                      <span className="truncate">{n.title}</span>
                      {n.late && <span className="shrink-0 rounded-full border border-ember/40 px-1.5 text-[9px] font-bold uppercase tracking-wide text-ember">missed</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-parchment/65">{n.body}</p>
                  </div>
                  <time className="shrink-0 font-mono text-[10px] text-parchment/50" dateTime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </time>
                </div>
              )
              return <li key={n.id} className="border-b border-parchment/5 last:border-0">{n.url ? <Link href={n.url} onClick={() => setOpen(false)}>{row}</Link> : row}</li>
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
