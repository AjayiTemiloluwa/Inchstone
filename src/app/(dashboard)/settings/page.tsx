'use client'

import { useUser } from '@clerk/nextjs'
import { Card } from '@/components/ui/Card'
import { PushNotificationManager } from '@/components/ui/PushNotificationManager'
import { AlarmsCard } from '@/components/ui/AlarmsCard'
import { useInstallPrompt } from '@/components/ui/InstallPrompt'
import { ThemeSwitch } from '@/components/ui/ThemeToggle'
import { useState, useEffect } from 'react'
import { Mail, CheckCircle, XCircle, Smartphone, Trash2, Database, ChevronDown, Sun } from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { GoogleCalendarCard } from '@/components/ui/GoogleCalendarCard'
import { Scramble } from '@/components/ui/motion'

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const { promptInstall } = useInstallPrompt()
  const [seeding, setSeeding] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{
    ready: boolean
    apiKey: boolean
    domain: boolean
    devSender: boolean
    from: string
  } | null>(null)

  useEffect(() => {
    // Initial status probes — states start true/null so no setState fires
    // synchronously in the effect body.
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/email-status', { cache: 'no-store' })
        if (!cancelled && res.ok) setEmailStatus(await res.json())
      } catch {
        /* leave status null → card shows a quiet unknown state */
      }
    })()
    return () => { cancelled = true }
  }, [])

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
    return <Loader label="Tuning your settings…" routeKey="settings" />
  }

  return (
    <div className="max-w-[720px] mx-auto space-y-8 pb-24">
      <h1 className="text-h1 text-parchment"><Scramble text="Settings" mono={false} /></h1>

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

      {/* Appearance — the Light/Dark switch */}
      <Card className="p-5 border hairline">
        <h2 className="text-heading text-parchment flex items-center gap-2">
          <Sun className="w-4 h-4 text-gold-dim" strokeWidth={1.5} />
          <span>Appearance</span>
        </h2>
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-parchment/55">
            Dark is the classic midnight look. Light is warm paper.
          </p>
          <ThemeSwitch />
        </div>
      </Card>

      {/* Email delivery — partner invites */}
      <Card className="p-5 border hairline">
        <h2 className="text-heading text-parchment flex items-center gap-2">
          <Mail className="w-4 h-4 text-gold-dim" strokeWidth={1.5} />
          <span>Email delivery</span>
        </h2>
        <div className="mt-3 text-sm text-parchment/55">
          {emailStatus === null ? (
            <p>Checking…</p>
          ) : emailStatus.ready ? (
            <p className="flex items-center gap-2 text-moss">
              <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
              Ready — partner invites are being emailed from {emailStatus.from}.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-ember">
                <XCircle className="w-4 h-4" strokeWidth={1.5} />
                {!emailStatus.apiKey
                  ? 'Not set up — invite emails are turned off.'
                  : 'Almost set up — invite emails can’t deliver to partners yet.'}
              </p>
              {emailStatus.apiKey && (
                <p className="text-xs text-parchment/50">
                  Resend only lets <span className="font-mono">onboarding@resend.dev</span> send to your own account,
                  so partner invites are rejected until you verify a domain. Add one at{' '}
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-gold underline decoration-gold/40 underline-offset-2"
                  >
                    resend.com/domains
                  </a>{' '}
                  and set <span className="font-mono">EMAIL_FROM</span> to an address on it (e.g.{' '}
                  <span className="font-mono">hi@yourdomain.com</span>).
                </p>
              )}
              {!emailStatus.apiKey && (
                <p className="text-xs text-parchment/50">
                  Add a <span className="font-mono">RESEND_API_KEY</span> to your environment to start sending invite
                  emails.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Google Calendar — pull / two-way sync */}
      <GoogleCalendarCard />

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

      {/* Alarms */}
      <Card className="space-y-5 p-5 border hairline">
        <div>
          <h2 className="text-heading text-parchment">Alarms</h2>
          <p className="text-sm text-parchment/60 mt-1">
            Rings in-app with sound, and pushes to your devices even when the app is closed.
          </p>
        </div>
        <AlarmsCard />
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
            data-cursor="Put Inchstone in your pocket"
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