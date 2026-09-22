'use client'

/**
 * offlineQueue — the "nothing you did offline is lost" guarantee.
 *
 * Every write the app makes goes through window.fetch (POST/PUT/PATCH/DELETE
 * to /api/*). This module wraps window.fetch once at startup:
 *
 *  1. Online + server answered → response flows through untouched.
 *  2. Network failed (offline, plane mode) → the request is stored in
 *     IndexedDB and a synthetic 202 is returned so the UI proceeds
 *     optimistically (the stores already update local-first).
 *  3. On reconnect / app start the queue replays in order with real
 *     credentials. 4xx drops the entry (stale local state), 5xx or network
 *     errors retry up to 5 times with backoff, then keep it queued.
 *
 * subscribeQueue() lets the OfflineBanner show the pending count and a
 * "synced" toast when the queue drains.
 */

type QueuedRequest = {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  queuedAt: number
  attempts: number
}

const DB_NAME = 'inchstone-offline'
const STORE = 'queue'
const MAX_ATTEMPTS = 5

// Endpoints that are safe to replay blind. Uploads, one-shot emails and cron
// must not be retried — they pass through untouched.
const QUEUEABLE = /\/api\/(items|tasks|bottles|habits|plans|plan-goals|plan-milestones|plan-sections|notes|budgets|purses|trackers|reviews|categories|years)/

let listeners: Array<(pending: number) => void> = []
let syncing = false

export function subscribeQueue(fn: (pending: number) => void) {
  listeners.push(fn)
  void count().then(fn)
  return () => { listeners = listeners.filter(l => l !== fn) }
}

function emit(pending: number) { listeners.forEach(l => l(pending)) }

// ── IndexedDB helpers (no deps — the app has no idb package) ─────────────────
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function count(): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  try { return await idbReq(db.transaction(STORE, 'readonly').objectStore(STORE).count()) }
  catch { return 0 }
}

async function all(): Promise<QueuedRequest[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const rows = await idbReq(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<QueuedRequest[]>)
    return rows.sort((a, b) => a.queuedAt - b.queuedAt)
  } catch { return [] }
}

async function put(entry: QueuedRequest): Promise<void> {
  const db = await openDb()
  if (!db) return
  try { await idbReq(db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry)) } catch { /* full/private mode */ }
}

async function remove(id: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  try { await idbReq(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)) } catch { /* ignore */ }
}
async function enqueue(req: RequestInfo | URL, init: RequestInit | undefined): Promise<void> {
  const method = (init?.method || (req instanceof Request ? req.method : 'GET')).toUpperCase()
  const headers: Record<string, string> = {}
  new Headers(init?.headers || undefined).forEach((v, k) => { headers[k] = v })
  const entry: QueuedRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: typeof req === 'string' ? req : req instanceof URL ? req.toString() : req.url,
    method,
    headers,
    body: typeof init?.body === 'string' ? init.body : null,
    queuedAt: Date.now(),
    attempts: 0,
  }
  await put(entry)
  emit(await count())
}

/**
 * Replay the queue in chronological order. Called on `online`, on startup,
 * and when the SW nudges us. Returns how many were flushed.
 */
export async function syncQueue(): Promise<number> {
  if (syncing || typeof navigator === 'undefined' || !navigator.onLine) return 0
  syncing = true
  let flushed = 0
  try {
    for (const entry of await all()) {
      let ok = false
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !ok; attempt++) {
        try {
          const res = await fetch(entry.url, {
            method: entry.method,
            headers: entry.headers,
            body: entry.body,
            credentials: 'include',
          })
          if (res.ok) ok = true
          else if (res.status >= 400 && res.status < 500) ok = true // stale — drop
          else await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        } catch { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))) }
      }
      if (ok) { await remove(entry.id); flushed++ }
      else break // server still down, keep the rest for the next sync
    }
  } finally {
    syncing = false
    emit(await count())
    if (flushed > 0) window.dispatchEvent(new CustomEvent('inchstone:synced', { detail: flushed }))
  }
  return flushed
}

/**
 * Install the global fetch wrapper + reconnect hooks. Idempotent (guarded by
 * a flag on window). Call once from a client component in the root layout.
 */
export function installOfflineSync(): void {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { __inchstoneOfflineInstalled?: boolean }
  if (w.__inchstoneOfflineInstalled) return
  w.__inchstoneOfflineInstalled = true

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const sameOrigin = url.startsWith('/api/') || url.startsWith(`${location.origin}/api/`)
    const isWrite = method !== 'GET' && method !== 'HEAD'
    const queueable = sameOrigin && isWrite && QUEUEABLE.test(url)

    try {
      return await nativeFetch(input, init)
    } catch (err) {
      if (queueable && typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueue(input, init)
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  }

  window.addEventListener('online', () => { void syncQueue() })
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if ((e.data as { type?: string })?.type === 'inchstone-sync') void syncQueue()
  })
  void syncQueue() // flush anything queued during a previous offline session
}
