'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, Layers, Plus, Sparkles, X } from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { Badge, Button, EmptyState, Field, Meter, Page, PageHeader, Panel, Section, Stat, StatGrid, cx, inputClass } from '@/components/ds'
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

export default function LearningLabPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ title: '', subject: '', goal: '', emoji: '', level: LEVELS[0], outline: true })

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

  const create = async () => {
    if (!f.title.trim()) { showToast('Name what you are learning', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Could not create it', 'error'); return }
      if (data.outlineError) showToast(data.outlineError, 'error')
      else if (data.outlined) showToast(`Your path is ready: ${data.outlined} sections`, 'success')
      router.push(`/challenge/learning/${data.track.id}`)
    } catch { showToast('Network error', 'error') } finally { setSaving(false) }
  }

  if (loading) return <Loader routeKey="challenge" />

  const active = tracks.filter((t) => !t.completedAt)
  const due = tracks.reduce((n, t) => n + t.due, 0)
  const cards = tracks.reduce((n, t) => n + t.cards, 0)
  const sectionsDone = tracks.reduce((n, t) => n + t.progress.done, 0)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }))

  return (
    <Page>
      <PageHeader
        eyebrow="Challenge"
        title="Learning Lab"
        description="Learn anything step by step: a path of sections that unlock as you finish them, key concepts highlighted, your own materials, AI study notes and flashcards that come back when you are about to forget."
        actions={<Button variant="primary" icon={creating ? X : Plus} onClick={() => setCreating((v) => !v)}>{creating ? 'Close' : 'Start learning'}</Button>}
      />
      <ChallengeTabs />

      <StatGrid>
        <Stat label="Learning now" value={active.length} caption={`${tracks.length - active.length} finished`} icon={BookOpenCheck} />
        <Stat label="Sections done" value={sectionsDone} tone="gold" caption="across every track" icon={Layers} />
        <Stat label="Cards due" value={due} tone={due ? 'ember' : 'moss'} caption={due ? 'ready to review' : 'all caught up'} />
        <Stat label="Flashcards" value={cards} caption="in your decks" />
      </StatGrid>

      {creating && (
        <Section title="New learning track">
          <Panel className="space-y-5 animate-fadeIn">
            <div className="grid gap-4 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Icon"><input value={f.emoji} onChange={set('emoji')} placeholder="📘" maxLength={4} className={cx(inputClass, 'text-center text-lg')} /></Field>
              <Field label="What are you learning?"><input autoFocus value={f.title} onChange={set('title')} placeholder="Financial accounting basics" className={inputClass} /></Field>
              <Field label="Subject"><input value={f.subject} onChange={set('subject')} placeholder="Accounting" className={inputClass} /></Field>
            </div>
            <Field label="Your goal" hint="The AI shapes the path around it.">
              <textarea value={f.goal} onChange={set('goal')} rows={2} placeholder="Pass the ICAN foundation exam in March" className={cx(inputClass, 'py-2.5')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Where you are starting">
                <select value={f.level} onChange={set('level')} className={inputClass}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
              </Field>
              <label className="flex items-center gap-3 self-end rounded-xl border border-gold/20 px-3 py-3">
                <input type="checkbox" checked={f.outline} onChange={(e) => setF((x) => ({ ...x, outline: e.target.checked }))} className="h-4 w-4 accent-[rgb(var(--gold-rgb))]" />
                <span className="text-sm text-parchment/80"><Sparkles className="mr-1 inline h-4 w-4 text-gold" aria-hidden />Let AI build the path of sections and key concepts</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="primary" onClick={create} disabled={saving}>{saving ? (f.outline ? 'Building your path… (about 30s)' : 'Creating…') : 'Create track'}</Button>
            </div>
          </Panel>
        </Section>
      )}

      <Section title="Your tracks">
        {tracks.length === 0 ? (
          <EmptyState title="Nothing in the lab yet" body="Start a track for anything you want to learn: an exam, a language, a skill, a book."
            action={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Start learning</Button>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tracks.map((t) => (
              <Link key={t.id} href={`/challenge/learning/${t.id}`} className="group block focus-visible:outline-none">
                <Panel interactive className="flex h-full flex-col gap-4 group-focus-visible:ring-2 group-focus-visible:ring-gold/40">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/10 text-2xl">{t.emoji || '📘'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/40">{t.subject || 'Learning'}</p>
                      <h3 className="truncate font-display text-xl font-bold text-parchment">{t.title}</h3>
                      <p className="truncate text-caption text-parchment/55">{t.completedAt ? 'Finished. Well done.' : t.current ? `Now: ${t.current}` : 'Add your first section'}</p>
                    </div>
                    {t.completedAt ? <Badge tone="moss">Done</Badge> : t.due > 0 ? <Badge tone="ember">{t.due} due</Badge> : null}
                  </div>
                  <div className="mt-auto space-y-1.5">
                    <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-parchment/45">
                      <span>{t.progress.done} of {t.progress.total} sections</span><span className="tabular-nums">{t.progress.pct}%</span>
                    </div>
                    <Meter value={t.progress.pct} tone={t.progress.pct >= 100 ? 'moss' : 'gold'} />
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </Page>
  )
}
