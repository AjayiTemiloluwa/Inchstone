'use client'

import { useEffect, useState } from 'react'
import { Copy, RefreshCw, Plus, Trash2 } from 'lucide-react'

type WidgetPage = {
  kind: 'plan' | 'timers' | 'alarms' | 'messages' | 'clock' | 'note'
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

const KINDS: WidgetPage['kind'][] = ['plan', 'timers', 'alarms', 'messages', 'clock', 'note']

/**
 * WidgetCard — Settings → Widget. Pair the native Android home-screen widget
 * (copy / rotate the pairing secret) and design what it shows: which pages,
 * in what order, with what accent/note styling.
 */
export function WidgetCard() {
  const [secret, setSecret] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cfg, setCfg] = useState<WidgetConfig | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [prefRes, secretRes] = await Promise.all([
          fetch('/api/widget?pref=1', { cache: 'no-store' }),
          fetch('/api/widget', { method: 'POST' }),
        ])
        if (cancelled) return
        if (prefRes.ok) {
          const data = await prefRes.json()
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
    return () => { cancelled = true }
  }, [])

  const save = async (next: WidgetConfig) => {
    setCfg(next)
    setSaving(true)
    try {
      await fetch('/api/widget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } catch { /* the widget keeps its last synced design */ }
    setSaving(false)
  }

  const rotate = async () => {
    if (!confirm('Generate a new pairing secret? Devices paired with the old one will stop updating until re-paired.')) return
    try {
      const res = await fetch('/api/widget?rotate=1', { method: 'POST' })
      if (res.ok) { setSecret((await res.json()).secret); setRevealed(true) }
    } catch { /* ignore */ }
  }

  const updatePage = (i: number, patch: Partial<WidgetPage>) => {
    if (!cfg) return
    const pages = cfg.pages.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    void save({ ...cfg, pages })
  }

  if (!cfg) return null

  return (
    <>
      {/* Pairing */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-medium text-parchment">Pairing secret</p>
          <p className="text-sm text-parchment/60 mt-1">
            Paste this into the Inchstone Widget app on your Android phone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="max-w-[10rem] sm:max-w-[12rem] truncate rounded border hairline px-2.5 py-1.5 text-xs text-parchment/70" aria-label="Widget pairing secret">
            {secret ? (revealed || copied ? secret : '••••••••••••') : '…'}
          </code>
          <button
            onClick={() => {
              if (secret && navigator.clipboard) {
                void navigator.clipboard.writeText(secret)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }
              setRevealed(true)
            }}
            className="rounded-md border hairline p-2 text-parchment hover:border-gold transition-colors"
            aria-label="Copy pairing secret"
          >
            <Copy className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={rotate}
            className="rounded-md border hairline p-2 text-parchment hover:border-gold transition-colors"
            aria-label="Regenerate pairing secret"
            title="Regenerate (unlinks paired devices)"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Live toggles */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gold-dim/20 pt-4">
        {([['showPlan', 'Plan'], ['showAlarms', 'Alarms'], ['showMessages', 'Partner messages']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => void save({ ...cfg, [key]: !cfg[key] })}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              cfg[key] ? 'border-gold/60 bg-gold/10 text-gold' : 'hairline text-parchment/50'
            }`}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-parchment/60">
          Rotate every
          <input
            type="number"
            min={5}
            max={120}
            value={cfg.rotateSeconds}
            onChange={(e) => void save({ ...cfg, rotateSeconds: Number(e.target.value) || 15 })}
            className="w-16 rounded border hairline bg-transparent px-2 py-1 text-center text-parchment"
          />
          s
        </label>
      </div>

      {/* Pages designer */}
      <div className="space-y-2 border-t border-gold-dim/20 pt-4">
        {cfg.pages.map((page, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border hairline p-2.5">
            <select
              value={page.kind}
              onChange={(e) => updatePage(i, { kind: e.target.value as WidgetPage['kind'] })}
              className="rounded border hairline bg-ink px-2 py-1.5 text-sm text-parchment capitalize"
              aria-label={`Page ${i + 1} type`}
            >
              {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
            </select>
            {page.kind === 'note' && (
              <input
                value={page.note ?? ''}
                onChange={(e) => updatePage(i, { note: e.target.value })}
                placeholder="Your text…"
                className="min-w-[8rem] flex-1 rounded border hairline bg-transparent px-2 py-1.5 text-sm text-parchment"
              />
            )}
            <label className="flex items-center gap-1.5 text-xs text-parchment/60">
              Accent
              <input
                type="color"
                value={page.accent ?? '#B8935A'}
                onChange={(e) => updatePage(i, { accent: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border hairline bg-transparent"
                aria-label={`Page ${i + 1} accent color`}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-parchment/60">
              Background
              <input
                type="color"
                value={page.bg ?? '#0A0908'}
                onChange={(e) => updatePage(i, { bg: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border hairline bg-transparent"
                aria-label={`Page ${i + 1} background color`}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-parchment/60">
              Text
              <input
                type="color"
                value={page.styles?.title?.color ?? '#F3EFE6'}
                onChange={(e) => updatePage(i, {
                  styles: { ...page.styles, title: { ...page.styles?.title, color: e.target.value } },
                })}
                className="h-7 w-9 cursor-pointer rounded border hairline bg-transparent"
                aria-label={`Page ${i + 1} text color`}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-parchment/60">
              Size
              <select
                value={page.styles?.title?.size ?? 17}
                onChange={(e) => updatePage(i, {
                  styles: { ...page.styles, title: { ...page.styles?.title, size: Number(e.target.value) } },
                })}
                className="rounded border hairline bg-ink px-1.5 py-1 text-xs text-parchment"
                aria-label={`Page ${i + 1} text size`}
              >
                <option value={14}>Small</option>
                <option value={17}>Medium</option>
                <option value={22}>Large</option>
                <option value={28}>Huge</option>
              </select>
            </label>
            <button
              onClick={() => void save({ ...cfg, pages: cfg.pages.filter((_, idx) => idx !== i) })}
              className="ml-auto rounded p-1.5 text-parchment/40 hover:text-[#cf8f78] transition-colors"
              aria-label={`Remove page ${i + 1}`}
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        ))}
        {cfg.pages.length < 10 && (
          <button
            onClick={() => void save({ ...cfg, pages: [...cfg.pages, { kind: 'note', note: '', accent: '#B8935A' }] })}
            className="flex items-center gap-2 rounded-md border hairline px-3 py-2 text-sm text-parchment/70 hover:border-gold transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            Add page
          </button>
        )}
        <p className="text-xs text-parchment/45 pt-1">
          {saving ? 'Saving…' : 'Saved. The widget picks up the design on its next refresh (or when tapped).'}
        </p>
      </div>
    </>
  )
}

