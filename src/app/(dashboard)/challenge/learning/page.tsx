'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NotebookPen, PenLine, Plus, Sparkles, X, Zap } from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { Badge, Button, EmptyState, Field, Meter, Page, PageHeader, Panel, Section, cx, inputClass } from '@/components/ds'
import { ChallengeTabs } from '@/components/applications/ChallengeTabs'

interface TrackRow {
  id: string
  title: string
  subject: string | null
  goal: string | null
  emoji: string | null
  completedAt: string | null
  progress: { done: number; total: number; pct: number }
  current: string | null
  cards: number
  due: number
}

const LEVELS = ['Complete beginner', 'Know the basics', 'Intermediate', 'Advanced']

type Start = 'own' | 'import' | 'ai'
const STARTS: { value: Start; icon: typeof PenLine; title: string; body: string }[] = [
  { value: 'own', icon: PenLine, title: 'Write my own', body: 'Add sections yourself and keep notes in them.' },
  { value: 'import', icon: NotebookPen, title: 'Import my notes', body: 'Paste notes; the AI splits them into sections.' },
  { value: 'ai', icon: Sparkles, title: 'Plan it with AI', body: 'The AI suggests the sections for a topic.' },
]

export default function LearningLabPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ title: '', goal: '', level: LEVELS[0], start: 'own' as Start })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/learning', { cache: 'no-store' })
      if (res.ok) setTracks((await res.json()).tracks || [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  useEffect(() => {
    const on = () => { void load() }
    window.addEventListener('inchstone:data-changed', on)
    return () => window.removeEventListener('inchstone:data-changed', on)
  }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) { showToast('Name what you are learning', 'error'); return }
    setSaving(true)
    try {
      // AI-planned tracks unlock step by step; your own sections are all open.
      const res = await fetch('/api/learning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: f.title, goal: f.start === 'ai' ? f.goal : '', level: f.level, outline: f.start === 'ai', inOrder: f.start === 'ai' }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Could not create it', 'error'); return }
      if (data.outlineError) showToast(data.outlineError, 'error')
      else if (data.outlined) showToast(`Your plan is ready: ${data.outlined} sections`, 'success')
      router.push(`/challenge/learning/${data.track.id}${f.start === 'import' ? '?start=notes' : ''}`)
    } catch { showToast('Network error', 'error') } finally { setSaving(false) }
  }

  if (loading) return <Loader routeKey="challenge" />

  const due = tracks.reduce((n, t) => n + t.due, 0)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }))

  return (
    <Page>
      <PageHeader
        eyebrow="Challenge"
        title="Learning Lab"
        description="Keep notes by subject, and turn them into flashcards that come back just before you forget."
        actions={<Button variant="primary" icon={creating ? X : Plus} onClick={() => setCreating((v) => !v)}>{creating ? 'Close' : 'New track'}</Button>}
      />
      <ChallengeTabs />

      {creating && (
        <form onSubmit={create}>
          <Panel className="space-y-5 animate-fadeIn">
            <Field label="What are you learning?">
              <input autoFocus value={f.title} onChange={set('title')} placeholder="e.g. Finance degree, CFA Level 1, Spanish" className={inputClass} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">How do you want to start?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {STARTS.map(({ value, icon: Icon, title, body }) => (
                  <button key={value} type="button" onClick={() => setF((x) => ({ ...x, start: value }))} aria-pressed={f.start === value}
                    className={cx('flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors', f.start === value ? 'border-gold/60 bg-gold/10' : 'border-gold/15 hover:border-gold/35')}>
                    <span className={cx('flex items-center gap-2 text-sm font-semibold', f.start === value ? 'text-gold' : 'text-parchment')}><Icon className="h-4 w-4" aria-hidden />{title}</span>
                    <span className="text-caption text-parchment/55">{body}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {f.start === 'ai' && (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] animate-fadeIn">
                <Field label="Your goal (optional)"><input value={f.goal} onChange={set('goal')} placeholder="Pass the ICAN foundation exam in March" className={inputClass} /></Field>
                <Field label="Your level"><select value={f.level} onChange={set('level')} className={inputClass}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? (f.start === 'ai' ? 'Planning… (about 30s)' : 'Creating…') : 'Create'}</Button>
            </div>
          </Panel>
        </form>
      )}

      {due > 0 && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 border-gold/30">
          <p className="text-sm text-parchment/80"><span className="font-semibold text-parchment">{due} flashcards</span> are due for review across your tracks.</p>
          <span className="inline-flex items-center gap-1.5 text-xs text-parchment/50"><Zap className="h-3.5 w-3.5 text-gold" /> Open a track to review</span>
        </Panel>
      )}

      <Section title="Your tracks">
        {tracks.length === 0 ? (
          <EmptyState title="Nothing here yet" body="A track is anything you are learning. Inside it, add a section for each subject and keep your notes there."
            action={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New track</Button>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tracks.map((t) => (
              <Link key={t.id} href={`/challenge/learning/${t.id}`} className="group block focus-visible:outline-none">
                <Panel interactive className="flex h-full flex-col gap-3 group-focus-visible:ring-2 group-focus-visible:ring-gold/40">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-xl">{t.emoji || '📘'}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-xl font-bold text-parchment">{t.title}</h3>
                      <p className="text-caption text-parchment/55">{t.progress.total} sections · {t.cards} flashcards</p>
                    </div>
                    {t.completedAt ? <Badge tone="moss">Done</Badge> : t.due > 0 ? <Badge tone="ember">{t.due} due</Badge> : null}
                  </div>
                  {t.progress.total > 0 && (
                    <div className="mt-auto space-y-1">
                      <Meter value={t.progress.pct} tone={t.progress.pct >= 100 ? 'moss' : 'gold'} />
                      <p className="font-mono text-[10px] text-parchment/40">{t.progress.done} of {t.progress.total} sections finished</p>
                    </div>
                  )}
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </Page>
  )
}
