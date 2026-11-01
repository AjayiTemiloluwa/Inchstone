'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Globe2, Mail, MapPin, Plus, Radar, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { Badge, Button, EmptyState, Field, IconButton, Meter, Page, PageHeader, Panel, Segmented, cx, inputClass } from '@/components/ds'
import { ChallengeTabs } from '@/components/applications/ChallengeTabs'
import { APPLICATION_TYPES } from '@/lib/applications'

interface Opp {
  id: string; title: string; organization: string | null; url: string; type: string; scope: 'local' | 'global'
  location: string | null; deadline: string | null; value: string | null; summary: string | null; eligibility: string | null
  source: string | null; match: number; matchReason: string | null; status: 'new' | 'approved' | 'dismissed'; applicationId: string | null; foundAt: string
}
interface Profile { interests: string; homeCountry: string; types: string; sources: string[]; builtIn: boolean; emailDigest: boolean; lastRunAt: string | null; lastRunNote: string | null }

type View = 'new' | 'approved' | 'dismissed'
type Scope = 'all' | 'local' | 'global'
type Sort = 'match' | 'deadline' | 'newest'

const SCOUT_TYPES = ['scholarship', 'fellowship', 'job', 'internship', 'grant', 'competition', 'school']
const typeLabel = (v: string) => APPLICATION_TYPES.find((t) => t.value === v)?.label ?? 'Other'
const DAY = 86_400_000

export default function OpportunitiesPage() {
  const { showToast, confirm } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [opps, setOpps] = useState<Opp[]>([])
  const [builtIns, setBuiltIns] = useState<{ name: string }[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [scouting, setScouting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState(false)
  const [draft, setDraft] = useState<Profile | null>(null)
  const [site, setSite] = useState('')
  const [view, setView] = useState<View>('new')
  const [scope, setScope] = useState<Scope>('all')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState<Sort>('match')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/opportunities', { cache: 'no-store' })
      if (!res.ok) return
      const d = await res.json()
      setProfile(d.profile)
      setOpps(d.opportunities)
      setBuiltIns(d.builtInSources)
      setNowMs(Date.now())
      // First visit: open the settings so the scout knows what to look for.
      if (!d.profile.interests) { setDraft(d.profile); setSettings(true) }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const call = async (body: unknown, method = 'POST') => {
    const res = await fetch('/api/opportunities', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(data.error || 'Something went wrong', 'error'); return null }
    return data
  }

  const scout = async () => {
    setScouting(true)
    const r = await call({ action: 'scout' })
    setScouting(false)
    if (r) showToast(r.added ? `Found ${r.added} new ${r.added === 1 ? 'opportunity' : 'opportunities'}` : 'Nothing new this time. Try more interests or sites.', r.added ? 'success' : 'info')
    setView('new')
    await load()
  }

  const decide = async (action: 'approve' | 'dismiss' | 'restore', ids: string[]) => {
    if (!ids.length) return
    setBusy(true)
    const r = await call({ action, ids })
    setBusy(false)
    if (!r) return
    setSelected(new Set())
    if (action === 'approve') showToast(`Added ${r.approved} to your Application Tracker`, 'success')
    else showToast(action === 'dismiss' ? `Dismissed ${r.updated}` : `Moved ${r.updated} back to review`, 'success')
    await load()
  }

  const saveSettings = async () => {
    if (!draft) return
    const r = await call({ ...draft, types: draft.types.split(',').filter(Boolean) }, 'PUT')
    if (!r) return
    setProfile(r.profile)
    setSettings(false)
    showToast('Scout settings saved', 'success')
  }

  const counts = useMemo(() => ({
    new: opps.filter((o) => o.status === 'new').length,
    approved: opps.filter((o) => o.status === 'approved').length,
    dismissed: opps.filter((o) => o.status === 'dismissed').length,
  }), [opps])

  const shown = useMemo(() => {
    const list = opps.filter((o) => o.status === view && (scope === 'all' || o.scope === scope) && (type === 'all' || o.type === type))
    const dl = (o: Opp) => (o.deadline ? new Date(o.deadline).getTime() : Infinity)
    return list.sort((a, b) => sort === 'deadline' ? dl(a) - dl(b) : sort === 'newest' ? +new Date(b.foundAt) - +new Date(a.foundAt) : b.match - a.match)
  }, [opps, view, scope, type, sort])

  if (loading) return <Loader routeKey="challenge" />

  const inView = opps.filter((o) => o.status === view)
  const scopeCount = (s: 'local' | 'global') => inView.filter((o) => o.scope === s).length
  const shownIds = shown.map((o) => o.id)
  const allPicked = shownIds.length > 0 && shownIds.every((id) => selected.has(id))
  const picked = shownIds.filter((id) => selected.has(id))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const ago = (iso: string) => { const h = Math.round((nowMs - +new Date(iso)) / 3_600_000); return h < 1 ? 'just now' : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago` }
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => d && { ...d, [k]: v })
  const typesOn = (draft?.types ?? '').split(',').filter(Boolean)

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="Challenge"
        title="Opportunity Scout"
        description="Every morning it searches the web, opportunity sites and the sites you choose for scholarships, jobs, fellowships and grants that fit you. Nothing reaches your tracker until you approve it."
        actions={
          <>
            <Button variant="ghost" icon={SlidersHorizontal} onClick={() => { setDraft(profile); setSettings((v) => !v) }}>Settings</Button>
            <Button variant="primary" icon={Radar} disabled={scouting} onClick={scout}>{scouting ? 'Scouting… (up to a minute)' : 'Scout now'}</Button>
          </>
        }
      />
      <ChallengeTabs />

      {/* Settings: what to look for and where */}
      {settings && draft && (
        <Panel className="space-y-5 animate-fadeIn">
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Your interests" hint="Fields, roles and goals, separated by commas. The scout searches and scores with these.">
              <textarea value={draft.interests} onChange={(e) => set('interests', e.target.value)} rows={3} placeholder="fintech, data science, software engineering, MBA, women in tech"
                className={cx(inputClass, 'py-2.5')} />
            </Field>
            <Field label="Where you live" hint="Opportunities here, or only for people from here, count as Local.">
              <input value={draft.homeCountry} onChange={(e) => set('homeCountry', e.target.value)} placeholder="Nigeria" className={inputClass} />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">Look for</legend>
            <div className="flex flex-wrap gap-1.5">
              {SCOUT_TYPES.map((t) => {
                const on = typesOn.includes(t)
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => set('types', (on ? typesOn.filter((x) => x !== t) : [...typesOn, t]).join(','))}
                    className={cx('min-h-9 rounded-full border px-3 text-sm transition-colors', on ? 'border-gold/60 bg-gold/10 text-gold' : 'border-gold/15 text-parchment/60 hover:border-gold/35')}>
                    {typeLabel(t)}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">Sites to check</p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const s = site.trim(); if (s && !draft.sources.includes(s)) set('sources', [...draft.sources, s]); setSite('') }}>
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Add a site, e.g. https://careers.flutterwave.com or a scholarship blog" inputMode="url" className={inputClass} />
              <Button type="submit" icon={Plus} disabled={!site.trim()}>Add</Button>
            </form>
            {draft.sources.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {draft.sources.map((s) => (
                  <li key={s} className="inline-flex items-center gap-1 rounded-full border border-gold/20 py-1 pl-3 pr-1 text-xs text-parchment/80">
                    {s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    <button type="button" aria-label={`Remove ${s}`} onClick={() => set('sources', draft.sources.filter((x) => x !== s))} className="rounded-full p-1 text-parchment/40 hover:text-ember"><X className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-start gap-2 text-sm text-parchment/75">
              <input type="checkbox" checked={draft.builtIn} onChange={(e) => set('builtIn', e.target.checked)} className="mt-1 accent-[rgb(var(--gold-rgb))]" />
              <span>Also check well-known opportunity sites <span className="text-parchment/45">({builtIns.map((b) => b.name).join(', ')})</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm text-parchment/75">
              <input type="checkbox" checked={draft.emailDigest} onChange={(e) => set('emailDigest', e.target.checked)} className="mt-1 accent-[rgb(var(--gold-rgb))]" />
              <span>Email me a preview every morning at 6:00 when there is something new</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSettings(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveSettings}>Save</Button>
          </div>
        </Panel>
      )}

      {/* Last run */}
      {profile && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-parchment/55">
          <span>{profile.lastRunAt ? <>Last scouted {ago(profile.lastRunAt)}{profile.lastRunNote ? ` · ${profile.lastRunNote}` : ''}</> : 'Not scouted yet. Press Scout now, or wait for tomorrow morning.'}</span>
          {counts.new > 0 && (
            <button type="button" onClick={async () => { const r = await call({ action: 'digest' }); if (r) showToast(`Preview sent to ${r.to}`, 'success') }}
              className="inline-flex items-center gap-1.5 text-gold-dim hover:text-gold"><Mail className="h-3.5 w-3.5" /> Email me the preview now</button>
          )}
        </div>
      )}

      {/* Review */}
      <div className="space-y-3">
        <Segmented
          options={[
            { value: 'new', label: `To review · ${counts.new}` },
            { value: 'approved', label: `Approved · ${counts.approved}` },
            { value: 'dismissed', label: `Dismissed · ${counts.dismissed}` },
          ]}
          value={view} onChange={(v) => { setView(v); setSelected(new Set()) }} ariaLabel="Opportunity status" />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-gold/15 p-1" role="group" aria-label="Local or global">
            {([['all', `All · ${inView.length}`], ['local', `Local · ${scopeCount('local')}`], ['global', `Global · ${scopeCount('global')}`]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)}
                className={cx('min-h-8 rounded-lg px-3 text-xs font-medium transition-colors', scope === v ? 'bg-gold/15 text-gold' : 'text-parchment/55 hover:text-parchment')}>{label}</button>
            ))}
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className={cx(inputClass, 'h-10 w-auto')}>
            <option value="all">Every type</option>
            {APPLICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className={cx(inputClass, 'h-10 w-auto')}>
            <option value="match">Best match first</option>
            <option value="deadline">Closing soonest</option>
            <option value="newest">Newest finds</option>
          </select>
        </div>

        {/* Bulk actions */}
        {shown.length > 0 && view !== 'approved' && (
          <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gold/20 bg-surface-solid px-3 py-2">
            <label className="mr-auto flex min-h-9 items-center gap-2 text-sm text-parchment/75">
              <input type="checkbox" checked={allPicked} onChange={() => setSelected(allPicked ? new Set() : new Set(shownIds))} className="h-4 w-4 accent-[rgb(var(--gold-rgb))]" />
              {picked.length ? `${picked.length} selected` : 'Select all'}
            </label>
            {view === 'new' && (picked.length ? (
              <>
                <Button size="sm" variant="ghost" icon={X} disabled={busy} onClick={() => decide('dismiss', picked)}>Dismiss selected</Button>
                <Button size="sm" variant="primary" icon={Check} disabled={busy} onClick={() => decide('approve', picked)}>Approve selected ({picked.length})</Button>
              </>
            ) : (
              <Button size="sm" variant="primary" icon={Check} disabled={busy} onClick={async () => {
                if (await confirm(`Add all ${shown.length} shown opportunities to your Application Tracker?`)) await decide('approve', shownIds)
              }}>Approve all ({shown.length})</Button>
            ))}
            {view === 'dismissed' && <Button size="sm" icon={RotateCcw} disabled={busy || !picked.length} onClick={() => decide('restore', picked)}>Back to review</Button>}
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState
            title={view === 'new' ? (opps.length ? 'All caught up' : 'Nothing found yet') : view === 'approved' ? 'Nothing approved yet' : 'Nothing dismissed'}
            body={view === 'new' ? 'New finds land here each morning. Press Scout now to look straight away.' : undefined}
            action={view === 'new' ? <Button variant="primary" icon={Radar} disabled={scouting} onClick={scout}>{scouting ? 'Scouting…' : 'Scout now'}</Button> : undefined}
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-gold/15">
            <li aria-hidden className="hidden grid-cols-[2rem_minmax(0,1fr)_8.5rem_7.5rem_6rem_6.5rem] gap-3 border-b border-gold/15 bg-gold/[0.04] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-parchment/45 lg:grid">
              <span /><span>Opportunity</span><span>Where</span><span>Deadline</span><span>Match</span><span />
            </li>
            {shown.map((o) => {
              const days = o.deadline ? Math.ceil((+new Date(o.deadline) - nowMs) / DAY) : null
              return (
                <li key={o.id} className={cx('grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-gold/10 px-4 py-3 last:border-0 lg:grid-cols-[2rem_minmax(0,1fr)_8.5rem_7.5rem_6rem_6.5rem] lg:items-center', selected.has(o.id) && 'bg-gold/[0.05]')}>
                  <span className="pt-1 lg:pt-0">
                    {view !== 'approved' && <input type="checkbox" aria-label={`Select ${o.title}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 accent-[rgb(var(--gold-rgb))]" />}
                  </span>
                  <div className="min-w-0">
                    <a href={o.url} target="_blank" rel="noreferrer" className="group inline-flex items-baseline gap-1.5 font-semibold text-parchment hover:text-gold">
                      <span>{o.title}</span><ExternalLink className="h-3 w-3 shrink-0 text-parchment/30 group-hover:text-gold" aria-hidden />
                    </a>
                    <p className="text-caption text-parchment/50">{[o.organization, typeLabel(o.type), o.value].filter(Boolean).join(' · ')}</p>
                    {o.summary && <p className="mt-1 line-clamp-2 text-sm text-parchment/70">{o.summary}</p>}
                    {o.eligibility && <p className="mt-0.5 line-clamp-1 text-caption text-parchment/45">Who can apply: {o.eligibility}</p>}
                  </div>
                  {/* Small screens: meta under the title */}
                  <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-parchment/55 lg:col-start-auto lg:block lg:space-y-1">
                    <Badge tone={o.scope === 'local' ? 'moss' : 'gold'}>{o.scope === 'local' ? <MapPin className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}{o.scope}</Badge>
                    {o.location && <span className="block truncate lg:text-[11px]">{o.location}</span>}
                  </div>
                  <div className="col-start-2 text-caption lg:col-start-auto">
                    {o.deadline ? (
                      <>
                        <span className="text-parchment/80">{new Date(o.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className={cx('ml-2 lg:ml-0 lg:block', days !== null && days <= 7 ? 'text-ember' : 'text-parchment/45')}>{days !== null && (days <= 0 ? 'today' : `in ${days} days`)}</span>
                      </>
                    ) : <span className="text-parchment/40">Not stated</span>}
                  </div>
                  <div className="col-start-2 lg:col-start-auto" title={o.matchReason ?? undefined}>
                    <span className="font-mono text-sm tabular-nums text-parchment">{o.match}%</span>
                    <Meter value={o.match} tone={o.match >= 75 ? 'moss' : o.match >= 50 ? 'gold' : 'neutral'} className="mt-1 max-w-24" />
                    {o.matchReason && <p className="mt-1 line-clamp-2 text-[11px] text-parchment/45 lg:hidden">{o.matchReason}</p>}
                  </div>
                  <div className="col-start-2 flex items-center gap-1 lg:col-start-auto lg:justify-end">
                    {o.status === 'new' && (
                      <>
                        <Button size="sm" variant="primary" icon={Check} disabled={busy} onClick={() => decide('approve', [o.id])}>Approve</Button>
                        <IconButton icon={X} label={`Dismiss ${o.title}`} onClick={() => decide('dismiss', [o.id])} />
                      </>
                    )}
                    {o.status === 'approved' && o.applicationId && <Button size="sm" href={`/challenge/applications/${o.applicationId}`}>Open</Button>}
                    {o.status === 'dismissed' && (
                      <Button size="sm" icon={RotateCcw} disabled={busy} onClick={() => decide('restore', [o.id])}>Restore</Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Page>
  )
}
