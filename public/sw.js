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

// We leave an empty fetch listener so Chrome recognizes this as a PWA,
// but we DO NOT intercept navigation requests to avoid ERR_FAILED
// during Next.js or Clerk redirects.
self.addEventListener('fetch', (event) => {
    return
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