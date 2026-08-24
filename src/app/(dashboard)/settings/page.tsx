'use client'

import { useUser } from '@clerk/nextjs'
import { Card } from '@/components/ui/Card'
import { PushNotificationManager } from '@/components/ui/PushNotificationManager'
import { useInstallPrompt } from '@/components/ui/InstallPrompt'
import { useState, useEffect } from 'react'
import { Calendar, CheckCircle, XCircle, ExternalLink, Smartphone, Trash2, Database, ChevronDown } from 'lucide-react'

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const { promptInstall } = useInstallPrompt()
  const [calConnected, setCalConnected] = useState<boolean | null>(null)
  const [checkingCal, setCheckingCal] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)

  const checkCalendarStatus = async () => {
    setCheckingCal(true)
    try {
      const res = await fetch('/api/calendar/events?timeMin=2026-01-01T00:00:00.000Z&timeMax=2026-01-02T00:00:00.000Z')
      const data = await res.json()
      if (data.needsAuth) setCalConnected(false)
      else if (data.error === 'Calendar not connected') setCalConnected(false)
      else setCalConnected(true)
    } catch {
      setCalConnected(false)
    } finally {
      setCheckingCal(false)
    }
  }

  useEffect(() => {
    checkCalendarStatus()
  }, [])

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch('/api/calendar/auth')
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch (err) {
      console.error('Failed to get auth URL', err)
    }
  }

  const handleDisconnectCalendar = async () => {
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      if (res.ok) setCalConnected(false)
    } catch {
      /* keep state unchanged */
    }
  }

  const handleSeedFramework = async () => {
    if (!confirm('This will create the default yearly structure. Proceed?')) return
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to seed framework')
      } else {
        alert('Framework seeded.')
        window.location.reload()
      }
    } catch {
      alert('Error seeding framework')
    } finally {
      setSeeding(false)
    }
  }

  const handleResetFramework = async () => {
    if (!confirm('WARNING: This will delete all items, tasks, habits, financial entries, notes, reviews, events, trackers, and settings, then reseed the framework. This cannot be undone.')) return
    if (!confirm('Are you absolutely sure? This permanently deletes all your data.')) return
    setSeeding(true)
    try {
      const resetRes = await fetch('/api/reset', { method: 'POST' })
      if (!resetRes.ok) {
        const data = await resetRes.json()
        alert(data.error || 'Failed to reset data')
        return
      }
      const seedRes = await fetch('/api/seed', { method: 'POST' })
      if (!seedRes.ok) {
        const data = await seedRes.json()
        alert(data.error || 'Failed to seed framework')
      } else {
        alert('Data reset and framework seeded.')
        window.location.reload()
      }
    } catch {
      alert('Error resetting data')
    } finally {
      setSeeding(false)
    }
  }

  if (!isLoaded) {
    return <div className="flex justify-center items-center h-full font-mono text-sm text-parchment/40">Loading…</div>
  }

  return (
    <div className="max-w-[720px] mx-auto space-y-8 pb-24">
      <h1 className="text-h1 text-parchment">Settings</h1>

      {/* Profile */}
      <Card className="space-y-4 p-5 border hairline">
        <h2 className="text-heading text-parchment">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-mist flex items-center justify-center text-2xl font-bold text-parchment/50 overflow-hidden">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user?.firstName?.charAt(0) || '?'
            )}
          </div>
          <div>
            <p className="font-semibold text-parchment">{user?.fullName || 'User'}</p>
            <p className="text-sm text-parchment/60">{user?.primaryEmailAddress?.emailAddress || 'No email'}</p>
            <p className="text-xs text-parchment/40 mt-1">Account managed via Clerk</p>
          </div>
        </div>
      </Card>

      {/* Google Calendar */}
      <Card className="p-5 border hairline">
        <h2 className="text-heading text-parchment flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gold-dim" strokeWidth={1.5} />
          <span>Google Calendar</span>
        </h2>
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-parchment/55">
            Connect Google Calendar to view events alongside your daily deeds.
          </p>
          <div className="flex items-center gap-3">
            {checkingCal ? (
              <span className="font-mono text-sm text-parchment/45">Checking…</span>
            ) : calConnected ? (
              <>
                <span className="flex items-center gap-1.5 font-mono text-sm text-moss/80">
                  <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
                  Connected
                </span>
                <button
                  onClick={handleDisconnectCalendar}
                  className="rounded-md border border-ember/40 px-3 py-1.5 text-sm text-[#cf8f78] hover:bg-ember/15 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-mono text-sm text-parchment/45">
                  <XCircle className="w-4 h-4" strokeWidth={1.5} />
                  Not connected
                </span>
                <button
                  onClick={handleConnectCalendar}
                  className="rounded-md border-hairline px-3 py-1.5 text-sm text-parchment hover:border-gold transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Connect
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="space-y-5 p-5 border hairline">
        <h2 className="text-heading text-parchment">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-parchment">Push Notifications</p>
            <p className="text-sm text-parchment/60 mt-1">Get notified for nudges and reminders.</p>
          </div>
          <PushNotificationManager />
        </div>
      </Card>

      {/* Install App */}
      <Card className="space-y-5 p-5 border hairline">
        <h2 className="text-heading text-parchment flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-gold-dim" strokeWidth={1.5} />
          <span>Install App</span>
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-parchment">Add to Home Screen</p>
            <p className="text-sm text-parchment/60 mt-1">Install Inchstone for quick access.</p>
          </div>
          <button
            onClick={promptInstall}
            className="rounded-md bg-gold px-6 py-3 text-body font-semibold text-ink hover:bg-[#cbaa6f] transition-colors"
          >
            Install
          </button>
        </div>
      </Card>

      {/* Danger zone — collapsed by default */}
      <Card className="space-y-4 p-5 border hairline">
        <button
          type="button"
          onClick={() => setDangerOpen(o => !o)}
          aria-expanded={dangerOpen}
          className="flex w-full items-center justify-between text-left text-heading text-[#cf8f78]"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[#cf8f78]" strokeWidth={1.5} />
            Data & Reset
          </span>
          <ChevronDown className={`w-4 h-4 text-parchment/45 transition-transform ${dangerOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </button>

        {dangerOpen && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              <div>
                <p className="font-medium text-parchment">Seed default framework</p>
                <p className="text-sm text-parchment/60 mt-1">Create the default annual hierarchy.</p>
              </div>
              <button
                onClick={handleSeedFramework}
                disabled={seeding}
                className="rounded-md border hairline px-4 py-2 text-sm text-parchment hover:border-gold transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Database className="w-4 h-4" strokeWidth={1.5} />
                {seeding ? 'Working…' : 'Seed'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 border-t border-gold-dim/20 pt-3">
              <div>
                <p className="font-medium text-parchment">Reset all data & reseed</p>
                <p className="text-sm text-parchment/60 mt-1">Deletes everything. This cannot be undone.</p>
              </div>
              <button
                onClick={handleResetFramework}
                disabled={seeding}
                className="rounded-md border border-ember/40 px-4 py-2 text-sm text-[#cf8f78] hover:bg-ember/15 transition-colors disabled:opacity-50"
              >
                {seeding ? 'Working…' : 'Reset & Seed'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}