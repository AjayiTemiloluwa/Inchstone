'use client'

import { useEffect, useState } from 'react'
import { installOfflineSync, subscribeQueue } from '@/lib/offlineQueue'

/**
 * OfflineSync — one client component in the root layout that:
 *  1. installs the global fetch wrapper + reconnect replay (offlineQueue),
 *  2. renders the offline / pending-sync banner.
 *
 * The banner reuses the app's voice: gold-dim hairline, ink surface, mono
 * meta — the same chrome the toasts and the topbar use.
 */
export function OfflineSync() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    installOfflineSync()
    const unsub = subscribeQueue(setPending)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    let cancelled = false
    // Read the initial connectivity asynchronously — a synchronous setState
    // here would trip react-hooks/set-state-in-effect.
    Promise.resolve().then(() => { if (!cancelled) setOnline(navigator.onLine) })
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      cancelled = true
      unsub()
      window.removeEventListener('offline', down)
      window.removeEventListener('online', up)
    }
  }, [])

  const visible = !online || pending > 0
  if (!visible) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] lg:bottom-5"
    >
      <p className="max-w-md rounded-full border border-gold-dim/30 bg-ink/90 px-4 py-2 text-center text-[12px] leading-snug text-parchment/80 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        {pending > 0
          ? `${pending} change${pending === 1 ? '' : 's'} saved on this device — will sync when you're back online.`
          : "You're offline — Inchstone is running from this device. Changes you make are saved and will sync."}
      </p>
    </div>
  )
}
