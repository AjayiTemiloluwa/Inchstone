'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, Bell, CalendarClock, FileText, Mail, Plus, Search, X } from 'lucide-react'
import { EmailDigestSettings } from '@/components/applications/EmailDigestSettings'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import {
  Badge, Button, EmptyState, Field, Meter, Page, PageHeader, Panel, Section, Segmented, Stat, StatGrid, cx, inputClass,
} from '@/components/ds'
import { ChallengeTabs } from '@/components/applications/ChallengeTabs'
import { ExcelPanel } from '@/components/applications/ExcelPanel'
import {
  DeadlineBadge, ReminderPicker, StatusBadge, countdown, formatDeadline, fromLocalInput, selectClass, typeLabel, type Fit,
} from '@/components/applications/shared'
import { APPLICATION_TYPES, DEADLINE_CLOSED, OUTCOME_STATUSES, PRIORITIES } from '@/lib/applications'

interface AppRow {
  id: string
  title: string
  organization: string | null
  type: string
  status: string
  priority: string
  deadline: string | null
  location: string | null
  value: string | null
  progress: number
  fit: Fit
  fileCount: number
  docs: { total: number; ready: number }
  steps: { total: number; done: number }
  reminderOffsets: string
  archived: boolean
}

type Filter = 'active' | 'due' | 'submitted' | 'outcomes' | 'all'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'In progress' },
  { value: 'due', label: 'Due in 14 days' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'outcomes', label: 'Outcomes' },
  { value: 'all', label: 'All' },
]

const DEFAULT_REMINDERS = [10080, 4320, 1440, 180]

export default function ApplicationTrackerPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<AppRow[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const [showCreate, setShowCreate] = useState(false)
  const [showDigest, setShowDigest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', organization: '', type: 'scholarship', priority: 'medium', deadline: '', url: '', summary: '',
  })
  const [reminders, setReminders] = useState<number[]>(DEFAULT_REMINDERS)

  const load = useCallback(async (archived: boolean) => {
    try {
      const res = await fetch(`/api/applications${archived ? '?archived=1' : ''}`, { cache: 'no-store' })
      if (res.ok) setApps((await res.json()).applications || [])
    } catch {
      showToast('Could not load applications', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const t = setTimeout(() => load(showArchived), 0)
    return () => clearTimeout(t)
  }, [load, showArchived])

  // Reload when the assistant changes something.
  useEffect(() => {
    const onChange = () => load(showArchived)
    window.addEventListener('inchstone:data-changed', onChange)
    return () => window.removeEventListener('inchstone:data-changed', onChange)
  }, [load, showArchived])

  // Countdowns tick once a minute.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const create = async () => {
    if (!form.title.trim()) {
      showToast('Give the application a name', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          deadline: fromLocalInput(form.deadline),
          reminderOffsets: reminders,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Could not create the application', 'error')
        return
      }
      showToast('Application added. Fill in the details next.', 'success')
      router.push(`/challenge/applications/${data.application.id}`)
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps.filter((a) => {
      if (q && ![a.title, a.organization, a.location, typeLabel(a.type)].some((s) => s?.toLowerCase().includes(q))) return false
      if (showArchived) return true
      switch (filter) {
        case 'active': return !DEADLINE_CLOSED.has(a.status)
        case 'due': {
          if (!a.deadline || DEADLINE_CLOSED.has(a.status)) return false
          const ms = new Date(a.deadline).getTime() - now
          return ms >= 0 && ms <= 14 * 86400000
        }
        case 'submitted': return ['submitted', 'interviewing', 'offer'].includes(a.status)
        case 'outcomes': return OUTCOME_STATUSES.has(a.status)
        default: return true
      }
    })
  }, [apps, filter, query, showArchived, now])

  if (loading) return <Loader routeKey="challenge" />

  const open = apps.filter((a) => !DEADLINE_CLOSED.has(a.status))
  const dueSoon = open.filter((a) => {
    if (!a.deadline) return false
    const ms = new Date(a.deadline).getTime() - now
    return ms >= 0 && ms <= 7 * 86400000
  })
  const submitted = apps.filter((a) => ['submitted', 'interviewing', 'offer', 'accepted', 'rejected'].includes(a.status))
  const won = apps.filter((a) => a.status === 'accepted' || a.status === 'offer').length
  const next = open.filter((a) => a.deadline && new Date(a.deadline).getTime() >= now)[0]
  const nextCd = next ? countdown(next.deadline, now) : null

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Page>
      <PageHeader
        eyebrow="Challenge"
        title="Application Tracker"
        description="Every scholarship, job, school and grant you are going for: what it needs, whether you qualify, how far along you are, and when it is due."
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Button variant="ghost" icon={Mail} onClick={() => setShowDigest((v) => !v)} aria-expanded={showDigest}>Email digest</Button>
            <Button variant="ghost" icon={Archive} onClick={() => { setLoading(true); setShowArchived((v) => !v) }}>
              {showArchived ? 'Back to active' : 'Archived'}
            </Button>
            <Button variant="primary" icon={showCreate ? X : Plus} onClick={() => setShowCreate((v) => !v)} className="col-span-2">
              {showCreate ? 'Close' : 'New application'}
            </Button>
          </div>
        }
      />
      <ChallengeTabs />
      {showDigest && <EmailDigestSettings onClose={() => setShowDigest(false)} />}

      {!showArchived && (
        <StatGrid>
          <Stat label="In progress" value={open.length} caption={`${apps.length} tracked in total`} icon={FileText} />
          <Stat label="Due in 7 days" value={dueSoon.length} tone={dueSoon.length ? 'ember' : 'neutral'} caption="deadlines this week" icon={CalendarClock} />
          <Stat label="Submitted" value={submitted.length} tone="gold" caption="sent and waiting or decided" />
          <Stat
            label="Next deadline"
            value={nextCd ? (nextCd.days > 0 ? `${nextCd.days}d` : nextCd.label.replace(' left', '')) : '—'}
            tone={nextCd?.tone ?? 'neutral'}
            caption={next ? next.title : won ? `${won} offer${won === 1 ? '' : 's'} so far` : 'nothing scheduled'}
          />
        </StatGrid>
      )}

      {showCreate && (
        <Section title="New application">
          <Panel className="space-y-5 animate-fadeIn">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input autoFocus value={form.title} onChange={set('title')} placeholder="Chevening Scholarship 2027" className={inputClass} />
              </Field>
              <Field label="Organisation">
                <input value={form.organization} onChange={set('organization')} placeholder="UK Foreign Office" className={inputClass} />
              </Field>
              <Field label="Type" hint="Sets a starter checklist you can edit.">
                <select value={form.type} onChange={set('type')} className={selectClass}>
                  {APPLICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Deadline">
                <input type="datetime-local" value={form.deadline} onChange={set('deadline')} className={inputClass} />
              </Field>
              <Field label="Priority">
                <select value={form.priority} onChange={set('priority')} className={selectClass}>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Application link">
                <input value={form.url} onChange={set('url')} placeholder="https://" inputMode="url" className={inputClass} />
              </Field>
            </div>
            <Field label="What is it about?">
              <textarea value={form.summary} onChange={set('summary')} rows={3} placeholder="Fully funded one-year master's in the UK for future leaders."
                className={cx(inputClass, 'py-2.5')} />
            </Field>
            <ReminderPicker value={reminders} onChange={setReminders} disabled={!form.deadline} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" onClick={create} disabled={saving}>{saving ? 'Adding…' : 'Add application'}</Button>
            </div>
          </Panel>
        </Section>
      )}

      {!showArchived && <ExcelPanel onImported={() => load(false)} />}

      <Section
        title={showArchived ? 'Archived' : 'Applications'}
        action={
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment/35" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search applications"
              className={cx(inputClass, 'w-56 pl-9 pointer-fine:min-h-9')} />
          </label>
        }
      >
        {!showArchived && (
          <div className="mb-4 flex flex-col gap-2">
            <Segmented options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter applications" className="flex-wrap !overflow-visible" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search applications"
              className={cx(inputClass, 'sm:hidden')} />
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            title={apps.length ? 'Nothing matches this view' : 'No applications yet'}
            body={apps.length ? 'Try another filter or search.' : 'Add the first thing you are applying for. Inchstone will remind you before it is due.'}
            action={!apps.length && !showArchived ? <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>New application</Button> : undefined}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((a) => <AppCard key={a.id} app={a} />)}
          </div>
        )}
      </Section>
    </Page>
  )
}

function AppCard({ app: a }: { app: AppRow }) {
  const closed = DEADLINE_CLOSED.has(a.status)
  return (
    <Link href={`/challenge/applications/${a.id}`} className="group block min-w-0 focus-visible:outline-none">
      <Panel interactive className="flex h-full flex-col gap-4 group-focus-visible:ring-2 group-focus-visible:ring-gold/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/40">
              {typeLabel(a.type)}{a.priority === 'high' ? ' · High priority' : ''}
            </p>
            <h3 className="mt-1 line-clamp-3 break-words text-heading text-parchment">{a.title}</h3>
            {a.organization && <p className="line-clamp-2 break-words text-caption text-parchment/55">{a.organization}</p>}
          </div>
          <StatusBadge status={a.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-caption text-parchment/55">
          <CalendarClock className="h-3.5 w-3.5 text-gold-dim" aria-hidden="true" />
          <span>{formatDeadline(a.deadline)}</span>
          <DeadlineBadge deadline={a.deadline} closed={closed} />
          {a.deadline && !closed && a.reminderOffsets && <Bell className="h-3.5 w-3.5 text-gold-dim" aria-label="Reminders on" />}
        </div>

        <div className="mt-auto space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-parchment/45">
              <span>Progress</span>
              <span className="tabular-nums">{a.progress}%</span>
            </div>
            <Meter value={a.progress} tone={a.progress >= 100 ? 'moss' : 'gold'} />
          </div>
          <div className="flex flex-wrap gap-2">
            {a.fit.pct !== null && (
              <Badge tone={a.fit.unmet ? 'ember' : a.fit.pct >= 80 ? 'moss' : 'neutral'}>Fit {a.fit.pct}%</Badge>
            )}
            {a.docs.total > 0 && <Badge>Docs {a.docs.ready}/{a.docs.total}</Badge>}
            {a.steps.total > 0 && <Badge>Steps {a.steps.done}/{a.steps.total}</Badge>}
            {a.fileCount > 0 && <Badge>{a.fileCount} file{a.fileCount === 1 ? '' : 's'}</Badge>}
          </div>
        </div>
      </Panel>
    </Link>
  )
}
