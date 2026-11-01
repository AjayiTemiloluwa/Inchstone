'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive, ArchiveRestore, ArrowLeft, Bell, BellOff, CalendarClock, Download, ExternalLink, FileText, Mail, Paperclip,
  Pencil, Phone, Plus, Trash2, Upload, UserRound, X,
} from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import {
  Badge, Button, EmptyState, Field, IconButton, Meter, Page, PageHeader, Panel, RowActions, Section, Stat, StatGrid, cx, inputClass,
} from '@/components/ds'
import { ChallengeTabs } from '@/components/applications/ChallengeTabs'
import { ItemList, type AppFile, type AppItem } from '@/components/applications/ItemList'
import {
  ReminderPicker, StatusBadge, countdown, formatBytes, formatDeadline, fromLocalInput, selectClass, textareaClass,
  toDateInput, toLocalInput, typeLabel, type Fit,
} from '@/components/applications/shared'
import {
  APPLICATION_STATUSES, APPLICATION_TYPES, DEADLINE_CLOSED, MAX_FILE_BYTES, PRIORITIES, REMINDER_CHOICES, parseOffsets,
  type ItemKind,
} from '@/lib/applications'

interface DetailSection { id: string; title: string; body: string }
interface Contact { id: string; name: string; role?: string; email?: string; phone?: string }

interface Application {
  id: string
  title: string
  organization: string | null
  type: string
  status: string
  priority: string
  url: string | null
  location: string | null
  value: string | null
  summary: string | null
  whyApply: string | null
  notes: string | null
  details: DetailSection[]
  contacts: Contact[]
  opensAt: string | null
  deadline: string | null
  decisionDate: string | null
  submittedAt: string | null
  reminderOffsets: string
  remindersSent: string
  archived: boolean
  items: AppItem[]
  files: AppFile[]
  progress: number
  fit: Fit
}

/** The main road an application travels; outcomes branch off the end. */
const PIPELINE = ['researching', 'preparing', 'submitted', 'interviewing', 'offer', 'accepted']

const newId = () => Math.random().toString(36).slice(2, 10)

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { showToast, confirm } = useToast()
  const [app, setApp] = useState<Application | null>(null)
  const [missing, setMissing] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [editingAbout, setEditingAbout] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/${id}`, { cache: 'no-store' })
      if (res.status === 404) { setMissing(true); return }
      if (res.ok) setApp((await res.json()).application)
    } catch {
      showToast('Could not load the application', 'error')
    }
  }, [id, showToast])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  // Reload when the assistant changes something.
  useEffect(() => {
    const onChange = () => { void load() }
    window.addEventListener('inchstone:data-changed', onChange)
    return () => window.removeEventListener('inchstone:data-changed', onChange)
  }, [load])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  /** Save fields; the server echoes the row, and progress is recomputed by a reload when it can change. */
  const patch = useCallback(async (fields: Record<string, unknown>, okMsg?: string, local?: Partial<Application>) => {
    setApp((a) => (a ? ({ ...a, ...fields, ...local } as Application) : a))
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Could not save', 'error')
        await load()
        return false
      }
      if (okMsg) showToast(okMsg, 'success')
      if ('status' in fields) await load()
      return true
    } catch {
      showToast('Network error', 'error')
      return false
    }
  }, [id, load, showToast])

  // ── Items ──
  const addItem = async (kind: ItemKind, label: string) => {
    const res = await fetch(`/api/applications/${id}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, label }),
    })
    if (!res.ok) { showToast((await res.json()).error || 'Could not add', 'error'); return }
    await load()
  }
  const patchItem = async (itemId: string, fields: Partial<AppItem>) => {
    setApp((a) => (a ? { ...a, items: a.items.map((i) => (i.id === itemId ? { ...i, ...fields } : i)) } : a))
    const res = await fetch(`/api/applications/${id}/items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    })
    if (!res.ok) showToast((await res.json()).error || 'Could not save', 'error')
    await load()
  }
  const deleteItem = async (itemId: string) => {
    if (!(await confirm('Delete this item?'))) return
    const res = await fetch(`/api/applications/${id}/items/${itemId}`, { method: 'DELETE' })
    if (!res.ok) showToast('Could not delete', 'error')
    await load()
  }

  // ── Files ──
  const upload = async (file: File, itemId?: string) => {
    if (file.size > MAX_FILE_BYTES) { showToast('Files must be 4 MB or smaller', 'error'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (itemId) {
        fd.append('itemId', itemId)
        const label = app?.items.find((i) => i.id === itemId)?.label
        if (label) fd.append('label', label)
      }
      const res = await fetch(`/api/applications/${id}/files`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || 'Upload failed', 'error'); return }
      showToast(itemId ? 'Uploaded and marked ready' : 'File uploaded', 'success')
      await load()
    } catch {
      showToast('Upload failed. Check your connection.', 'error')
    } finally {
      setUploading(false)
    }
  }
  const deleteFile = async (f: AppFile) => {
    if (!(await confirm(`Delete "${f.name}"?`))) return
    const res = await fetch(`/api/applications/${id}/files/${f.id}`, { method: 'DELETE' })
    if (!res.ok) showToast('Could not delete the file', 'error')
    await load()
  }

  const remove = async () => {
    if (!app || !(await confirm(`Delete "${app.title}" with all its items and files? This cannot be undone.`))) return
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Application deleted', 'success')
      router.push('/challenge/applications')
    } else showToast('Could not delete', 'error')
  }

  if (missing) {
    return (
      <Page>
        <EmptyState title="Application not found" body="It may have been deleted." action={<Button href="/challenge/applications" icon={ArrowLeft}>Back to the tracker</Button>} />
      </Page>
    )
  }
  if (!app) return <Loader routeKey="challenge" />

  const closed = DEADLINE_CLOSED.has(app.status)
  const cd = countdown(app.deadline, now)
  const items = (k: ItemKind) => app.items.filter((i) => i.kind === k)
  const docs = items('document')
  const docsReady = docs.filter((d) => d.status === 'ready').length
  const offsets = parseOffsets(app.reminderOffsets)
  const sent = new Set(parseOffsets(app.remindersSent))
  const upcoming = app.deadline && !closed
    ? offsets
        .map((m) => ({ m, at: new Date(app.deadline!).getTime() - m * 60_000 }))
        .filter((r) => r.at > now && !sent.has(r.m))
        .sort((a, b) => a.at - b.at)
    : []

  const listProps = { files: app.files, appId: app.id, onAdd: addItem, onPatch: patchItem, onDelete: deleteItem, onUpload: upload }

  return (
    <Page>
      <div>
        <Link href="/challenge/applications" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-parchment/55 hover:text-parchment">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All applications
        </Link>
      </div>

      <PageHeader
        eyebrow={[typeLabel(app.type), app.organization, app.priority === 'high' ? 'High priority' : null].filter(Boolean).join(' · ')}
        title={app.title}
        meta={<StatusBadge status={app.status} />}
        description={app.summary || undefined}
        actions={
          <>
            {app.url && (
              <Button href={app.url.startsWith('http') ? app.url : `https://${app.url}`} icon={ExternalLink} variant="secondary">
                Open portal
              </Button>
            )}
            <RowActions
              label="Application actions"
              className="[&>button]:opacity-100"
              actions={[
                { label: 'Edit details', icon: Pencil, onSelect: () => setEditingAbout(true) },
                app.archived
                  ? { label: 'Restore', icon: ArchiveRestore, onSelect: () => patch({ archived: false }, 'Restored') }
                  : { label: 'Archive', icon: Archive, onSelect: () => patch({ archived: true }, 'Archived') },
                { label: 'Delete', icon: Trash2, destructive: true, onSelect: remove },
              ]}
            />
          </>
        }
      />
      <ChallengeTabs />

      {/* Where it stands */}
      <StatGrid>
        <Stat
          label="Deadline"
          icon={CalendarClock}
          value={closed ? 'Done' : cd ? (cd.past ? 'Passed' : cd.days > 0 ? `${cd.days}d` : cd.label.replace(' left', '')) : '—'}
          tone={closed ? 'moss' : cd?.tone ?? 'neutral'}
          caption={formatDeadline(app.deadline)}
        />
        <Stat label="Progress" value={`${app.progress}%`} tone={app.progress >= 100 ? 'moss' : 'gold'}
          caption={<Meter value={app.progress} tone={app.progress >= 100 ? 'moss' : 'gold'} className="mt-1" />} />
        <Stat
          label="Do I qualify?"
          value={app.fit.pct === null ? '—' : `${app.fit.pct}%`}
          tone={app.fit.unmet ? 'ember' : app.fit.pct !== null && app.fit.pct >= 80 ? 'moss' : 'neutral'}
          caption={app.fit.total ? `${app.fit.met} met · ${app.fit.partial} partly · ${app.fit.unmet} not met` : 'list the requirements below'}
        />
        <Stat label="Documents" value={`${docsReady}/${docs.length}`} tone={docs.length && docsReady === docs.length ? 'moss' : 'neutral'}
          caption={`${app.files.length} file${app.files.length === 1 ? '' : 's'} uploaded`} icon={FileText} />
      </StatGrid>

      {/* Stage */}
      <Section title="Stage" description="Where this application is right now. Deadline reminders stop once it is submitted.">
        <Panel>
          <ol className="flex gap-1 overflow-x-auto pb-1">
            {PIPELINE.map((s, i) => {
              const idx = PIPELINE.indexOf(app.status)
              const reached = idx >= 0 && i <= idx
              const current = s === app.status
              return (
                <li key={s} className="min-w-[7.5rem] flex-1">
                  <button
                    type="button"
                    onClick={() => patch({ status: s }, `Moved to ${APPLICATION_STATUSES.find((x) => x.value === s)?.label}`)}
                    aria-current={current ? 'step' : undefined}
                    className="group flex w-full flex-col gap-2 rounded-lg p-2 text-left hover:bg-gold/[0.05]"
                  >
                    <span className={cx('h-1 rounded-full', reached ? 'bg-gold' : 'bg-gold/15')} />
                    <span className={cx('text-xs', current ? 'font-semibold text-parchment' : reached ? 'text-parchment/70' : 'text-parchment/40')}>
                      {APPLICATION_STATUSES.find((x) => x.value === s)?.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gold/10 pt-3 text-caption text-parchment/50">
            <span>Outcome:</span>
            <Button size="sm" variant={app.status === 'rejected' ? 'danger' : 'ghost'} onClick={() => patch({ status: 'rejected' }, 'Marked not successful')}>Not successful</Button>
            <Button size="sm" variant={app.status === 'withdrawn' ? 'secondary' : 'ghost'} onClick={() => patch({ status: 'withdrawn' }, 'Marked withdrawn')}>Withdrawn</Button>
            {app.submittedAt && <span className="ml-auto">Submitted {formatDeadline(app.submittedAt, false)}</span>}
          </div>
        </Panel>
      </Section>

      {/* About */}
      <Section
        title="About this application"
        action={!editingAbout && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditingAbout(true)}>Edit</Button>}
      >
        {editingAbout ? (
          <AboutEditor app={app} onCancel={() => setEditingAbout(false)} onSave={async (f) => { if (await patch(f, 'Details saved')) setEditingAbout(false) }} />
        ) : (
          <Panel className="space-y-5">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Organisation" value={app.organization} />
              <Fact label="Type" value={typeLabel(app.type)} />
              <Fact label="Priority" value={PRIORITIES.find((p) => p.value === app.priority)?.label} />
              <Fact label="What it is worth" value={app.value} />
              <Fact label="Location" value={app.location} />
              <Fact label="Portal" value={app.url ? <a href={app.url.startsWith('http') ? app.url : `https://${app.url}`} target="_blank" rel="noreferrer" className="break-all text-gold hover:underline">{app.url}</a> : null} />
              <Fact label="Opens" value={app.opensAt ? formatDeadline(app.opensAt, false) : null} />
              <Fact label="Deadline" value={app.deadline ? formatDeadline(app.deadline) : null} />
              <Fact label="Decision expected" value={app.decisionDate ? formatDeadline(app.decisionDate, false) : null} />
            </dl>
            <Prose label="What it is about" text={app.summary} empty="Describe the opportunity: who runs it, what it offers, who it is for." />
            <Prose label="Why I am applying" text={app.whyApply} empty="Your motivation and why you are a strong fit. Useful for essays and interviews." />
          </Panel>
        )}
      </Section>

      {/* Requirements */}
      <Section title="Requirements · do I meet them?" id="requirements"
        description="List every eligibility criterion and be honest about each one. Anything you do not meet shows in red.">
        <ItemList kind="eligibility" items={items('eligibility')} {...listProps} />
      </Section>

      {/* Documents */}
      <Section title="What I need" id="documents"
        description="Documents and materials to prepare. Upload the final version to mark it ready.">
        <ItemList kind="document" items={docs} {...listProps} />
      </Section>

      {/* Steps */}
      <Section title="Progress" id="steps" description="The steps between now and submitting. Tick them off as you go.">
        <ItemList kind="step" items={items('step')} {...listProps} />
      </Section>

      {/* Files */}
      <Section
        title="Files"
        id="files"
        action={
          <>
            <input ref={fileInput} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
            <Button size="sm" variant="secondary" icon={Upload} disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        }
        description="CVs, transcripts, essays, the call for applications, offer letters. Up to 4 MB each."
      >
        {app.files.length === 0 ? (
          <EmptyState title="No files yet" body="Upload the brochure or call for applications so the details are always at hand." />
        ) : (
          <ul className="divide-y divide-gold/10 overflow-hidden rounded-xl border border-gold/15 bg-surface-solid">
            {app.files.map((f) => (
              <li key={f.id} className="group flex items-center gap-3 px-4 py-3">
                <Paperclip className="h-4 w-4 shrink-0 text-gold-dim" aria-hidden="true" />
                <a href={`/api/applications/${app.id}/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <p className="truncate text-sm text-parchment hover:text-gold">{f.name}</p>
                  <p className="text-caption text-parchment/40">
                    {[f.label, formatBytes(f.size), new Date(f.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')}
                  </p>
                </a>
                <a href={`/api/applications/${app.id}/files/${f.id}?download=1`} aria-label={`Download ${f.name}`} title="Download"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-parchment/50 hover:bg-gold/[0.08] hover:text-parchment pointer-fine:h-9 pointer-fine:w-9">
                  <Download className="h-4 w-4" aria-hidden="true" />
                </a>
                <IconButton icon={Trash2} tone="danger" label={`Delete ${f.name}`} onClick={() => deleteFile(f)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Reminders */}
      <Section title="Deadline alarm" id="reminders">
        <Panel className="space-y-4">
          {!app.deadline ? (
            <p className="flex items-center gap-2 text-sm text-parchment/60"><BellOff className="h-4 w-4" aria-hidden="true" /> Set a deadline under Edit to turn on reminders.</p>
          ) : closed ? (
            <p className="flex items-center gap-2 text-sm text-parchment/60"><BellOff className="h-4 w-4" aria-hidden="true" /> Reminders are off because this application is past the deadline stage.</p>
          ) : (
            <>
              <ReminderPicker value={offsets} onChange={(v) => patch({ reminderOffsets: v }, undefined, { reminderOffsets: v.join(",") })} />
              {upcoming.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">Coming up</p>
                  <ul className="space-y-1">
                    {upcoming.map((r) => (
                      <li key={r.m} className="flex items-center gap-2 text-sm text-parchment/75">
                        <Bell className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                        {new Date(r.at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        <span className="text-parchment/40">· {REMINDER_CHOICES.find((c) => c.minutes === r.m)?.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-caption text-parchment/45">No reminders left before the deadline.</p>
              )}
            </>
          )}
        </Panel>
      </Section>

      {/* Contacts */}
      <Section title="Contacts" id="contacts" description="Referees, recruiters, the programme office.">
        <ContactsEditor contacts={app.contacts} onSave={(contacts) => patch({ contacts })} />
      </Section>

      {/* Custom sections */}
      <Section title="Other details" id="details" description="Anything else worth keeping: essay prompts, interview questions, fees, login hints.">
        <SectionsEditor sections={app.details} onSave={(details) => patch({ details })} />
      </Section>

      {/* Notes */}
      <Section title="Notes" id="notes">
        <NotesEditor value={app.notes || ''} onSave={(notes) => patch({ notes })} />
      </Section>
    </Page>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">{label}</dt>
      <dd className={cx('mt-1 text-sm', value ? 'text-parchment' : 'text-parchment/30')}>{value || 'Not set'}</dd>
    </div>
  )
}

function Prose({ label, text, empty }: { label: string; text: string | null; empty: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">{label}</p>
      <p className={cx('mt-1 whitespace-pre-wrap text-body', text ? 'text-parchment/85' : 'text-parchment/35')}>{text || empty}</p>
    </div>
  )
}

function AboutEditor({ app, onSave, onCancel }: { app: Application; onSave: (f: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    title: app.title,
    organization: app.organization || '',
    type: app.type,
    priority: app.priority,
    value: app.value || '',
    location: app.location || '',
    url: app.url || '',
    opensAt: toDateInput(app.opensAt),
    deadline: toLocalInput(app.deadline),
    decisionDate: toDateInput(app.decisionDate),
    summary: app.summary || '',
    whyApply: app.whyApply || '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Panel className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input value={f.title} onChange={set('title')} className={inputClass} /></Field>
        <Field label="Organisation"><input value={f.organization} onChange={set('organization')} className={inputClass} /></Field>
        <Field label="Type">
          <select value={f.type} onChange={set('type')} className={selectClass}>
            {APPLICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={f.priority} onChange={set('priority')} className={selectClass}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="What it is worth" hint="Funding, salary or benefit."><input value={f.value} onChange={set('value')} placeholder="Full tuition + monthly stipend" className={inputClass} /></Field>
        <Field label="Location"><input value={f.location} onChange={set('location')} placeholder="London, UK · Remote" className={inputClass} /></Field>
        <Field label="Application link"><input value={f.url} onChange={set('url')} placeholder="https://" inputMode="url" className={inputClass} /></Field>
        <Field label="Opens"><input type="date" value={f.opensAt} onChange={set('opensAt')} className={inputClass} /></Field>
        <Field label="Deadline" hint="Date and time it closes, in your timezone."><input type="datetime-local" value={f.deadline} onChange={set('deadline')} className={inputClass} /></Field>
        <Field label="Decision expected"><input type="date" value={f.decisionDate} onChange={set('decisionDate')} className={inputClass} /></Field>
      </div>
      <Field label="What it is about"><textarea value={f.summary} onChange={set('summary')} rows={4} className={textareaClass} /></Field>
      <Field label="Why I am applying"><textarea value={f.whyApply} onChange={set('whyApply')} rows={4} className={textareaClass} /></Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => onSave({
            ...f,
            opensAt: fromLocalInput(f.opensAt),
            deadline: fromLocalInput(f.deadline),
            decisionDate: fromLocalInput(f.decisionDate),
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })}
        >
          Save details
        </Button>
      </div>
    </Panel>
  )
}

function ContactsEditor({ contacts, onSave }: { contacts: Contact[]; onSave: (c: Contact[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [c, setC] = useState({ name: '', role: '', email: '', phone: '' })
  const add = () => {
    if (!c.name.trim()) return
    onSave([...contacts, { id: newId(), ...c, name: c.name.trim() }])
    setC({ name: '', role: '', email: '', phone: '' })
    setAdding(false)
  }
  return (
    <div className="space-y-3">
      {contacts.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contacts.map((p) => (
            <Panel as="li" key={p.id} className="group flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gold-dim" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm text-parchment">{p.name}</p>
                {p.role && <p className="text-caption text-parchment/50">{p.role}</p>}
                {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 truncate text-caption text-gold hover:underline"><Mail className="h-3 w-3" aria-hidden="true" />{p.email}</a>}
                {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-caption text-gold hover:underline"><Phone className="h-3 w-3" aria-hidden="true" />{p.phone}</a>}
              </div>
              <IconButton icon={X} label={`Remove ${p.name}`} tone="danger" onClick={() => onSave(contacts.filter((x) => x.id !== p.id))} />
            </Panel>
          ))}
        </ul>
      )}
      {adding ? (
        <Panel className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Name" className={inputClass} aria-label="Name" autoFocus />
            <input value={c.role} onChange={(e) => setC({ ...c, role: e.target.value })} placeholder="Role, e.g. Referee" className={inputClass} aria-label="Role" />
            <input value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} placeholder="Email" type="email" className={inputClass} aria-label="Email" />
            <input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} placeholder="Phone" type="tel" className={inputClass} aria-label="Phone" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={add} disabled={!c.name.trim()}>Add contact</Button>
          </div>
        </Panel>
      ) : (
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>Add contact</Button>
      )}
    </div>
  )
}

function SectionsEditor({ sections, onSave }: { sections: DetailSection[]; onSave: (s: DetailSection[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', body: '' })
  const start = (s: DetailSection) => { setEditing(s.id); setDraft({ title: s.title, body: s.body }) }
  const save = () => {
    if (!editing) return
    const exists = sections.some((s) => s.id === editing)
    const next = exists
      ? sections.map((s) => (s.id === editing ? { ...s, ...draft } : s))
      : [...sections, { id: editing, ...draft }]
    onSave(next.filter((s) => s.title.trim() || s.body.trim()))
    setEditing(null)
  }
  return (
    <div className="space-y-3">
      {sections.map((s) =>
        editing === s.id ? null : (
          <Panel key={s.id} className="group space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-heading text-parchment">{s.title || 'Untitled'}</h3>
              <RowActions actions={[
                { label: 'Edit', icon: Pencil, onSelect: () => start(s) },
                { label: 'Delete', icon: Trash2, destructive: true, onSelect: () => onSave(sections.filter((x) => x.id !== s.id)) },
              ]} />
            </div>
            <p className="whitespace-pre-wrap text-body text-parchment/75">{s.body}</p>
          </Panel>
        ),
      )}
      {editing ? (
        <Panel className="space-y-3">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Section title, e.g. Essay prompts" className={inputClass} aria-label="Section title" autoFocus />
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6} placeholder="Write it down" className={textareaClass} aria-label="Section body" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={save}>Save section</Button>
          </div>
        </Panel>
      ) : (
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setEditing(newId()); setDraft({ title: '', body: '' }) }}>Add a section</Button>
      )}
    </div>
  )
}

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  const [dirty, setDirty] = useState(false)
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true) }}
        onBlur={() => { if (dirty) { onSave(text); setDirty(false) } }}
        rows={6}
        placeholder="Anything to remember. Saves when you click away."
        className={textareaClass}
        aria-label="Notes"
      />
      {dirty && <Badge tone="gold">Unsaved, click away to save</Badge>}
    </div>
  )
}
