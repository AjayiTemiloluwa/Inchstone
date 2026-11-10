'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, RefreshCw, Plus, Smartphone, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

type WidgetPage = {
  kind: 'plan' | 'timers' | 'tasks' | 'alarms' | 'messages' | 'clock' | 'note'
  note?: string
  accent?: string
  bg?: string
  /** Per-element text styling, applied by the native widget. */
  styles?: Record<string, { color?: string; size?: number }>
}

type WidgetConfig = {
  pages: WidgetPage[]
  rotateSeconds: number
  showPlan: boolean
  showAlarms: boolean
  showMessages: boolean
}

const KINDS: WidgetPage['kind'][] = ['plan', 'timers', 'tasks', 'alarms', 'messages', 'clock', 'note']
const HIDDEN_BY: Partial<Record<WidgetPage['kind'], keyof WidgetConfig>> = { plan: 'showPlan', timers: 'showPlan', tasks: 'showPlan', alarms: 'showAlarms', messages: 'showMessages' }

const ago = (iso: string | null, now: number) => {
  if (!iso || !now) return null
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} days ago`
}

/**
 * WidgetCard — Settings → Widget. Pair the native Android home-screen widget
 * (server + pairing secret), see when the phone last synced, and design what
 * it shows: which pages, in what order, with what colours and text size.
 */
export function WidgetCard() {
  const { confirm } = useToast()
  const [secret, setSecret] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [cfg, setCfg] = useState<WidgetConfig | null>(null)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [lastSync, setLastSync] = useState<{ at: string | null; agent: string | null }>({ at: null, agent: null })
  const [host, setHost] = useState('')
  const [now, setNow] = useState(0) // the clock for "synced 3 min ago", ticked with the poll below
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadPref = useCallback(async () => {
    const res = await fetch('/api/widget?pref=1', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    setLastSync({ at: data.widget?.lastSyncAt ?? null, agent: data.widget?.lastSyncAgent ?? null })
    setNow(Date.now())
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setHost(window.location.host)
        const [data, secretRes] = await Promise.all([loadPref(), fetch('/api/widget', { method: 'POST' })])
        if (cancelled) return
        if (data) {
          setCfg({
            pages: data.widget?.pages ?? [],
            rotateSeconds: data.widget?.rotateSeconds ?? 15,
            showPlan: data.widget?.showPlan ?? true,
            showAlarms: data.widget?.showAlarms ?? true,
            showMessages: data.widget?.showMessages ?? true,
          })
        }
        if (secretRes.ok) setSecret((await secretRes.json()).secret)
      } catch { /* leave states as-is */ }
    })()
    // Keep "Phone last synced" current while the page is open.
    const t = setInterval(() => { void loadPref().catch(() => null) }, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [loadPref])

  /** Save after a short pause, so typing a note sends one request, not one per letter. */
  const save = (next: WidgetConfig) => {
    setCfg(next)
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/widget', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
        setStatus(res.ok ? 'saved' : 'error')
      } catch { setStatus('error') }
    }, 500)
  }

  const copy = (what: string, text: string | null) => {
    if (!text || !navigator.clipboard) return
    void navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }

  const rotate = async () => {
    if (!(await confirm('Generate a new pairing secret? Devices paired with the old one will stop updating until re-paired.'))) return
    try {
      const res = await fetch('/api/widget?rotate=1', { method: 'POST' })
      if (res.ok) { setSecret((await res.json()).secret); setRevealed(true) }
    } catch { /* ignore */ }
  }

  const updatePage = (i: number, patch: Partial<WidgetPage>) => {
    if (!cfg) return
    save({ ...cfg, pages: cfg.pages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })
  }
  const move = (i: number, dir: -1 | 1) => {
    if (!cfg) return
    const j = i + dir
    if (j < 0 || j >= cfg.pages.length) return
    const pages = [...cfg.pages]
    ;[pages[i], pages[j]] = [pages[j], pages[i]]
    save({ ...cfg, pages })
  }

  if (!cfg) return null
  const synced = ago(lastSync.at, now)
  const fresh = !!lastSync.at && !!now && now - new Date(lastSync.at).getTime() < 2 * 3600_000

  return (
    <>
      {/* Pairing: the two things the phone app asks for */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-parchment">Server</p>
            <p className="text-sm text-parchment/60 mt-1">Type this in the app&apos;s “Server” box.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded border hairline px-2.5 py-1.5 text-xs text-parchment/80">{host || '…'}</code>
            <button onClick={() => copy('host', host)} className="rounded-md border hairline p-2 text-parchment hover:border-gold transition-colors" aria-label="Copy server address">
              <Copy className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-parchment">Pairing secret</p>
            <p className="text-sm text-parchment/60 mt-1">Paste this into the Inchstone Widget app on your Android phone.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="max-w-[10rem] sm:max-w-[12rem] truncate rounded border hairline px-2.5 py-1.5 text-xs text-parchment/70" aria-label="Widget pairing secret">
              {secret ? (revealed || copied === 'secret' ? secret : '••••••••••••') : '…'}
            </code>
            <button onClick={() => { copy('secret', secret); setRevealed(true) }} className="rounded-md border hairline p-2 text-parchment hover:border-gold transition-colors" aria-label="Copy pairing secret">
              <Copy className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button onClick={rotate} className="rounded-md border hairline p-2 text-parchment hover:border-gold transition-colors" aria-label="Regenerate pairing secret" title="Regenerate (unlinks paired devices)">
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        {copied && <p className="text-xs text-gold">Copied {copied === 'host' ? 'the server address' : 'the pairing secret'}.</p>}
        {/* Proof that it works: when the phone last fetched its widget */}
        <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${fresh ? 'border-emerald-500/30 text-emerald-300' : 'hairline text-parchment/60'}`}>
          <Smartphone className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          {synced
            ? <span>Phone last synced <b>{synced}</b>{lastSync.agent ? <span className="text-parchment/40"> · {lastSync.agent}</span> : null}</span>
            : <span>No phone has synced yet. Open the app, paste the secret, type the server above, tap <b>Pair &amp; refresh</b>.</span>}
        </div>
      </div>

      {/* What the widget includes */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gold-dim/20 pt-4">
        {([['showPlan', 'Plan'], ['showAlarms', 'Alarms'], ['showMessages', 'Partner messages']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => save({ ...cfg, [key]: !cfg[key] })}
            aria-pressed={cfg[key]}
            title={cfg[key] ? `${label} pages are shown — tap to hide them` : `${label} pages are hidden — tap to show them`}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${cfg[key] ? 'border-gold/60 bg-gold/10 text-gold' : 'hairline text-parchment/50 line-through'}`}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-parchment/60">
          Rotate every
          <input
            type="number" min={5} max={120} value={cfg.rotateSeconds}
            onChange={(e) => save({ ...cfg, rotateSeconds: Math.min(120, Math.max(5, Number(e.target.value) || 15)) })}
            className="w-16 rounded border hairline bg-transparent px-2 py-1 text-center text-parchment"
          />
          s
        </label>
        <p className="w-full text-xs text-parchment/40">Android turns pages at most once a minute (longer when the phone sleeps). Tap the widget to turn a page instantly.</p>
      </div>

      {/* Pages designer */}
      <div className="space-y-2 border-t border-gold-dim/20 pt-4">
        {cfg.pages.map((page, i) => {
          const hiddenBy = HIDDEN_BY[page.kind]
          const hidden = hiddenBy ? !cfg[hiddenBy] : false
          return (
            <div key={i} className={`flex flex-wrap items-center gap-2 rounded-md border hairline p-2.5 ${hidden ? 'opacity-50' : ''}`}>
              <span className="text-xs text-parchment/40 w-5 text-center tabular-nums">{i + 1}</span>
              <select
                value={page.kind}
                onChange={(e) => updatePage(i, { kind: e.target.value as WidgetPage['kind'] })}
                className="rounded border hairline bg-ink px-2 py-2 sm:py-1.5 text-sm text-parchment capitalize"
                aria-label={`Page ${i + 1} type`}
              >
                {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
              </select>
              {page.kind === 'note' && (
                <input
                  value={page.note ?? ''} maxLength={280}
                  onChange={(e) => updatePage(i, { note: e.target.value })}
                  placeholder="Your text…"
                  className="min-w-[8rem] flex-1 rounded border hairline bg-transparent px-2 py-1.5 text-sm text-parchment"
                />
              )}
              <label className="flex items-center gap-1.5 text-xs text-parchment/60">
                Accent
                <input type="color" value={page.accent ?? '#B8935A'} onChange={(e) => updatePage(i, { accent: e.target.value })} className="h-7 w-9 cursor-pointer rounded border hairline bg-transparent" aria-label={`Page ${i + 1} accent color`} />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-parchment/60">
                Background
                <input type="color" value={page.bg ?? '#0A0908'} onChange={(e) => updatePage(i, { bg: e.target.value })} className="h-7 w-9 cursor-pointer rounded border hairline bg-transparent" aria-label={`Page ${i + 1} background color`} />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-parchment/60">
                Text
                <input
                  type="color" value={page.styles?.title?.color ?? '#F3EFE6'}
                  onChange={(e) => updatePage(i, { styles: { ...page.styles, title: { ...page.styles?.title, color: e.target.value } } })}
                  className="h-7 w-9 cursor-pointer rounded border hairline bg-transparent" aria-label={`Page ${i + 1} text color`}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-parchment/60">
                Size
                <select
                  value={page.styles?.title?.size ?? 17}
                  onChange={(e) => updatePage(i, { styles: { ...page.styles, title: { ...page.styles?.title, size: Number(e.target.value) } } })}
                  className="rounded border hairline bg-ink px-1.5 py-1 text-xs text-parchment" aria-label={`Page ${i + 1} text size`}
                >
                  <option value={14}>Small</option>
                  <option value={17}>Medium</option>
                  <option value={22}>Large</option>
                  <option value={28}>Huge</option>
                </select>
              </label>
              {hidden && <span className="text-xs text-parchment/50">hidden ({hiddenBy === 'showPlan' ? 'Plan' : hiddenBy === 'showAlarms' ? 'Alarms' : 'Partner messages'} is off)</span>}
              <span className="ml-auto flex items-center gap-0.5">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-2 sm:p-1.5 text-parchment/40 hover:text-parchment disabled:opacity-20" aria-label={`Move page ${i + 1} up`}><ArrowUp className="w-4 h-4" strokeWidth={1.5} /></button>
                <button onClick={() => move(i, 1)} disabled={i === cfg.pages.length - 1} className="rounded p-2 sm:p-1.5 text-parchment/40 hover:text-parchment disabled:opacity-20" aria-label={`Move page ${i + 1} down`}><ArrowDown className="w-4 h-4" strokeWidth={1.5} /></button>
                <button onClick={() => save({ ...cfg, pages: cfg.pages.filter((_, idx) => idx !== i) })} className="rounded p-2 sm:p-1.5 text-parchment/40 hover:text-ember transition-colors" aria-label={`Remove page ${i + 1}`}>
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </span>
            </div>
          )
        })}
        {cfg.pages.length < 10 && (
          <button
            onClick={() => save({ ...cfg, pages: [...cfg.pages, { kind: 'note', note: '', accent: '#B8935A' }] })}
            className="flex items-center gap-2 rounded-md border hairline px-3 py-2 text-sm text-parchment/70 hover:border-gold transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            Add page
          </button>
        )}
        <p className={`text-xs pt-1 ${status === 'error' ? 'text-ember' : 'text-parchment/45'}`}>
          {status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved — check your connection and change something again.' : 'Saved. The widget picks up the design on its next refresh, or when you tap it.'}
        </p>
      </div>
    </>
  )
}
