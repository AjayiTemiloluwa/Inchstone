/* Inchstone service worker — offline shell + data cache + write-queue bridge. */

const VERSION = 'v7'
const SHELL_CACHE = `inchstone-shell-${VERSION}`
const RUNTIME_CACHE = `inchstone-runtime-${VERSION}`
const API_CACHE = `inchstone-api-${VERSION}`
const OFFLINE_URL = '/offline.html'

// API GETs kept for offline reads. Writes (POST/PUT/PATCH/DELETE) are never
// served from cache — the client-side offlineQueue owns those.
const API_GET_CACHEABLE = /\/api\/(items|tasks|daily-score|nudges|bottles|habits|plans|plan-goals|plan-milestones|plan-sections|notes|budgets|purses|financial|reports|reviews|years|trackers|status-log|allocations|events)/

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/api/icon') ||
    /\.(css|js|woff2?|png|jpg|jpeg|svg|webp|ico|map)$/.test(url.pathname)
  )
}

/**
 * Cache an HTML page PLUS every same-origin asset it references. A Next.js
 * page is useless offline without its hashed /_next/static chunks — precaching
 * only the HTML (v5) would render a blank document on the first offline load.
 */
async function cachePageAndAssets(pageUrl) {
  const shell = await caches.open(SHELL_CACHE)
  const runtime = await caches.open(RUNTIME_CACHE)
  const res = await fetch(new Request(pageUrl, { cache: 'reload' }))
  if (!res.ok) return
  await shell.put(pageUrl, res.clone()).catch(() => {})
  const html = await res.text()
  const urls = new Set()
  const re = /(?:src|href)="(\/[^"]+)"/g
  let m
  while ((m = re.exec(html)) !== null) {
    const path = m[1]
    if (
      path.startsWith('/_next/static/') ||
      /\.(css|js|woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(path.split('?')[0])
    ) {
      urls.add(path)
    }
  }
  await Promise.allSettled(
    [...urls].slice(0, 80).map((u) =>
      fetch(new Request(u, { cache: 'reload' }))
        .then((r) => { if (r.ok) return runtime.put(u, r); return undefined })
        .catch(() => {})
    )
  )
}

// ── Install: precache the shell pages, their chunks, and app icons ───────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const shell = await caches.open(SHELL_CACHE)
            await Promise.allSettled([
                cachePageAndAssets('/'),
                cachePageAndAssets('/dashboard'),
                shell.add(new Request(OFFLINE_URL, { cache: 'reload' })).catch(() => {}),
            ])
            const runtime = await caches.open(RUNTIME_CACHE)
            await Promise.allSettled([
                runtime.add(new Request('/manifest.json', { cache: 'reload' })).catch(() => {}),
                runtime.add(new Request('/icon-192.png', { cache: 'reload' })).catch(() => {}),
                runtime.add(new Request('/icon-512.png', { cache: 'reload' })).catch(() => {}),
            ])
        })()
    )
    self.skipWaiting()
})

// ── Activate: purge every cache from an older version, take control ──────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => !key.endsWith(`-${VERSION}`))
                    .map((key) => caches.delete(key))
            )
        )
    )
    self.clients.claim()
})

// ── Fetch strategies — CACHE-FIRST, so online and offline behave alike ────────
//  The cache always answers if it can; the network only refreshes it in the
//  background. Nothing waits on the network, so being offline changes nothing
//  about how the app loads or behaves.
//  • navigations  → cached page instantly; HTML refetched silently if online
//  • /api GET     → cached data instantly; refetched silently if online
//  • static       → cached chunk instantly; refetched silently if online
//  • /api writes  → passed through untouched; the client-side offlineQueue
//                   owns retrying them.
self.addEventListener('fetch', (event) => {
    const req = event.request
    if (req.method !== 'GET') return // writes bypass the SW entirely

    const url = new URL(req.url)
    if (url.origin !== self.location.origin) return // Clerk/Google/fonts CDNs

    const refresh = (cache, key, response) => {
        // Silent background revalidation — never blocks, never rejects.
        fetch(key)
            .then((res) => { if (res && res.ok) cache.put(key, res) })
            .catch(() => {})
        return response
    }

    // 1. API reads — cached data first, silent refresh when online
    if (url.pathname.startsWith('/api/')) {
        if (!API_GET_CACHEABLE.test(url.pathname)) return
        event.respondWith(
            (async () => {
                const cache = await caches.open(API_CACHE)
                const cached = await cache.match(req, { ignoreSearch: false })
                if (cached) return refresh(cache, req, cached)
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok) {
                        const clone = fresh.clone()
                        cache.put(req, clone).catch(() => {})
                        return fresh
                    }
                    return fresh
                } catch {
                    return new Response(
                        JSON.stringify({ offline: true, error: 'unavailable offline' }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    )
                }
            })()
        )
        return
    }

    // 2. Navigations — cached page first, silent refresh when online
    if (req.mode === 'navigate') {
        event.respondWith(
            (async () => {
                const shell = await caches.open(SHELL_CACHE)
                const cached =
                    (await shell.match(req, { ignoreSearch: true })) ||
                    (await shell.match('/dashboard')) ||
                    (await shell.match('/'))
                if (cached) return refresh(shell, req, cached)
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok && fresh.type === 'basic') {
                        const clone = fresh.clone()
                        shell.put(req, clone).catch(() => {})
                    }
                    return fresh
                } catch {
                    return (await shell.match(OFFLINE_URL)) || Response.error()
                }
            })()
        )
        return
    }

    // 3. Static assets — cached chunk first, silent refresh when online
    if (isStaticAsset(url)) {
        event.respondWith(
            (async () => {
                const runtime = await caches.open(RUNTIME_CACHE)
                const shell = await caches.open(SHELL_CACHE)
                const cached =
                    (await runtime.match(req)) || (await shell.match(req))
                if (cached) return refresh(runtime, req, cached)
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok) {
                        const clone = fresh.clone()
                        runtime.put(req, clone).catch(() => {})
                        return fresh
                    }
                    return fresh
                } catch {
                    return Response.error()
                }
            })()
        )
    }
})

// ── Background sync: nudge the page to replay its write queue ────────────────
self.addEventListener('sync', (event) => {
    if (event.tag === 'inchstone-sync') {
        event.waitUntil(
            self.clients.matchAll({ includeUncontrolled: true }).then((clientList) => {
                clientList.forEach((client) => client.postMessage({ type: 'inchstone-sync' }))
            })
        )
    }
})

// ── Push notifications ─────────────────────────────────────────────────────────

self.addEventListener('push', function (event) {
    if (!event.data) return

    try {
        const data = event.data.json()

        const options = {
            body: data.body,
            icon: data.icon || '/api/icon?sizes=192x192',
            badge: '/api/icon?sizes=192x192',
            data: {
                url: data.data?.url || '/dashboard',
            },
        }
        // Countdown/reminder pushes arrive with a tag so an updated
        // notification replaces the previous one instead of stacking up.
        if (data.tag) {
            options.tag = data.tag
            options.renotify = true
        }
        if (data.requireInteraction) options.requireInteraction = true
        if (data.vibrate) options.vibrate = data.vibrate

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        )
    } catch (e) {
        console.error('Push notification error:', e)
    }
})

self.addEventListener('notificationclick', function (event) {
    event.notification.close()

    const url = event.notification.data?.url || '/dashboard'

    event.waitUntil(
        clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                for (const client of clientList) {
                    if (
                        client.url.includes(self.location.origin) &&
                        'focus' in client
                    ) {
                        client.focus()
                        client.navigate(url)
                        return
                    }
                }
                if (clients.openWindow) {
                    clients.openWindow(url)
                }
            })
    )
})