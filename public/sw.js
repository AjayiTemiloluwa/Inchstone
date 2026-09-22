/* Inchstone service worker — offline shell + data cache + write-queue bridge. */

const VERSION = 'v6'
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

// ── Fetch strategies ──────────────────────────────────────────────────────────
//  • navigations  → network-first; every visited page is saved to the shell
//                   cache, so offline serves exactly the page you last saw
//  • /api GET     → network-first, fall back to the last good cached response
//                   (offline shows the data you last saw, not a dead page)
//  • static       → stale-while-revalidate, matching across both asset caches
//  • /api writes  → passed through untouched; the client-side offlineQueue
//                   owns retrying them.
self.addEventListener('fetch', (event) => {
    const req = event.request
    if (req.method !== 'GET') return // writes bypass the SW entirely

    const url = new URL(req.url)
    if (url.origin !== self.location.origin) return // Clerk/Google/fonts CDNs

    // 1. API reads
    if (url.pathname.startsWith('/api/')) {
        if (!API_GET_CACHEABLE.test(url.pathname)) return
        event.respondWith(
            (async () => {
                const cache = await caches.open(API_CACHE)
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok) cache.put(req, fresh.clone())
                    return fresh
                } catch {
                    const cached = await cache.match(req, { ignoreSearch: false })
                    if (cached) return cached
                    return new Response(
                        JSON.stringify({ offline: true, error: 'unavailable offline' }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    )
                }
            })()
        )
        return
    }

    // 2. Navigations — network-first, but save every page you visit
    if (req.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok && fresh.type === 'basic') {
                        caches
                            .open(SHELL_CACHE)
                            .then((shell) => shell.put(req, fresh.clone()))
                            .catch(() => {})
                    }
                    return fresh
                } catch {
                    const shell = await caches.open(SHELL_CACHE)
                    const exact = await shell.match(req, { ignoreSearch: true })
                    if (exact) return exact
                    const dashboard = await shell.match('/dashboard')
                    if (dashboard) return dashboard
                    return (await shell.match('/')) || (await shell.match(OFFLINE_URL)) || Response.error()
                }
            })()
        )
        return
    }

    // 3. Static assets — stale-while-revalidate
    if (isStaticAsset(url)) {
        event.respondWith(
            (async () => {
                const runtime = await caches.open(RUNTIME_CACHE)
                const shell = await caches.open(SHELL_CACHE)
                const cached =
                    (await runtime.match(req)) || (await shell.match(req))
                const network = fetch(req)
                    .then((res) => {
                        if (res.ok) runtime.put(req, res.clone())
                        return res
                    })
                    .catch(() => cached)
                return cached || network
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