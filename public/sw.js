const CACHE_NAME = 'inchstone-v1'
const urlsToCache = [
    '/',
    '/manifest.json',
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        })
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse
            }
            return fetch(event.request).catch(() => {
                return caches.match('/')
            })
        })
    )
})

self.addEventListener('push', function (event) {
    if (!event.data) return

    try {
        const data = event.data.json()

        const options = {
            body: data.body,
            icon: data.icon || '/icon.png',
            badge: '/badge.png',
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
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
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