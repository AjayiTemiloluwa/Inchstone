const VERSION = 'v5'
const SHELL_CACHE = `inchstone-shell-${VERSION}`
const RUNTIME_CACHE = `inchstone-runtime-${VERSION}`
const API_CACHE = `inchstone-api-${VERSION}`
const OFFLINE_URL = '/offline.html'

// Routes whose GET responses we keep for offline reads. Writes (POST/PUT/
// PATCH/DELETE) are never served from cache — the client queue (offlineQueue)
// owns those while offline.
const API_GET_CACHEABLE = /\/api\/(items|tasks|daily-score|nudges|bottles|habits|plans|plan-goals|plan-milestones|plan-sections|notes|budgets|purses|financial|reports|reviews|years|trackers|status-log|allocations|events)/

// ── Install: precache the minimal offline fallback + app shell ───────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(SHELL_CACHE)
            // Shell pages (best-effort — a dev-only failure must not break install)
            await Promise.allSettled([
                cache.add(new Request('/', { cache: 'reload' })),
                cache.add(new Request('/dashboard', { cache: 'reload' })),
                cache.add(new Request(OFFLINE_URL, { cache: 'reload' })),
            ])
            // Static bits the shell needs
            const runtime = await caches.open(RUNTIME_CACHE)
            await Promise.allSettled([
                runtime.add(new Request('/manifest.json', { cache: 'reload' })),
                runtime.add(new Request('/icon-192.png', { cache: 'reload' })),
            ])
        })()
    )
    self.skipWaiting()
})

// ── Activate: purge every cache from an older version ────────────────────────
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
//  • navigations  → network-first, fall back to the cached shell, then offline
//  • /api GET     → network-first, fall back to the last good cached response
//                   (every fresh response is written back — offline shows the
//                   data you last saw, not a dead page)
//  • static       → stale-while-revalidate
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

    // 2. Navigations
    if (req.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    return await fetch(req)
                } catch {
                    const shell = await caches.open(SHELL_CACHE)
                    const exact = await shell.match(req)
                    if (exact) return exact
                    const dashboard = await shell.match('/dashboard')
                    if (dashboard) return dashboard
                    return shell.match(OFFLINE_URL)
                }
            })()
        )
        return
    }

    // 3. Static assets — stale-while-revalidate
    const isStatic =
        url.pathname.startsWith('/_next/static/') ||
        url.pathname === '/manifest.json' ||
        url.pathname.startsWith('/api/icon') ||
        /\.(css|js|woff2?|png|jpg|jpeg|svg|webp|ico|map)$/.test(url.pathname)
    if (isStatic) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(RUNTIME_CACHE)
                const cached = await cache.match(req)
                const network = fetch(req)
                    .then((res) => {
                        if (res.ok) cache.put(req, res.clone())
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