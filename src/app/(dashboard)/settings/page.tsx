'use client'

import { useUser } from '@clerk/nextjs'
import type { ReactNode } from 'react'
import { PushNotificationManager } from '@/components/ui/PushNotificationManager'
import { AlarmsCard } from '@/components/ui/AlarmsCard'
import { useInstallPrompt } from '@/components/ui/InstallPrompt'
import { ThemeSwitch } from '@/components/ui/ThemeToggle'
import { AccentPicker } from '@/components/ui/AccentPicker'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Smartphone, Database, ChevronDown, RotateCcw } from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { GoogleCalendarCard } from '@/components/ui/GoogleCalendarCard'
import { WidgetCard } from '@/components/ui/WidgetCard'
import { Scramble } from '@/components/ui/motion'
import { useToast } from '@/components/ui/ToastProvider'
import { Page, PageHeader, Section, Panel, Button, Badge, cx } from '@/components/ds'

/**
 * One settings row: label + one-line description on the left, the control on
 * the right (stacked under it on phones). Local to Settings for now.
 */
function SettingRow({ label, description, children, className }: {
  label: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6', className)}>
      <div className="min-w-0">
        <p className="text-body font-medium text-parchment">{label}</p>
        {description && <p className="mt-1 text-caption text-parchment/55">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Hairline between rows inside one Panel. */
const Divider = () => <div aria-hidden="true" className="h-px bg-gold/10" />

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const { promptInstall, installHint, dismissInstallHint } = useInstallPrompt()
  const { showToast, confirm } = useToast()
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
    if (!(await confirm('This will create the default structure for the current year (it is normally created automatically). Proceed?'))) return
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to seed framework', 'error')
      } else {
        showToast('Framework seeded.', 'success')
        setTimeout(() => window.location.reload(), 800)
      }
    } catch {
      showToast('Error seeding framework', 'error')
    } finally {
      setSeeding(false)
    }
  }

  const handleResetFramework = async () => {
    if (!(await confirm('WARNING: This will delete all items, tasks, habits, financial entries, notes, reviews, events, trackers, and settings, then reseed the framework. This cannot be undone.'))) return
    if (!(await confirm('Final check: are you absolutely sure? This permanently deletes all your data.'))) return
    setSeeding(true)
    try {
      const resetRes = await fetch('/api/reset', { method: 'POST' })
      if (!resetRes.ok) {
        const data = await resetRes.json()
        showToast(data.error || 'Failed to reset data', 'error')
        return
      }
      const seedRes = await fetch('/api/seed', { method: 'POST' })
      if (!seedRes.ok) {
        const data = await seedRes.json()
        showToast(data.error || 'Failed to seed framework', 'error')
      } else {
        showToast('Data reset and framework seeded.', 'success')
        setTimeout(() => window.location.reload(), 800)
      }
    } catch {
      showToast('Error resetting data', 'error')
    } finally {
      setSeeding(false)
    }
  }

  if (!isLoaded) {
    return <Loader label="Tuning your settings…" routeKey="settings" />
  }

  return (
    <Page width="narrow" className="pb-24">
      <PageHeader
        eyebrow="Preferences"
        title={<Scramble text="Settings" mono={false} />}
        description="How Inchstone looks, reaches you, and connects to the rest of your day."
      />

      {/* Profile */}
      <Section id="settings-profile" title="Profile">
        <Panel>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/15 bg-mist font-display text-heading text-parchment/50">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                user?.firstName?.charAt(0) || '?'
              )}
            </div>
            <div className="min-w-0">
              <p className="break-words text-heading text-parchment">{user?.fullName || 'User'}</p>
              <p className="break-all font-mono text-mono text-parchment/60">{user?.primaryEmailAddress?.emailAddress || 'No email'}</p>
              <p className="mt-1 text-caption text-parchment/40">Account managed via Clerk</p>
            </div>
          </div>
        </Panel>
      </Section>

      {/* Appearance — the Light/Dark switch */}
      <Section id="settings-appearance" title="Appearance">
        <Panel className="space-y-5">
          <SettingRow label="Theme" description="Dark is the classic midnight look. Light is warm paper.">
            <ThemeSwitch />
          </SettingRow>
          <Divider />
          <AccentPicker />
        </Panel>
      </Section>

      {/* Notifications + alarms */}
      <Section id="settings-notifications" title="Notifications">
        <div className="space-y-4">
          <Panel>
            <SettingRow label="Push notifications" description="Get notified for nudges and reminders.">
              <PushNotificationManager />
            </SettingRow>
          </Panel>
          <Panel className="space-y-5">
            <SettingRow
              label="Alarms"
              description="Rings in-app with sound, and pushes to your devices even when the app is closed."
            />
            <AlarmsCard />
          </Panel>
        </div>
      </Section>

      {/* Google Calendar — pull / two-way sync (the card carries its own surface) */}
      <Section id="settings-calendar" title="Calendar">
        <GoogleCalendarCard />
      </Section>

      {/* Email delivery — partner invites */}
      <Section id="settings-email" title="Email delivery">
        <Panel>
          <SettingRow label="Partner invites" description="How partner invites reach their inbox.">
            {emailStatus === null ? (
              <Badge>Checking…</Badge>
            ) : emailStatus.ready ? (
              <Badge tone="moss">Ready</Badge>
            ) : (
              <Badge tone="ember">{!emailStatus.apiKey ? 'Off' : 'Needs domain'}</Badge>
            )}
          </SettingRow>

          {emailStatus !== null && (
            <div className="mt-4 space-y-2 border-t border-gold/10 pt-4 text-body text-parchment/55">
              {emailStatus.ready ? (
                <p className="flex items-start gap-2 text-moss">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span>Ready — partner invites are being emailed from <span className="break-all font-mono">{emailStatus.from}</span>.</span>
                </p>
              ) : (
                <>
                  <p className="flex items-start gap-2 text-ember">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span>
                      {!emailStatus.apiKey
                        ? 'Not set up — invite emails are turned off.'
                        : 'Almost set up — invite emails can’t deliver to partners yet.'}
                    </span>
                  </p>
                  {emailStatus.apiKey && (
                    <p className="text-caption text-parchment/50">
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
                    <p className="text-caption text-parchment/50">
                      Add a <span className="font-mono">RESEND_API_KEY</span> to your environment to start sending invite
                      emails.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </Panel>
      </Section>

      {/* Devices — install + home-screen widget */}
      <Section id="settings-devices" title="Devices">
        <div className="space-y-4">
          <Panel className="space-y-4">
            <SettingRow label="Add to home screen" description="Install Inchstone for quick access.">
              <Button
                variant="primary"
                icon={Smartphone}
                onClick={promptInstall}
                data-cursor="Put Inchstone in your pocket"
                className="w-full sm:w-auto"
              >
                Install
              </Button>
            </SettingRow>
            {installHint && (
              <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-gold/15 bg-gold/[0.04] px-4 py-3 text-body text-parchment/80">
                <span>{installHint}</span>
                <Button variant="ghost" size="sm" onClick={dismissInstallHint} className="shrink-0 text-gold">Dismiss</Button>
              </div>
            )}
          </Panel>

          <Panel className="space-y-5">
            <SettingRow
              label="Home-screen widget"
              description="Pair the Android Inchstone Widget app and design what it shows on your phone’s home screen."
            />
            <WidgetCard />
          </Panel>
        </div>
      </Section>

      {/* Danger zone — collapsed by default, always last */}
      <Section id="settings-danger" title={<span className="text-ember">Danger zone</span>}>
        <Panel bordered={false} className="border border-ember/30">
          <button
            type="button"
            onClick={() => setDangerOpen(o => !o)}
            aria-expanded={dangerOpen}
            aria-controls="settings-danger-body"
            className="-m-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            <span className="min-w-0">
              <span className="block text-body font-medium text-ember">Data &amp; reset</span>
              <span className="mt-1 block text-caption text-parchment/50">Reseed the framework or wipe everything.</span>
            </span>
            <ChevronDown
              className={cx('h-4 w-4 shrink-0 text-parchment/45 transition-transform motion-reduce:transition-none', dangerOpen && 'rotate-180')}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>

          {dangerOpen && (
            <div id="settings-danger-body" className="mt-5 space-y-5 border-t border-ember/20 pt-5">
              <SettingRow label="Seed default framework" description="Create the default annual hierarchy.">
                <Button variant="secondary" icon={Database} onClick={handleSeedFramework} disabled={seeding}>
                  {seeding ? 'Working…' : 'Seed'}
                </Button>
              </SettingRow>
              <Divider />
              <SettingRow label="Reset all data & reseed" description="Deletes everything. This cannot be undone.">
                <Button variant="danger" icon={RotateCcw} onClick={handleResetFramework} disabled={seeding}>
                  {seeding ? 'Working…' : 'Reset & Seed'}
                </Button>
              </SettingRow>
            </div>
          )}
        </Panel>
      </Section>
    </Page>
  )
}
