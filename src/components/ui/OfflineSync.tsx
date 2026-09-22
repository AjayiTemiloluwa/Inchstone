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
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-gold-dim/30 bg-ink/95 backdrop-blur-xl px-4 py-2.5 text-center sm:px-6"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <p className="text-[13px] text-parchment/80">
        {pending > 0
          ? `${pending} change${pending === 1 ? '' : 's'} saved on this device — will sync when you're back online.`
          : "You're offline — Inchstone is running from this device. Changes you make are saved and will sync."}
      </p>
    </div>
  )
}
