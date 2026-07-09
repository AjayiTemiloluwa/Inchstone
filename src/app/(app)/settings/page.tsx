'use client'

import { useUser } from '@clerk/nextjs'
import { Card } from '@/components/ui/Card'
import { PushNotificationManager } from '@/components/items/PushNotificationManager'
import { useState, useEffect } from 'react'
import { Calendar, CheckCircle, XCircle, ExternalLink, Sun, Moon, Smartphone, Database } from 'lucide-react'
import { useInstallPrompt } from '@/components/layout/InstallPrompt'

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const [calConnected, setCalConnected] = useState<boolean | null>(null)
  const [checkingCal, setCheckingCal] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    checkCalendarStatus()
    loadTheme()
  }, [])

  const loadTheme = () => {
    const stored = localStorage.getItem('theme')
    if (stored) {
      setDarkMode(stored === 'dark')
    } else {
      setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }

  const toggleTheme = () => {
    const newTheme = !darkMode
    setDarkMode(newTheme)
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', newTheme)
  }

  const checkCalendarStatus = async () => {
    setCheckingCal(true)
    try {
      const res = await fetch('/api/calendar/events?timeMin=2026-01-01T00:00:00.000Z&timeMax=2026-01-02T00:00:00.000Z')
      const data = await res.json()
      if (data.needsAuth) {
        setCalConnected(false)
      } else if (data.error === 'Calendar not connected') {
        setCalConnected(false)
      } else {
        setCalConnected(true)
      }
    } catch {
      setCalConnected(false)
    } finally {
      setCheckingCal(false)
    }
  }

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch('/api/calendar/auth')
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      console.error('Failed to get auth URL', err)
    }
  }

  const [calError, setCalError] = useState<string | null>(null)
  const { promptInstall, canInstall } = useInstallPrompt()

  const handleSeedFramework = async () => {
    if (!confirm('This will seed the default year structure. Proceed?')) return
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to seed framework')
      } else {
        alert('Framework seeded successfully!')
        window.location.reload()
      }
    } catch (e) {
      console.error(e)
      alert('Error seeding framework')
    } finally {
      setSeeding(false)
    }
  }

  const handleDisconnectCalendar = async () => {
    setCalError(null)
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      if (res.ok) {
        setCalConnected(false)
      } else {
        setCalError('Failed to disconnect calendar.')
      }
    } catch {
      setCalError('Network error. Please try again.')
    }
  }

  if (!isLoaded) {
    return <div className="flex justify-center items-center h-full">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <h1 className="text-2xl font-display font-bold text-ink">Settings</h1>

      {/* Profile Section */}
      <Card className="space-y-6">
        <h2 className="text-lg font-bold text-ink">Profile</h2>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-mist rounded-full flex items-center justify-center text-2xl font-bold text-ink/50 overflow-hidden">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user?.firstName?.charAt(0) || '?'
            )}
          </div>
          <div>
            <p className="font-bold text-ink">{user?.fullName || 'User'}</p>
            <p className="text-sm text-ink/70">
              {user?.primaryEmailAddress?.emailAddress || 'No email'}
            </p>
            <p className="text-xs text-ink/50 mt-1">
              Account managed via Clerk
            </p>
          </div>
        </div>
      </Card>

      {/* Calendar Integration */}
      <Card className="space-y-6">
        <h2 className="text-lg font-bold text-ink flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gold" />
          <span>Google Calendar</span>
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">Calendar Integration</p>
            <p className="text-sm text-ink/70 mt-1">
              Connect your Google Calendar to view events alongside your daily deeds.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {checkingCal ? (
              <span className="text-sm text-ink/50">Checking...</span>
            ) : calConnected ? (
              <>
                <span className="flex items-center space-x-1 text-sm text-sage font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>Connected</span>
                </span>
                <button
                  onClick={handleDisconnectCalendar}
                  className="px-3 py-1.5 text-sm border border-coral/30 text-coral rounded-lg hover:bg-coral/5 transition"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <span className="flex items-center space-x-1 text-sm text-ink/50">
                  <XCircle className="w-4 h-4" />
                  <span>Not connected</span>
                </span>
                <button
                  onClick={handleConnectCalendar}
                  className="px-3 py-1.5 text-sm bg-gold text-surface rounded-lg hover:bg-gold/90 transition flex items-center space-x-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Connect</span>
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="space-y-6">
        <h2 className="text-lg font-bold text-ink">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">Push Notifications</p>
            <p className="text-sm text-ink/70 mt-1">
              Receive notifications for nudge messages and reminders.
            </p>
          </div>
          <PushNotificationManager />
        </div>
      </Card>

      {/* Install App */}
      <Card className="space-y-6">
        <h2 className="text-lg font-bold text-ink flex items-center space-x-2">
          <Smartphone className="w-5 h-5 text-gold" />
          <span>Install App</span>
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">Add to Home Screen</p>
            <p className="text-sm text-ink/70 mt-1">
              Install Inchstone on your phone for quick access and offline use.
            </p>
          </div>
          <button
            onClick={promptInstall}
            className="px-4 py-2 bg-gold text-paper rounded-lg hover:bg-gold-glow transition"
          >
            Install
          </button>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="space-y-6">
        <h2 className="text-lg font-bold text-ink">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">Theme</p>
            <p className="text-sm text-ink/70 mt-1">
              Switch between dark and light mode.
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 bg-gold text-paper rounded-lg hover:bg-gold-glow transition flex items-center space-x-2"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </Card>

      {/* Danger Zone / Admin */}
      <Card className="space-y-6 border-red-500/20">
        <h2 className="text-lg font-bold text-red-500 flex items-center space-x-2">
          <Database className="w-5 h-5" />
          <span>System</span>
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">Seed Framework</p>
            <p className="text-sm text-ink/70 mt-1">
              Initializes the default annual framework (run only once).
            </p>
          </div>
          <button
            onClick={handleSeedFramework}
            disabled={seeding}
            className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Seed Data'}
          </button>
        </div>
      </Card>
    </div>
  )
}
