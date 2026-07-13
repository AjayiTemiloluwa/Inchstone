const CACHE_NAME = 'inchstone-v2'
const OFFLINE_URL = '/offline.html'

// Pre-cache only the offline fallback page
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
    )
    self.skipWaiting()
})

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    )
    self.clients.claim()
})

// Network-first strategy:
// 1. Always try the network first so the live dev server is used
// 2. Only fall back to the offline page if the network genuinely fails
self.addEventListener('fetch', (event) => {
    // Only handle GET requests to our own origin
    if (event.request.method !== 'GET') return
    if (!event.request.url.startsWith(self.location.origin)) return

    // For navigation requests (page loads), use network-first with offline fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() =>
                    caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_URL))
                )
        )
        return
    }

    // For all other requests (assets, API, etc.), go straight to network
    // Do NOT intercept or cache — let the browser handle it normally
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