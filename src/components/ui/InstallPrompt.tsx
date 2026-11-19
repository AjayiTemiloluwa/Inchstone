﻿'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const MANUAL_INSTALL_HINT = 'To install: tap the browser menu (⋮) → "Add to Home screen"'

// Whether the app is already running as an installed (standalone) app.
function subscribeStandalone(cb: () => void) {
    const mq = window.matchMedia('(display-mode: standalone)')
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
}
const getStandalone = () => window.matchMedia('(display-mode: standalone)').matches
const getStandaloneServer = () => false

function readDismissed(): boolean {
    try { return localStorage.getItem('installPromptDismissed') === 'true' } catch { return false }
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [installedNow, setInstalledNow] = useState(false)
    const [canInstall, setCanInstall] = useState(false)
    // The banner stays hidden until a beforeinstallprompt arrives, so reading the
    // stored choice lazily cannot cause a visible hydration mismatch.
    const [dismissed, setDismissed] = useState(readDismissed)
    const [hint, setHint] = useState<string | null>(null)
    const standalone = useSyncExternalStore(subscribeStandalone, getStandalone, getStandaloneServer)
    const isInstalled = standalone || installedNow

    useEffect(() => {
        if (dismissed) return

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setCanInstall(true)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [dismissed])

    const handleInstall = async () => {
        if (!deferredPrompt) {
            // Show manual instructions inline if the prompt isn't available
            setHint(MANUAL_INSTALL_HINT)
            return
        }

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
            setInstalledNow(true)
            setCanInstall(false)
        }
        setDeferredPrompt(null)
    }

    const handleDismiss = () => {
        setDismissed(true)
        try { localStorage.setItem('installPromptDismissed', 'true') } catch { /* storage blocked */ }
    }

    if (isInstalled || dismissed) return null

    // Show install button if we have the prompt, otherwise show manual instructions button
    if (!canInstall) return null

    return (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 md:left-auto md:right-4 md:w-80 bg-dialog border border-gold/25 rounded-lg shadow-[0_12px_36px_rgb(var(--shadow-rgb)/0.28)] p-4 z-[60] md:bottom-4">
            <div className="flex items-start gap-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1 text-parchment">Install Inchstone</h3>
                    <p className="text-xs text-parchment/70 mb-3">
                        Install this app on your phone for quick access and offline use.
                    </p>
                    <button
                        onClick={handleInstall}
                        className="w-full bg-gold text-ink text-sm font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Install App
                    </button>
                    {hint && (
                        <p role="status" className="mt-2 text-xs text-parchment/70">{hint}</p>
                    )}
                </div>
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 p-2 -m-1 text-parchment/50 hover:text-parchment transition-colors"
                    aria-label="Dismiss install prompt"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    )
}

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [installHint, setInstallHint] = useState<string | null>(null)
    const isInstalled = useSyncExternalStore(subscribeStandalone, getStandalone, getStandaloneServer)

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const promptInstall = async () => {
        if (!deferredPrompt) {
            setInstallHint(MANUAL_INSTALL_HINT)
            return false
        }

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        setDeferredPrompt(null)
        return outcome === 'accepted'
    }

    return { promptInstall, isInstalled, canInstall: !!deferredPrompt, installHint, dismissInstallHint: () => setInstallHint(null) }
}
