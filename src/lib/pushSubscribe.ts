'use client'

/**
 * Turns on web push for this device: asks permission, subscribes through the
 * service worker with the server's VAPID key, and registers the subscription.
 * Shared by Settings (PushNotificationManager) and the first-run Welcome.
 * Resolves true when this device will now get notifications with the app closed.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return false
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') return false

  const keyRes = await fetch('/api/push/vapid-key')
  const { publicKey } = (await keyRes.json()) as { publicKey?: string }
  if (!publicKey) return false

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }))

  const key = (name: PushEncryptionKeyName) => btoa(String.fromCharCode(...new Uint8Array(subscription.getKey(name)!)))
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, p256dh: key('p256dh'), auth: key('auth') }),
  })
  return res.ok
}

/** Is this device already subscribed? */
export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return !!(await reg.pushManager.getSubscription())
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
