'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useToast } from '@/components/ui/ToastProvider'

const subscribeNoop = () => () => {}
const getSupported = () => 'serviceWorker' in navigator && 'PushManager' in window
const getSupportedServer = () => false

export function PushNotificationManager() {
    const { showToast } = useToast()
    const supported = useSyncExternalStore(subscribeNoop, getSupported, getSupportedServer)
    const [subscribed, setSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)

    useEffect(() => {
        if (!supported) return
        let cancelled = false
        navigator.serviceWorker.ready
            .then(registration => registration.pushManager.getSubscription())
            .then(subscription => { if (!cancelled) setSubscribed(!!subscription) })
            .catch(() => { if (!cancelled) setSubscribed(false) })
        return () => { cancelled = true }
    }, [supported])

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

    const handleTestNotification = async () => {
        setTesting(true)
        try {
            const res = await fetch('/api/push/test', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                showToast(data.message, 'success')
            } else {
                showToast(data.error || 'Test failed', 'error')
            }
        } catch (err) {
            showToast('Failed to send test notification', 'error')
            console.error(err)
        } finally {
            setTesting(false)
        }
    }

    if (!supported) return null

    return (
        <div className="flex items-center space-x-2">
            {subscribed ? (
                <>
                    <span className="text-xs text-sage font-medium">Notifications enabled</span>
                    <button
                        onClick={handleTestNotification}
                        disabled={testing}
                        className="text-xs font-medium text-blue-500 hover:underline disabled:opacity-50 ml-2"
                    >
                        {testing ? 'Sending...' : 'Test'}
                    </button>
                </>
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
