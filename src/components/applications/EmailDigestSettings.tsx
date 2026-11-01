'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Globe2, Mail, MapPin, RotateCcw, Send, X } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { Badge, Button, Field, IconButton, Panel, cx, inputClass } from '@/components/ds'
import { APPLICATION_TYPES } from '@/lib/applications'
import { DIGEST_FREQUENCIES, WEEKDAYS, describeSchedule, digestSelection, type DigestSettings } from '@/lib/digest'

interface Opp {
  id: string; title: string; organization: string | null; type: string; scope: string; match: number
  status: string; emailSkip: boolean; emailedAt: string | null; deadline: string | null
}

const SCOUT_TYPES = ['scholarship', 'fellowship', 'job', 'internship', 'grant', 'competition', 'school']
const typeLabel = (v: string) => APPLICATION_TYPES.find((t) => t.value === v)?.label ?? 'Other'
const PICK = (p: DigestSettings): DigestSettings => ({
  emailDigest: p.emailDigest, digestFrequency: p.digestFrequency, digestHour: p.digestHour, digestDay: p.digestDay,
  digestMinMatch: p.digestMinMatch, digestScope: p.digestScope, digestTypes: p.digestTypes, digestMax: p.digestMax,
  digestOnlyNew: p.digestOnlyNew, tz: p.tz,
})
const chip = (on: boolean) => cx('min-h-9 rounded-full border px-3 text-sm transition-colors', on ? 'border-gold/60 bg-gold/10 text-gold' : 'border-gold/15 text-parchment/60 hover:border-gold/35')

/**
 * Email digest: when it goes out, what goes in, and a live preview of the
 * exact list the next email will contain (items can be taken out one by one).
 */
export function EmailDigestSettings({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast()
  const [s, setS] = useState<DigestSettings | null>(null)
  const [opps, setOpps] = useState<Opp[]>([])
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/opportunities', { cache: 'no-store' })
    if (!res.ok) return
    const d = await res.json()
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setS({ ...PICK(d.profile), tz: d.profile.tz || browserTz })
    setOpps(d.opportunities)
  }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const preview = useMemo(() => (s ? digestSelection(s, opps) : []), [s, opps])
  const skipped = useMemo(() => opps.filter((o) => o.status === 'new' && o.emailSkip), [opps])

  if (!s) return <Panel className="text-sm text-parchment/50">Loading email settings…</Panel>

  const set = <K extends keyof DigestSettings>(k: K, v: DigestSettings[K]) => { setS({ ...s, [k]: v }); setDirty(true) }
  const types = s.digestTypes.split(',').filter(Boolean)

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/opportunities', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, digestTypes: types, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(d.error || 'Could not save', 'error'); return }
    setDirty(false)
    showToast(`Saved. ${describeSchedule(s)}.`, 'success')
  }

  const skip = async (ids: string[], value: boolean) => {
    const res = await fetch('/api/opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'email-skip', ids, skip: value }) })
    if (res.ok) setOpps((list) => list.map((o) => (ids.includes(o.id) ? { ...o, emailSkip: value } : o)))
  }

  const sendNow = async () => {
    if (dirty) await save()
    setSending(true)
    const res = await fetch('/api/opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'digest' }) })
    setSending(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(d.error || 'Could not send', 'error'); return }
    showToast(`Sent ${d.sent} to ${d.to}`, 'success')
    await load()
  }

  return (
    <Panel className="space-y-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-parchment"><Mail className="h-4 w-4 text-gold" /> Email digest</p>
          <p className="text-caption text-parchment/55">New opportunities from the Opportunity Scout, sent to your inbox for approval. {describeSchedule(s)} ({s.tz.replace('_', ' ')} time).</p>
        </div>
        {onClose && <IconButton icon={X} label="Close" onClick={onClose} />}
      </div>

      <label className="flex items-center gap-2 text-sm text-parchment/80">
        <input type="checkbox" checked={s.emailDigest} onChange={(e) => set('emailDigest', e.target.checked)} className="h-4 w-4 accent-[rgb(var(--gold-rgb))]" />
        Send me the digest by email
      </label>

      <div className={cx('grid gap-5 lg:grid-cols-2', !s.emailDigest && 'pointer-events-none opacity-50')}>
        {/* When */}
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">When</p>
          <div className="flex flex-wrap gap-1.5">
            {DIGEST_FREQUENCIES.map((f) => <button key={f.value} type="button" aria-pressed={s.digestFrequency === f.value} onClick={() => set('digestFrequency', f.value)} className={chip(s.digestFrequency === f.value)}>{f.label}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {s.digestFrequency === 'weekly' && (
              <Field label="Day">
                <select value={s.digestDay} onChange={(e) => set('digestDay', Number(e.target.value))} className={inputClass}>
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </Field>
            )}
            <Field label="Time">
              <select value={s.digestHour} onChange={(e) => set('digestHour', Number(e.target.value))} className={inputClass}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* What */}
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">What to include</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Where">
              <select value={s.digestScope} onChange={(e) => set('digestScope', e.target.value)} className={inputClass}>
                <option value="all">Local + global</option><option value="local">Local only</option><option value="global">Global only</option>
              </select>
            </Field>
            <Field label="Fit">
              <select value={s.digestMinMatch} onChange={(e) => set('digestMinMatch', Number(e.target.value))} className={inputClass}>
                <option value={0}>Any</option><option value={50}>50%+</option><option value={65}>65%+</option><option value={80}>80%+</option>
              </select>
            </Field>
            <Field label="At most">
              <select value={s.digestMax} onChange={(e) => set('digestMax', Number(e.target.value))} className={inputClass}>
                {[5, 10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Types to include">
            <button type="button" aria-pressed={!types.length} onClick={() => set('digestTypes', '')} className={chip(!types.length)}>Every type</button>
            {SCOUT_TYPES.map((t) => {
              const on = types.includes(t)
              return <button key={t} type="button" aria-pressed={on} onClick={() => set('digestTypes', (on ? types.filter((x) => x !== t) : [...types, t]).join(','))} className={chip(on)}>{typeLabel(t)}</button>
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-parchment/75">
            <input type="checkbox" checked={s.digestOnlyNew} onChange={(e) => set('digestOnlyNew', e.target.checked)} className="h-4 w-4 accent-[rgb(var(--gold-rgb))]" />
            Only ones I have not been emailed about before
          </label>
        </div>
      </div>

      {/* The exact list */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">The next email · {preview.length} {preview.length === 1 ? 'opportunity' : 'opportunities'}</p>
        {preview.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gold/20 px-4 py-4 text-sm text-parchment/50">
            Nothing matches these settings yet. {opps.length ? 'Loosen the filters, or ' : ''}<Link href="/challenge/opportunities" className="text-gold hover:underline">run the Opportunity Scout</Link>.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-gold/10 overflow-y-auto rounded-xl border border-gold/15" data-lenis-prevent>
            {preview.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-2">
                {o.scope === 'local' ? <MapPin className="h-3.5 w-3.5 shrink-0 text-moss" aria-label="Local" /> : <Globe2 className="h-3.5 w-3.5 shrink-0 text-gold-dim" aria-label="Global" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-parchment">{o.title}</p>
                  <p className="truncate text-[11px] text-parchment/45">{[o.organization, typeLabel(o.type), o.deadline && `closes ${new Date(o.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge tone={o.match >= 75 ? 'moss' : 'neutral'}>{o.match}%</Badge>
                <IconButton icon={X} label={`Leave ${o.title} out of the email`} onClick={() => skip([o.id], true)} />
              </li>
            ))}
          </ul>
        )}
        {skipped.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-caption text-parchment/50">
            {skipped.length} left out of emails.
            <button type="button" onClick={() => skip(skipped.map((o) => o.id), false)} className="inline-flex items-center gap-1 text-gold-dim hover:text-gold"><RotateCcw className="h-3 w-3" /> Put them back</button>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" icon={Send} disabled={sending || !preview.length} onClick={sendNow}>{sending ? 'Sending…' : 'Send this list now'}</Button>
        <Button variant="primary" disabled={saving || !dirty} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save settings' : 'Saved'}</Button>
      </div>
    </Panel>
  )
}
