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
            // If a window client is already open, focus it and navigate
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus()
                    client.navigate(url)
                    return
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                clients.openWindow(url)
            }
        })
    )
})