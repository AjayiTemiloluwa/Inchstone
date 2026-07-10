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
    payload: { title: string; body: string; icon?: string; url?: string }
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
                icon: payload.icon || '/icon.png',
                data: {
                    url: payload.url || '/dashboard',
                },
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
