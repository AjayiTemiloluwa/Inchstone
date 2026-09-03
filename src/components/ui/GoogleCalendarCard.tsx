'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'

type SyncMode = 'pull' | 'two'

interface CalendarStatus {
  configured: boolean
  connected: boolean
  mode: SyncMode | null
  lastSyncedAt: string | null
}

const MODES: { value: SyncMode; label: string; hint: string }[] = [
  {
    value: 'pull',
    label: 'Pull only',
    hint: 'Google events appear in your day + month views. Recommended.',
  },
  {
    value: 'two',
    label: 'Two-way',
    hint: 'Also pushes your scheduled deeds out to Google Calendar.',
  },
]

export function GoogleCalendarCard() {
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [choice, setChoice] = useState<SyncMode>('pull')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [redirectHint, setRedirectHint] = useState<string | null>(null)
  const backfilledRef = useRef(false)

  const probe = useCallback(async (): Promise<CalendarStatus | null> => {
    try {
      const res = await fetch('/api/calendar/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('status failed')
      const data: CalendarStatus = await res.json()
      setStatus(data)
      if (data.connected && data.mode) setChoice(data.mode)
      return data
    } catch {
      setStatus({ configured: false, connected: false, mode: null, lastSyncedAt: null })
      return null
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      const data = await probe()
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      // Returning from the OAuth consent screen — clean the query param and,
      // if the grant was two-way, backfill already-scheduled deeds once.
      if (params?.has('calendar')) {
        window.history.replaceState({}, '', window.location.pathname)
        if (params.get('calendar') === 'connected') {
          if (data?.connected && data.mode === 'two' && !backfilledRef.current) {
            backfilledRef.current = true
            void pushBackfill()
          }
        } else if (params.get('calendar') === 'error') {
          setNote(
            'Google sign-in did not complete. If Google showed "redirect_uri_mismatch", add the Redirect URI shown below to your OAuth client in Google Cloud Console → APIs & Services → Credentials, then connect again.',
          )
        }
      }
    })()
  }, [probe])

  async function pushBackfill() {
    try {
      const res = await fetch('/api/calendar/sync-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 60 }),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.pushed > 0) {
          setNote(`Backfilled ${d.pushed} scheduled deed${d.pushed === 1 ? '' : 's'} to Google.`)
        }
      }
    } catch {
      /* quiet — the next manual sync will catch up */
    }
  }

  const connect = async () => {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch(`/api/calendar/auth?mode=${choice}`)
      const data = await res.json()
      if (data.redirect_uri) setRedirectHint(data.redirect_uri)
      if (data.url) {
        window.location.href = data.url
      } else {
        setNote(data.error || 'Could not start Google sign-in.')
      }
    } catch {
      setNote('Could not start Google sign-in.')
    } finally {
      setBusy(false)
    }
  }

  const pickMode = async (mode: SyncMode) => {
    if (busy || status === null) return
    if (!status.connected) {
      setChoice(mode)
      return
    }
    if (mode === choice) return
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch('/api/calendar/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (data.ok) {
        setChoice(mode)
        setStatus(s => (s ? { ...s, mode } : s))
        if (mode === 'two') void pushBackfill()
        setNote(mode === 'two' ? 'Two-way sync is on.' : 'Switched to pull-only — Google events still flow in.')
      } else if (data.needsReauth) {
        // Write scope missing — run the OAuth flow once more with mode=two.
        const authRes = await fetch('/api/calendar/auth?mode=two')
        const authData = await authRes.json()
        if (authData.url) {
          window.location.href = authData.url
        } else {
          setNote('Google needs to confirm write access — try again shortly.')
        }
      } else {
        setNote(data.error || 'Could not switch mode.')
      }
    } catch {
      setNote('Could not switch mode.')
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async () => {
    setBusy(true)
    setNote(null)
    try {
      const from = new Date(Date.now() - 7 * 86_400_000)
      const to = new Date(Date.now() + 60 * 86_400_000)
      const res = await fetch(`/api/calendar/events?timeMin=${from.toISOString()}&timeMax=${to.toISOString()}`)
      const data = await res.json()
      if (data.needsAuth) {
        await probe()
        setNote('Session expired — reconnect to continue.')
      } else if (Array.isArray(data.events)) {
        setNote(`Synced — ${data.events.length} event${data.events.length === 1 ? '' : 's'} in view.`)
      } else {
        setNote(data.error || 'Sync failed.')
      }
    } catch {
      setNote('Sync failed.')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      if (res.ok) {
        await probe()
        setNote('Calendar disconnected.')
      }
    } catch {
      /* keep state unchanged */
    } finally {
      setBusy(false)
    }
  }

  const fmtLast = (iso: string | null) => {
    if (!iso) return null
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const configured = status !== null && status.configured
  const connected = status !== null && status.connected

  return (
    <Card className="p-5 border hairline">
      <h2 className="text-heading text-parchment flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gold-dim" strokeWidth={1.5} />
        <span>Google Calendar</span>
      </h2>
      <p className="mt-1 text-xs text-parchment/45">
        View Google events alongside your daily deeds — optionally push deeds back.
      </p>

      {/* Mode selector */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MODES.map(m => {
          const active = choice === m.value
          return (
            <button
              key={m.value}
              onClick={() => pickMode(m.value)}
              disabled={busy || status === null}
              data-cursor={`Use ${m.label.toLowerCase()} sync`}
              className={`text-left rounded-md border px-3 py-2.5 transition-colors disabled:opacity-60 ${
                active ? 'border-gold/60 bg-gold/5' : 'border-hairline hover:border-parchment/25'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-gold' : 'bg-parchment/20'}`} />
                <span className={`text-sm font-medium ${active ? 'text-parchment' : 'text-parchment/70'}`}>
                  {m.label}
                </span>
                {m.value === 'pull' && (
                  <span className="font-mono text-[10px] text-gold-dim/80">recommended</span>
                )}
              </span>
              <span className="block mt-1 text-xs text-parchment/45">{m.hint}</span>
            </button>
          )
        })}
      </div>

      {/* Status + actions */}
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        {status === null ? (
          <span className="font-mono text-sm text-parchment/45">Checking…</span>
        ) : !configured ? (
          <span className="flex items-center gap-1.5 font-mono text-sm text-ember/80">
            <XCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Not set up — add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
          </span>
        ) : connected ? (
          <span className="flex items-center gap-1.5 font-mono text-sm text-moss/80 flex-wrap">
            <CheckCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Connected · {status.mode === 'two' ? 'two-way' : 'pull-only'}
            {fmtLast(status.lastSyncedAt) && (
              <span className="text-parchment/35">· synced {fmtLast(status.lastSyncedAt)}</span>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-mono text-sm text-parchment/45">
            <XCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Not connected
          </span>
        )}

        <div className="flex items-center gap-2">
          {configured && connected && (
            <button
              onClick={syncNow}
              disabled={busy}
              data-cursor="Pull events from Google now"
              className="rounded-md border-hairline px-3 py-1.5 text-sm text-parchment hover:border-gold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              Sync now
            </button>
          )}
          {configured && !connected && (
            <button
              onClick={connect}
              disabled={busy}
              data-cursor="Sync your Google Calendar"
              className="rounded-md border-hairline px-3 py-1.5 text-sm text-parchment hover:border-gold transition-colors disabled:opacity-50"
            >
              Connect
            </button>
          )}
          {configured && connected && (
            <button
              onClick={disconnect}
              disabled={busy}
              data-cursor="Unlink your calendar"
              className="rounded-md border border-ember/40 px-3 py-1.5 text-sm text-[#cf8f78] hover:bg-ember/15 transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {configured && !connected && choice === 'two' && (
        <p className="mt-2 text-xs text-parchment/45">
          Two-way needs write access — Google will ask you to confirm once.
        </p>
      )}
      {note && <p className="mt-2 text-xs font-mono text-parchment/50">{note}</p>}
      {redirectHint && (
        <p className="mt-1 break-all font-mono text-[11px] text-gold-dim/80">
          Redirect URI: {redirectHint}
        </p>
      )}
    </Card>
  )
}
