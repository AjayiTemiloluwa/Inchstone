'use client'

import { useState, useEffect } from 'react'

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [canInstall, setCanInstall] = useState(false)

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setCanInstall(true)
        }

        window.addEventListener('beforeinstallprompt', handler)

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
        }

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) {
            // Show manual instructions if prompt not available
            alert('To install: tap Chrome menu (⋮) → "Add to Home screen"')
            return
        }

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
            setIsInstalled(true)
            setCanInstall(false)
        }
        setDeferredPrompt(null)
    }

    if (isInstalled) return null

    // Show install button if we have the prompt, otherwise show manual instructions button
    if (!canInstall) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
            <div className="flex items-start gap-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">Install Inchstone</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        Install this app on your phone for quick access and offline use.
                    </p>
                    <button
                        onClick={handleInstall}
                        className="w-full bg-black text-white dark:bg-white dark:text-black text-sm font-medium py-2 px-4 rounded-lg hover:opacity-80 transition-opacity"
                    >
                        Install App
                    </button>
                </div>
            </div>
        </div>
    )
}

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isInstalled, setIsInstalled] = useState(false)

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e)
        }

        window.addEventListener('beforeinstallprompt', handler)

        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
        }

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const promptInstall = async () => {
        if (!deferredPrompt) {
            alert('To install: tap Chrome menu (⋮) → "Add to Home screen"')
            return false
        }

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        setDeferredPrompt(null)
        return outcome === 'accepted'
    }

    return { promptInstall, isInstalled, canInstall: !!deferredPrompt }
}
