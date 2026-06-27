'use client'

import { useEffect, useState } from 'react'

export function PushNotificationManager() {
    const [supported, setSupported] = useState(false)
    const [subscribed, setSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setSupported(true)
            checkSubscription()
        }
    }, [])

    const checkSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setSubscribed(!!subscription)
        } catch {
            setSubscribed(false)
        }
    }

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
    }

    const handleSubscribe = async () => {
        setLoading(true)
        try {
            // Get VAPID public key from server
            const keyRes = await fetch('/api/push/vapid-key')
            const { publicKey } = await keyRes.json()
            if (!publicKey) throw new Error('No VAPID key')

            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            })

            // Send subscription to server
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
                    auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
                }),
            })

            setSubscribed(true)
        } catch (err) {
            console.error('Failed to subscribe to push notifications', err)
        } finally {
            setLoading(false)
        }
    }

    if (!supported) return null

    return (
        <div className="flex items-center space-x-2">
            {subscribed ? (
                <span className="text-xs text-sage font-medium">Notifications enabled</span>
            ) : (
                <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="text-xs font-medium text-gold hover:underline disabled:opacity-50"
                >
                    {loading ? 'Enabling...' : 'Enable notifications'}
                </button>
            )}
        </div>
    )
}