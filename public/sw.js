/* Inchstone service worker — offline shell + data cache + write-queue bridge. */

const VERSION = 'v11'
const SHELL_CACHE = `inchstone-shell-${VERSION}`
const RUNTIME_CACHE = `inchstone-runtime-${VERSION}`
const API_CACHE = `inchstone-api-${VERSION}`
const RSC_CACHE = `inchstone-rsc-${VERSION}`
const OFFLINE_URL = '/offline.html'

// API GETs kept for offline reads. Writes (POST/PUT/PATCH/DELETE) are never
// served from cache — the client-side offlineQueue owns those.
const API_GET_CACHEABLE = /\/api\/(items|tasks|daily-score|nudges|bottles|habits|plans|plan-goals|plan-milestones|plan-sections|notes|budgets|purses|financial|reports|reviews|years|trackers|status-log|allocations|events|applications|alarms|reflections|deed-timers|categories|partners|messages|profile|calendar)/

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
                // Every main screen, so each opens offline even before it was visited.
                ...['/week', '/calendar', '/year', '/plans', '/challenge', '/challenge/applications', '/finance', '/transactions', '/partners', '/notes', '/reports', '/settings']
                    .map((u) => cachePageAndAssets(u).catch(() => {})),
                shell.add(new Request(OFFLINE_URL, { cache: 'reload' })).catch(() => {}),
            ])
            const runtime = await caches.open(RUNTIME_CACHE)
            await Promise.allSettled([
                runtime.add(new Request('/manifest.json', { cache: 'reload' })).catch(() => {}),
                runtime.add(new Request('/icon-192.png', { cache: 'reload' })).catch(() => {}),
                runtime.add(new Request('/notify-badge.png', { cache: 'reload' })).catch(() => {}),
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

// ── Fetch strategies — NETWORK-FIRST for pages & data, CACHE-FIRST for statics
//  Online: everything comes fresh from the network, so every link lands on the
//  right page. Offline: the exact page/data you last loaded is served from
//  cache. Being offline changes where the bytes come from, not how the app
//  behaves.
//  • RSC payloads  → cached per-URL so <Link> clicks work offline for pages
//                    you've already visited (this is how Next navigates)
//  • navigations   → network-first; every visited page is saved for offline
//  • /api GET      → network-first, last good data as the offline fallback
//  • static assets → cache-first (immutable hashed chunks) + silent refresh
//  • /api writes   → untouched; the client-side offlineQueue owns retries.
//
//  NOTE: Cache.put() throws for Request objects with mode 'navigate', which is
//  why earlier versions never actually saved visited pages. safePut() keys the
//  cache by URL string instead, sidestepping that entirely.

async function safePut(cache, req, res) {
    try { await cache.put(req.url, res.clone()) } catch { /* quota / private mode */ }
}

self.addEventListener('fetch', (event) => {
    const req = event.request
    if (req.method !== 'GET') return // writes bypass the SW entirely

    const url = new URL(req.url)
    if (url.origin !== self.location.origin) return // Clerk/Google/fonts CDNs

    const refresh = (cache, urlKey, response) => {
        // Silent background revalidation — never blocks, never rejects.
        fetch(urlKey)
            .then((res) => { if (res && res.ok) return safePut(cache, { url: urlKey }, res) })
            .catch(() => {})
        return response
    }

    // 0. Next.js RSC payloads (client-side <Link> navigation) — network-first,
    //    cached so in-app navigation keeps working offline on visited pages.
    if (req.headers.get('RSC') === '1') {
        if (req.headers.get('Next-Router-Prefetch')) return // never cache partial prefetches
        event.respondWith(
            (async () => {
                const cache = await caches.open(RSC_CACHE)
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok && fresh.type === 'basic') await safePut(cache, req, fresh)
                    return fresh
                } catch {
                    const cached = await cache.match(req, { ignoreVary: true })
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

    // 1. API reads — network-first, cached data as the offline fallback
    if (url.pathname.startsWith('/api/')) {
        if (!API_GET_CACHEABLE.test(url.pathname)) return
        event.respondWith(
            (async () => {
                const cache = await caches.open(API_CACHE)
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok) await safePut(cache, req, fresh)
                    return fresh
                } catch {
                    const cached = await cache.match(req, { ignoreVary: true })
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

    // 2. Navigations — network-first, so links always land where they should.
    //    Every visited page is saved; offline serves the exact page you last
    //    loaded — never a different page in its place.
    if (req.mode === 'navigate') {
        event.respondWith(
            (async () => {
                const shell = await caches.open(SHELL_CACHE)
                try {
                    const fresh = await fetch(req)
                    if (fresh.ok && fresh.type === 'basic') await safePut(shell, req, fresh)
                    return fresh
                } catch {
                    const exact = await shell.match(req, { ignoreVary: true, ignoreSearch: true })
                    if (exact) return exact
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
                if (cached) return refresh(runtime, req.url, cached)
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
    // Android shows a generic "updated in the background" notice when a push shows nothing,
    // so a push with no readable payload still gets a visible notification.
    if (!event.data) {
        event.waitUntil(self.registration.showNotification('Inchstone', { icon: '/icon-192.png', badge: '/notify-badge.png', data: { url: '/dashboard' } }))
        return
    }

    try {
        const data = event.data.json()

        // Android: `badge` is the small status-bar / left-hand icon and must
        // be a white shape on transparency (a solid image shows as a white
        // square). `icon` is the large picture on the right.
        const options = {
            body: data.body,
            icon: data.icon && !data.icon.startsWith('/api/icon') ? data.icon : '/icon-192.png',
            badge: data.badge || '/notify-badge.png',
            data: {
                url: data.data?.url || '/dashboard',
                taskId: data.data?.taskId,
            },
            timestamp: data.timestamp || Date.now(),
            vibrate: data.vibrate || [180, 80, 180],
        }
        if (Array.isArray(data.actions) && data.actions.length) options.actions = data.actions.slice(0, 2)
        // Countdown/reminder pushes arrive with a tag so an updated
        // notification replaces the previous one instead of stacking up.
        if (data.tag) {
            options.tag = data.tag
            options.renotify = true
        }
        if (data.requireInteraction) options.requireInteraction = true

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        )
    } catch (e) {
        console.error('Push notification error:', e)
        event.waitUntil(self.registration.showNotification('Inchstone', { body: event.data.text(), icon: '/icon-192.png', badge: '/notify-badge.png', data: { url: '/dashboard' } }))
    }
})

self.addEventListener('notificationclick', function (event) {
    event.notification.close()

    const url = event.notification.data?.url || '/dashboard'
    const taskId = event.notification.data?.taskId

    // "Mark done" ticks the deed off without opening the app (the request
    // carries the user's session cookie like any in-app save).
    if (event.action === 'done' && taskId) {
        event.waitUntil(
            fetch('/api/tasks/' + encodeURIComponent(taskId), {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: true, progress: 100 }),
            })
                .then(function (res) {
                    return self.registration.showNotification(res.ok ? 'Done ✓' : 'Could not mark it done', {
                        body: res.ok ? event.notification.title.replace(/^[^:]*:\s*/, '') : 'Open Inchstone to tick it off.',
                        icon: '/icon-192.png',
                        badge: '/notify-badge.png',
                        tag: 'task-done-' + taskId,
                        silent: true,
                        data: { url: url },
                    })
                })
                .catch(function () {})
        )
        return
    }

    // "Not done" reopens the deed (marks incomplete) without opening the app.
    if (event.action === 'not-done' && taskId) {
        event.waitUntil(
            fetch('/api/tasks/' + encodeURIComponent(taskId), {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: false, progress: 0 }),
            })
                .then(function (res) {
                    return self.registration.showNotification(res.ok ? 'Reopened ↻' : 'Could not reopen', {
                        body: res.ok ? event.notification.title.replace(/^[^:]*:\\s*/, '') : 'Open Inchstone to retry.',
                        icon: '/icon-192.png',
                        badge: '/notify-badge.png',
                        tag: 'task-notdone-' + taskId,
                        silent: true,
                        data: { url: url },
                    })
                })
                .catch(function () {})
        )
        return
    }

    // "Extend" pushes the task's start/end time forward by 15 minutes.
    if (event.action === 'extend' && taskId) {
        event.waitUntil(
            fetch('/api/tasks/' + encodeURIComponent(taskId), {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extendMinutes: 15 }),
            })
                .then(function (res) {
                    return self.registration.showNotification(res.ok ? 'Extended +15m' : 'Could not extend', {
                        body: res.ok ? event.notification.title.replace(/^[^:]*:\\s*/, '') : 'Open Inchstone to reschedule.',
                        icon: '/icon-192.png',
                        badge: '/notify-badge.png',
                        tag: 'task-extend-' + taskId,
                        silent: true,
                        data: { url: url },
                    })
                })
                .catch(function () {})
        )
        return
    }

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