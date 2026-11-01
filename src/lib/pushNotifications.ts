import webpush from 'web-push'

// VAPID keys should be generated once and stored in .env
// Generate with: npx web-push generate-vapid-keys

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@inchstone.app'

let vapidConfigured = false

function ensureVapidConfigured() {
    if (!vapidConfigured && vapidPublicKey && vapidPrivateKey) {
        try {
            webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
            vapidConfigured = true
        } catch {
            console.warn('VAPID keys are invalid. Push notifications disabled.')
        }
    }
}

export function getVapidPublicKey(): string {
    return vapidPublicKey
}

export function isVapidConfigured(): boolean {
    return !!(vapidPublicKey && vapidPrivateKey)
}

export async function sendNotification(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: {
        title: string
        body: string
        icon?: string
        url?: string
        tag?: string // replaces a previous notification with the same tag (renotify)
        requireInteraction?: boolean
        vibrate?: number[]
        /** Epoch ms the notification is about (shown as its time on Android). */
        timestamp?: number
        /** Buttons under the notification: "done" and "open" are handled by the service worker. */
        actions?: { action: string; title: string }[]
        /** The deed a "done" action ticks off. */
        taskId?: string
    }
) {
    ensureVapidConfigured()
    if (!vapidConfigured) return true // Silently succeed if not configured

    try {
        await webpush.sendNotification(
            {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                },
            },
            JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/icon-192.png',
                badge: '/notify-badge.png',
                data: {
                    url: payload.url || '/dashboard',
                    ...(payload.taskId ? { taskId: payload.taskId } : {}),
                },
                ...(payload.timestamp ? { timestamp: payload.timestamp } : {}),
                ...(payload.actions?.length ? { actions: payload.actions.slice(0, 2) } : {}),
                // Pass-through options the service worker applies to
                // showNotification (see public/sw.js).
                ...(payload.tag ? { tag: payload.tag, renotify: true } : {}),
                ...(payload.requireInteraction ? { requireInteraction: true } : {}),
                ...(payload.vibrate ? { vibrate: payload.vibrate } : {}),
            })
        )
        return true
    } catch (error: any) {
        // If subscription is expired, return false so caller can clean it up
        if (error.statusCode === 410) {
            return false
        }
        console.error('Push notification failed', error)
        return false
    }
}

export async function sendNudgeNotification(
    subscription: { endpoint: string; p256dh: string; auth: string },
    senderName: string,
    message: string
) {
    return sendNotification(subscription, {
        title: `Nudge from ${senderName}`,
        body: message,
        url: '/partners',
    })
}
