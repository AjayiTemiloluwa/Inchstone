'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Archive, BookOpen, Check, FileText, Link2, Lock, NotebookPen, Paperclip, Pencil, Plus, Sparkles,
  Trash2, Trophy, Upload, Zap, ArrowUp, ArrowDown, Wand2, ChevronDown, Layers,
} from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { Badge, Button, EmptyState, IconButton, Meter, Page, PageHeader, Panel, RowActions, Section, Segmented, cx, inputClass } from '@/components/ds'
import { ChallengeTabs } from '@/components/applications/ChallengeTabs'
import { StudyDeck, type StudyCard } from '@/components/learning/StudyDeck'
import { NotesPicker } from '@/components/learning/NotesPicker'

interface Concept { id: string; term: string; explanation: string }
interface Material { id: string; kind: 'note' | 'link' | 'file'; title: string; url: string | null; content: string | null; fileName: string | null; mime: string | null; size: number | null; extractedAt: string | null; createdAt: string }
interface Card { id: string; front: string; back: string; reps: number; interval: number; due: string }
interface SectionRow {
  id: string; title: string; summary: string | null; concepts: Concept[]; notes: string | null; order: number
  completedAt: string | null; state: 'done' | 'open' | 'locked'; mastery: number | null; due: number
  materials: Material[]; cards: Card[]
}
interface Track {
  id: string; title: string; subject: string | null; goal: string | null; emoji: string | null; completedAt: string | null; inOrder: boolean
  progress: { done: number; total: number; pct: number }; sections: SectionRow[]
}

type Tab = 'notes' | 'concepts' | 'guide' | 'materials' | 'cards'
const TABS: { value: Tab; label: string }[] = [
  { value: 'notes', label: 'My notes' },
  { value: 'concepts', label: 'Concepts' },
  { value: 'cards', label: 'Flashcards' },
  { value: 'guide', label: 'Study guide' },
  { value: 'materials', label: 'Files & links' },
]
const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

const textarea = 'w-full rounded-lg border border-gold/20 bg-ink/40 px-3 py-2.5 text-sm leading-relaxed text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20'

/** Render AI/user notes: "Heading:" lines become headings, "- " lines bullets. */
function NotesView({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-body leading-relaxed text-parchment/85">
      {text.split('\n').map((line, i) => {
        const l = line.trim()
        if (!l) return <div key={i} className="h-1" />
        if (/^#{1,3}\s/.test(l) || (/:$/.test(l) && l.length < 70)) return <h3 key={i} className="pt-2 font-display text-lg font-bold text-parchment">{l.replace(/^#+\s*/, '').replace(/:$/, '')}</h3>
        if (/^[-*•]\s/.test(l)) return <p key={i} className="flex gap-2 pl-1"><span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{l.replace(/^[-*•]\s/, '')}</p>
        return <p key={i}>{l.replace(/\*\*/g, '')}</p>
      })}
    </div>
  )
}

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { showToast, confirm } = useToast()
  const [track, setTrack] = useState<Track | null>(null)
  const [missing, setMissing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('notes')
  const [ai, setAi] = useState<string | null>(null)
  const [study, setStudy] = useState<{ cards: StudyCard[]; title: string } | null>(null)
  const [newSection, setNewSection] = useState('')
  const [sectionMore, setSectionMore] = useState(false)
  const [sectionExtra, setSectionExtra] = useState({ summary: '', concepts: '' })
  const [organize, setOrganize] = useState<{ text: string; picking: boolean } | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [pickNotes, setPickNotes] = useState(false)
  const [editConcept, setEditConcept] = useState<Concept | null>(null)
  const [quick, setQuick] = useState({ title: '', text: '' })
  const [editNote, setEditNote] = useState<{ id: string; title: string; text: string } | null>(null)
  const [openNote, setOpenNote] = useState<string | null>(null)
  const orgFileRef = useRef<HTMLInputElement>(null)
  // Arriving from "From my notes": open the import panel straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('start') !== 'notes') return
    const t = setTimeout(() => setOrganize({ text: '', picking: true }), 0)
    return () => clearTimeout(t)
  }, [])
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [concept, setConcept] = useState({ term: '', explanation: '' })
  const [mat, setMat] = useState<{ kind: 'note' | 'link'; title: string; url: string; content: string } | null>(null)
  const [cardDraft, setCardDraft] = useState({ front: '', back: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  /** When the track was last loaded: due dates are compared against it. */
  const [nowMs, setNowMs] = useState(() => Date.now())

  const load = useCallback(async () => {
    const res = await fetch(`/api/learning/${id}`, { cache: 'no-store' })
    if (res.status === 404) { setMissing(true); return }
    if (res.ok) {
      const t: Track = (await res.json()).track
      setNowMs(Date.now())
      setTrack(t)
      setSelected((s) => s && t.sections.some((x) => x.id === s) ? s : (t.sections.find((x) => x.state === 'open') ?? t.sections[0])?.id ?? null)
    }
  }, [id])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  useEffect(() => {
    const on = () => { void load() }
    window.addEventListener('inchstone:data-changed', on)
    return () => window.removeEventListener('inchstone:data-changed', on)
  }, [load])

  const sec = useMemo(() => track?.sections.find((s) => s.id === selected) ?? null, [track, selected])
  const dueAll = useMemo(() => (track?.sections ?? []).flatMap((s) => s.cards.filter((c) => new Date(c.due).getTime() <= nowMs)), [track, nowMs])

  const api = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(data.error || 'Something went wrong', 'error'); return null }
    return data
  }
  const patchSection = async (body: Record<string, unknown>) => sec && api(`/api/learning/sections/${sec.id}`, 'PATCH', body)

  const runAi = async (task: 'notes' | 'flashcards' | 'concepts') => {
    if (!sec) return
    setAi(task)
    const data = await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'ai', task })
    setAi(null)
    if (!data) return
    showToast(task === 'notes' ? 'Study notes written' : task === 'flashcards' ? `${data.added} flashcards made` : `${data.added} concepts found`, 'success')
    if (task === 'notes') setTab('guide')
    if (task === 'flashcards') setTab('cards')
    await load()
  }

  /** Concepts and flashcards from one note, or from every note not yet extracted. */
  const extract = async (materialId?: string) => {
    if (!sec) return
    setAi(materialId ? `x:${materialId}` : 'extract')
    const data = await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'ai', task: 'extract', materialId })
    setAi(null)
    if (!data) return
    showToast(`Pulled out ${data.concepts} concept${data.concepts === 1 ? '' : 's'} and ${data.cards} flashcard${data.cards === 1 ? '' : 's'}`, 'success')
    await load()
  }

  const saveQuick = async (andExtract: boolean) => {
    if (!sec) return
    const text = quick.text.trim()
    if (!text) return
    const title = quick.title.trim() || text.split('\n')[0].replace(/^#+\s*/, '').slice(0, 80)
    const data = await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'note', title, content: text })
    if (!data) return
    setQuick({ title: '', text: '' })
    await load()
    if (andExtract) await extract(data.material.id)
    else showToast('Note saved', 'success')
  }

  const complete = async (done: boolean) => {
    const data = await patchSection({ complete: done })
    if (!data) return
    if (done) {
      if (data.trackDone) {
        showToast(`Track finished: ${track?.title}! 🏆`, 'success')
        import('@/components/ui/Confetti').then((m) => m.fireConfetti()).catch(() => {})
      } else showToast(data.unlocked ? `Section done. Unlocked: ${data.unlocked}` : 'Section done', 'success')
      navigator.vibrate?.(30)
    }
    await load()
    if (done && data.unlocked && track) {
      const next = track.sections.find((s) => s.title === data.unlocked)
      if (next) { setSelected(next.id); setTab('notes') }
    }
  }

  const upload = async (file: File) => {
    if (!sec) return
    if (file.size > 4 * 1024 * 1024) { showToast('Files must be 4 MB or smaller', 'error'); return }
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/learning/sections/${sec.id}`, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(data.error || 'Upload failed', 'error'); return }
    showToast(data.material?.readable ? 'File added. The AI can read it.' : 'File added. (The AI reads text files only; paste key parts as a note.)', 'success')
    await load()
  }

  if (missing) return <Page><EmptyState title="Track not found" action={<Button href="/challenge/learning" icon={ArrowLeft}>Back to the lab</Button>} /></Page>
  if (!track) return <Loader routeKey="challenge" />

  const locked = sec?.state === 'locked'
  const notes = (sec?.materials ?? []).filter((m) => m.kind === 'note').reverse()
  const fresh = notes.filter((m) => !m.extractedAt && m.content).length

  return (
    <Page width="wide">
      <div>
        <Link href="/challenge/learning" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-parchment/55 hover:text-parchment">
          <ArrowLeft className="h-4 w-4" /> Learning Lab
        </Link>
      </div>
      <PageHeader
        eyebrow={[track.emoji, track.subject || 'Learning'].filter(Boolean).join(' ')}
        title={track.title}
        meta={track.completedAt ? <Badge tone="moss">Finished</Badge> : `${track.progress.pct}%`}
        description={track.goal || undefined}
        actions={
          <>
            <Button variant="primary" icon={Zap} disabled={!dueAll.length} onClick={() => setStudy({ cards: dueAll, title: `${track.title}: due cards` })}>
              {dueAll.length ? `Review ${dueAll.length} due` : 'Nothing due'}
            </Button>
            <RowActions label="Track actions" className="[&>button]:opacity-100" actions={[
              track.inOrder
                ? { label: 'Open every section (subjects)', icon: Layers, onSelect: async () => { if (await api(`/api/learning/${track.id}`, 'PATCH', { inOrder: false })) { showToast('Every section is open now', 'success'); await load() } } }
                : { label: 'Unlock sections in order', icon: Lock, onSelect: async () => { if (await api(`/api/learning/${track.id}`, 'PATCH', { inOrder: true })) { showToast('Sections now unlock one after another', 'success'); await load() } } },
              { label: 'Archive', icon: Archive, onSelect: async () => { if (await api(`/api/learning/${track.id}`, 'PATCH', { archived: true })) router.push('/challenge/learning') } },
              { label: 'Delete track', icon: Trash2, destructive: true, onSelect: async () => {
                if (await confirm(`Delete "${track.title}" with every section, material and card?`) && await api(`/api/learning/${track.id}`, 'DELETE')) router.push('/challenge/learning')
              } },
            ]} />
          </>
        }
      />
      <ChallengeTabs />

      {/* Progress */}
      <Panel className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">{track.progress.done} of {track.progress.total} sections finished</p>
          {track.completedAt && <span className="inline-flex items-center gap-1.5 text-sm text-moss"><Trophy className="h-4 w-4" /> Track complete</span>}
        </div>
        <div className="flex gap-1">
          {track.sections.map((s) => (
            <button key={s.id} type="button" onClick={() => setSelected(s.id)} title={s.title} aria-label={s.title}
              className={cx('h-2 flex-1 rounded-full transition-colors', s.state === 'done' ? 'bg-moss' : s.state === 'open' ? 'bg-gold' : 'bg-gold/15', s.id === selected && 'ring-2 ring-parchment/40')} />
          ))}
          {!track.sections.length && <span className="h-2 flex-1 rounded-full bg-gold/10" />}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Path */}
        <Section title={track.inOrder ? 'Your path' : 'Sections'} action={
          <Button size="sm" variant="ghost" icon={Wand2} onClick={() => setOrganize(o => (o ? null : { text: '', picking: false }))}>From my notes</Button>
        }>
          {organize && (
            <div className="mb-4 space-y-3 rounded-2xl border border-gold/25 bg-surface-solid p-4 animate-fadeIn">
              <p className="text-sm font-semibold text-parchment">Build sections from your own notes</p>
              <p className="text-caption text-parchment/55">Paste class notes, a syllabus or a chapter, pick notes you already wrote, or upload a text file. The AI splits it into sections and concepts using only what you give it, and keeps the original text with each section.</p>
              <textarea value={organize.text} onChange={(e) => setOrganize({ ...organize, text: e.target.value })} rows={8} placeholder="Paste your notes here…" aria-label="Your notes" className={textarea} />
              <div className="flex flex-wrap items-center gap-2">
                <input ref={orgFileRef} type="file" accept=".txt,.md,.markdown,.csv,.json,.html,text/*" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const t = await f.text(); setOrganize(o => o && { ...o, text: (o.text ? o.text + '\n\n' : '') + t.slice(0, 24000) }) } }} />
                <Button size="sm" variant="ghost" icon={Upload} onClick={() => orgFileRef.current?.click()}>Text file</Button>
                <Button size="sm" variant="ghost" icon={NotebookPen} onClick={() => setOrganize({ ...organize, picking: true })}>Pick from Notes</Button>
                <span className="ml-auto font-mono text-[10px] text-parchment/40">{organize.text.length.toLocaleString()} / 24,000</span>
              </div>
              {organize.picking && (
                <NotesPicker cta="Use" onClose={() => setOrganize({ ...organize, picking: false })}
                  onPick={(ns) => setOrganize({ picking: false, text: [organize.text, ...ns.map(n => `# ${n.title}\n${n.text}`)].filter(Boolean).join('\n\n').slice(0, 24000) })} />
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOrganize(null)}>Cancel</Button>
                <Button variant="primary" icon={Sparkles} disabled={organizing || organize.text.trim().length < 40}
                  onClick={async () => {
                    setOrganizing(true)
                    const data = await api(`/api/learning/${track.id}`, 'POST', { kind: 'organize', text: organize.text })
                    setOrganizing(false)
                    if (data) { showToast(`Added ${data.added} sections from your notes`, 'success'); setOrganize(null); await load() }
                  }}>
                  {organizing ? 'Organising… (about 30s)' : 'Make sections'}
                </Button>
              </div>
            </div>
          )}
          <ol className="relative space-y-1">
            {track.sections.map((s, i) => (
              <li key={s.id} className="relative">
                {i < track.sections.length - 1 && <span aria-hidden className={cx('absolute left-[19px] top-10 h-[calc(100%-1.25rem)] w-px', s.state === 'done' ? 'bg-moss/50' : 'bg-gold/15')} />}
                <button type="button" onClick={() => { setSelected(s.id); setEditingNotes(null) }} aria-current={s.id === selected ? 'step' : undefined}
                  className={cx('flex w-full items-start gap-3 rounded-xl p-2 text-left transition-colors', s.id === selected ? 'bg-gold/[0.09]' : 'hover:bg-gold/[0.05]')}>
                  <span className={cx('relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2',
                    s.state === 'done' ? 'border-moss bg-moss text-ink' : s.state === 'open' ? 'border-gold bg-gold/15 text-gold' : 'border-gold/20 bg-surface-solid text-parchment/35')}>
                    {s.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : s.state === 'locked' ? <Lock className="h-3.5 w-3.5" /> : <span className="font-mono text-xs font-bold">{i + 1}</span>}
                    {s.state === 'open' && <span className="absolute inset-0 animate-ping rounded-full border border-gold/40 motion-reduce:hidden" />}
                  </span>
                  <span className="min-w-0 flex-1 pt-1">
                    <span className={cx('block text-sm font-semibold', s.state === 'locked' ? 'text-parchment/45' : 'text-parchment')}>{s.title}</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-parchment/40">
                      <span>{s.materials.filter((m) => m.kind === 'note').length} notes</span>
                      <span>{s.concepts.length} concepts</span>
                      <span>{s.cards.length} cards</span>
                      {s.mastery !== null && <span className="text-moss">{s.mastery}% mastered</span>}
                      {s.due > 0 && <span className="text-ember">{s.due} due</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <form className="mt-3 space-y-2 rounded-xl border border-gold/15 p-3" onSubmit={async (e) => {
            e.preventDefault()
            if (!newSection.trim()) return
            if (await api(`/api/learning/${track.id}`, 'POST', { title: newSection, ...sectionExtra })) {
              setNewSection(''); setSectionExtra({ summary: '', concepts: '' }); setSectionMore(false); await load()
            }
          }}>
            <div className="flex gap-2">
              <input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="New section, e.g. Financial Engineering" aria-label="New section title" className={inputClass} />
              <Button type="submit" icon={Plus} disabled={!newSection.trim()}>Add</Button>
            </div>
            <button type="button" onClick={() => setSectionMore(v => !v)} className="inline-flex items-center gap-1 text-xs text-parchment/50 hover:text-gold">
              <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', sectionMore && 'rotate-180')} /> Summary and concepts
            </button>
            {sectionMore && (
              <div className="space-y-2 animate-fadeIn">
                <input value={sectionExtra.summary} onChange={(e) => setSectionExtra({ ...sectionExtra, summary: e.target.value })} placeholder="What this section covers" aria-label="Summary" className={inputClass} />
                <textarea value={sectionExtra.concepts} onChange={(e) => setSectionExtra({ ...sectionExtra, concepts: e.target.value })} rows={4}
                  placeholder={'One concept per line, e.g.\nMean — the average of the values\nMedian — the middle value'} aria-label="Concepts" className={textarea} />
              </div>
            )}
          </form>
        </Section>

        {/* Section workspace */}
        {sec ? (
          <section className="min-w-0 space-y-4" aria-label={sec.title}>
            <Panel className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">
                    Section {sec.order + 1} · {sec.state === 'done' ? 'Finished' : sec.state === 'locked' ? 'Locked' : track.inOrder ? 'In progress' : 'Open'}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-parchment sm:text-3xl">{sec.title}</h2>
                  {sec.summary && <p className="mt-1 text-body text-parchment/60">{sec.summary}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {sec.cards.length > 0 && (
                    <Button icon={BookOpen} onClick={() => setStudy({ cards: sec.cards, title: sec.title })}>Study {sec.cards.length}</Button>
                  )}
                  {sec.state === 'done'
                    ? <Button variant="ghost" onClick={() => complete(false)}>Reopen</Button>
                    : <Button variant={track.inOrder ? 'primary' : 'secondary'} icon={Check} disabled={locked} onClick={() => complete(true)} title={locked ? 'Finish the sections before this one first' : undefined}>Mark finished</Button>}
                  <RowActions className="[&>button]:opacity-100" actions={[
                    { label: 'Rename', icon: Pencil, onSelect: async () => { const t = window.prompt('Section title', sec.title); if (t && t.trim() && await patchSection({ title: t })) await load() } },
                    { label: 'Edit summary', icon: NotebookPen, onSelect: async () => { const t = window.prompt('What this section covers', sec.summary ?? ''); if (t !== null && await patchSection({ summary: t })) await load() } },
                    ...(sec.order > 0 ? [{ label: 'Move up', icon: ArrowUp, onSelect: async () => { if (await patchSection({ move: 'up' })) await load() } }] : []),
                    ...(sec.order < track.sections.length - 1 ? [{ label: 'Move down', icon: ArrowDown, onSelect: async () => { if (await patchSection({ move: 'down' })) await load() } }] : []),
                    { label: 'Delete section', icon: Trash2, destructive: true, onSelect: async () => { if (await confirm(`Delete "${sec.title}"?`) && await api(`/api/learning/sections/${sec.id}`, 'DELETE')) await load() } },
                  ]} />
                </div>
              </div>
              {locked && (
                <p className="flex items-center gap-2 rounded-xl border border-gold/15 bg-gold/[0.05] px-3 py-2 text-sm text-parchment/70">
                  <Lock className="h-4 w-4 text-gold-dim" /> Unlocks when you finish the section before it. You can still prepare it.
                </p>
              )}
              <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Section views" />
            </Panel>

            {tab === 'notes' && (
              <Section title="My notes" description={`Write what you learn about ${sec.title} as you go. The AI pulls concepts and flashcards out of your notes, using only what you wrote.`} action={
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" icon={NotebookPen} onClick={() => setPickNotes((v) => !v)}>From Notes page</Button>
                  {notes.length > 0 && (
                    <Button size="sm" icon={Sparkles} disabled={!!ai || !fresh} onClick={() => extract()} title={fresh ? undefined : 'Every note is extracted'}>
                      {ai === 'extract' ? 'Extracting…' : fresh ? `Extract from ${fresh} new` : 'All extracted'}
                    </Button>
                  )}
                </div>
              }>
                {pickNotes && (
                  <div className="mb-3">
                    <NotesPicker onClose={() => setPickNotes(false)} onPick={async (ns) => {
                      for (const n of ns) await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'note', title: n.title, content: n.text })
                      setPickNotes(false)
                      showToast(`Added ${ns.length} note${ns.length === 1 ? '' : 's'}`, 'success')
                      await load()
                    }} />
                  </div>
                )}
                <Panel className="space-y-2 border-gold/25">
                  <input value={quick.title} onChange={(e) => setQuick({ ...quick, title: e.target.value })} placeholder={`Topic (optional), e.g. a part of ${sec.title}`} aria-label="Note topic"
                    className={cx(inputClass, 'font-semibold')} />
                  <textarea value={quick.text} onChange={(e) => setQuick({ ...quick, text: e.target.value })} rows={5}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void saveQuick(false) } }}
                    placeholder={`Quick note on ${sec.title}… definitions, formulas, examples, anything from class or your reading`} aria-label="Note" className={textarea} />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto hidden font-mono text-[10px] text-parchment/35 sm:inline">Ctrl + Enter to save</span>
                    <Button variant="ghost" disabled={!quick.text.trim() || !!ai} onClick={() => saveQuick(false)}>Save note</Button>
                    <Button variant="primary" icon={Sparkles} disabled={!quick.text.trim() || !!ai} onClick={() => saveQuick(true)}>Save and extract</Button>
                  </div>
                </Panel>
                {notes.length === 0 ? (
                  <p className="mt-4 text-center text-caption text-parchment/45">No notes in this section yet. Your first one goes above.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {notes.map((m) => (
                      <li key={m.id}>
                        <Panel padded={false} className="group p-4">
                          {editNote?.id === m.id ? (
                            <div className="space-y-2">
                              <input value={editNote.title} onChange={(e) => setEditNote({ ...editNote, title: e.target.value })} aria-label="Note topic" className={cx(inputClass, 'font-semibold')} autoFocus />
                              <textarea value={editNote.text} onChange={(e) => setEditNote({ ...editNote, text: e.target.value })} rows={10} aria-label="Note" className={textarea} />
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditNote(null)}>Cancel</Button>
                                <Button size="sm" variant="primary" onClick={async () => {
                                  if (await api(`/api/learning/items/material/${m.id}`, 'PATCH', { title: editNote.title, content: editNote.text })) { setEditNote(null); await load() }
                                }}>Save</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-parchment">{m.title}</p>
                                  <p className="font-mono text-[10px] text-parchment/40">{shortDate(m.createdAt)}{m.extractedAt ? ' · extracted' : ''}</p>
                                </div>
                                <Button size="sm" variant="ghost" icon={Sparkles} disabled={!!ai || !m.content} onClick={() => extract(m.id)}>
                                  {ai === `x:${m.id}` ? 'Extracting…' : m.extractedAt ? 'Again' : 'Extract'}
                                </Button>
                                <IconButton icon={Pencil} label={`Edit ${m.title}`} onClick={() => setEditNote({ id: m.id, title: m.title, text: m.content ?? '' })} />
                                <IconButton icon={Trash2} tone="danger" label={`Delete ${m.title}`} onClick={async () => { if (await confirm(`Delete the note "${m.title}"?`) && await api(`/api/learning/items/material/${m.id}`, 'DELETE')) await load() }} />
                              </div>
                              {m.content && (openNote === m.id
                                ? <div className="mt-2"><NotesView text={m.content} /></div>
                                : <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-parchment/70">{m.content}</p>)}
                              {m.content && m.content.length > 280 && (
                                <button type="button" onClick={() => setOpenNote(openNote === m.id ? null : m.id)} className="mt-1 text-xs text-gold-dim hover:text-gold">
                                  {openNote === m.id ? 'Show less' : 'Read all'}
                                </button>
                              )}
                            </>
                          )}
                        </Panel>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {tab === 'concepts' && (
              <Section title="Key concepts" action={<Button size="sm" icon={Sparkles} disabled={!!ai} onClick={() => runAi('concepts')}>{ai === 'concepts' ? 'Finding…' : 'Find with AI'}</Button>}>
                {sec.concepts.length === 0 ? (
                  <EmptyState title="No concepts yet" body="Add the ideas this section is about, or write notes in My notes and extract them." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sec.concepts.map((c) => (
                      editConcept?.id === c.id ? (
                        <Panel key={c.id} className="space-y-2 border-l-2 border-l-gold">
                          <input value={editConcept.term} onChange={(e) => setEditConcept({ ...editConcept, term: e.target.value })} aria-label="Concept" className={inputClass} autoFocus />
                          <textarea value={editConcept.explanation} onChange={(e) => setEditConcept({ ...editConcept, explanation: e.target.value })} rows={3} aria-label="Explanation" className={textarea} />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditConcept(null)}>Cancel</Button>
                            <Button size="sm" variant="primary" onClick={async () => { if (await patchSection({ concepts: sec.concepts.map(x => x.id === c.id ? editConcept : x) })) { setEditConcept(null); await load() } }}>Save</Button>
                          </div>
                        </Panel>
                      ) :
                      <Panel key={c.id} className="group relative space-y-1.5 border-l-2 border-l-gold/60">
                        <button type="button" onClick={() => setEditConcept(c)} className="block text-left" title="Edit concept">
                          <p className="font-display text-lg font-bold text-gold">{c.term}</p>
                          <p className="text-sm leading-relaxed text-parchment/75">{c.explanation || <span className="text-parchment/35">Add what it means</span>}</p>
                        </button>
                        <IconButton icon={Trash2} tone="danger" label={`Remove ${c.term}`} className="absolute right-2 top-2 can-hover:opacity-0 can-hover:group-hover:opacity-100"
                          onClick={async () => { if (await patchSection({ concepts: sec.concepts.filter((x) => x.id !== c.id) })) await load() }} />
                      </Panel>
                    ))}
                  </div>
                )}
                <form className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
                  onSubmit={async (e) => { e.preventDefault(); if (!concept.term.trim()) return; if (await patchSection({ concepts: [...sec.concepts, { term: concept.term, explanation: concept.explanation }] })) { setConcept({ term: '', explanation: '' }); await load() } }}>
                  <input value={concept.term} onChange={(e) => setConcept({ ...concept, term: e.target.value })} placeholder="Concept" aria-label="Concept" className={inputClass} />
                  <input value={concept.explanation} onChange={(e) => setConcept({ ...concept, explanation: e.target.value })} placeholder="What it means" aria-label="Explanation" className={inputClass} />
                  <Button type="submit" icon={Plus} disabled={!concept.term.trim()}>Add</Button>
                </form>
              </Section>
            )}

            {tab === 'guide' && (
              <Section title="Study guide" description="One tidy write-up of the whole section, built from your notes, concepts and files. Rewrite it any time." action={
                <div className="flex gap-2">
                  {editingNotes === null && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditingNotes(sec.notes || '')}>Edit</Button>}
                  <Button size="sm" icon={Sparkles} disabled={!!ai} onClick={() => runAi('notes')}>{ai === 'notes' ? 'Writing…' : sec.notes ? 'Rewrite with AI' : 'Write with AI'}</Button>
                </div>
              }>
                {editingNotes !== null ? (
                  <Panel className="space-y-3">
                    <textarea value={editingNotes} onChange={(e) => setEditingNotes(e.target.value)} rows={16} className={textarea} aria-label="Notes" />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditingNotes(null)}>Cancel</Button>
                      <Button variant="primary" onClick={async () => { if (await patchSection({ notes: editingNotes })) { setEditingNotes(null); await load() } }}>Save notes</Button>
                    </div>
                  </Panel>
                ) : sec.notes ? (
                  <Panel><NotesView text={sec.notes} /></Panel>
                ) : (
                  <EmptyState title="No study guide yet" body="Write a few notes first, then let the AI turn them into one clear guide. Or write it yourself."
                    action={<Button icon={NotebookPen} onClick={() => setEditingNotes('')}>Write it</Button>} />
                )}
              </Section>
            )}

            {tab === 'materials' && (
              <Section title="Files & links" action={
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} />
                  <Button size="sm" variant="ghost" icon={Link2} onClick={() => setMat({ kind: 'link', title: '', url: '', content: '' })}>Link</Button>
                  <Button size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>File</Button>
                </div>
              } description="Slides, past questions, readings and links. Text files can be read by the AI; written notes go in My notes.">
                {mat && (
                  <Panel className="mb-3 space-y-3 animate-fadeIn">
                    <input value={mat.title} onChange={(e) => setMat({ ...mat, title: e.target.value })} placeholder="Title" aria-label="Title" className={inputClass} autoFocus />
                    {mat.kind === 'link'
                      ? <input value={mat.url} onChange={(e) => setMat({ ...mat, url: e.target.value })} placeholder="https://" inputMode="url" aria-label="Link" className={inputClass} />
                      : null}
                    <textarea value={mat.content} onChange={(e) => setMat({ ...mat, content: e.target.value })} rows={mat.kind === 'note' ? 8 : 3}
                      placeholder={mat.kind === 'note' ? 'Paste or type the material…' : 'What is useful about it (optional)'} aria-label="Content" className={textarea} />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setMat(null)}>Cancel</Button>
                      <Button variant="primary" onClick={async () => { if (await api(`/api/learning/sections/${sec.id}`, 'POST', mat)) { setMat(null); await load() } }}>Add</Button>
                    </div>
                  </Panel>
                )}
                {sec.materials.every((m) => m.kind === 'note') && !mat ? (
                  <EmptyState title="No files or links yet" body="Add what you are learning from: slides, readings, past questions, videos." />
                ) : (
                  <ul className="divide-y divide-gold/10 overflow-hidden rounded-xl border border-gold/15 bg-surface-solid">
                    {sec.materials.filter((m) => m.kind !== 'note').map((m) => (
                      <li key={m.id} className="group flex items-start gap-3 px-4 py-3">
                        {m.kind === 'link' ? <Link2 className="mt-0.5 h-4 w-4 text-gold-dim" /> : m.kind === 'file' ? <Paperclip className="mt-0.5 h-4 w-4 text-gold-dim" /> : <FileText className="mt-0.5 h-4 w-4 text-gold-dim" />}
                        <div className="min-w-0 flex-1">
                          {m.kind === 'link' && m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="text-sm text-gold hover:underline">{m.title}</a>
                            : m.kind === 'file' ? <a href={`/api/learning/items/material/${m.id}`} target="_blank" rel="noreferrer" className="text-sm text-parchment hover:text-gold">{m.title}</a>
                              : <p className="text-sm text-parchment">{m.title}</p>}
                          {m.content && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-caption text-parchment/50">{m.content}</p>}
                          {m.kind === 'file' && <p className="font-mono text-[10px] text-parchment/35">{m.fileName} · {m.size ? `${Math.round(m.size / 1024)} KB` : ''}{m.content ? ' · readable by AI' : ''}</p>}
                        </div>
                        <IconButton icon={Trash2} tone="danger" label={`Delete ${m.title}`} onClick={async () => { if (await confirm(`Delete "${m.title}"?`) && await api(`/api/learning/items/material/${m.id}`, 'DELETE')) await load() }} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {tab === 'cards' && (
              <Section title={`Flashcards · ${sec.cards.length}`} action={
                <div className="flex gap-2">
                  <Button size="sm" icon={Sparkles} disabled={!!ai} onClick={() => runAi('flashcards')}>{ai === 'flashcards' ? 'Making cards…' : 'Make with AI'}</Button>
                  {sec.cards.length > 0 && <Button size="sm" variant="primary" icon={BookOpen} onClick={() => setStudy({ cards: sec.cards, title: sec.title })}>Study</Button>}
                </div>
              }>
                <form className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  onSubmit={async (e) => { e.preventDefault(); if (await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'card', ...cardDraft })) { setCardDraft({ front: '', back: '' }); await load() } }}>
                  <input value={cardDraft.front} onChange={(e) => setCardDraft({ ...cardDraft, front: e.target.value })} placeholder="Question" aria-label="Card front" className={inputClass} />
                  <input value={cardDraft.back} onChange={(e) => setCardDraft({ ...cardDraft, back: e.target.value })} placeholder="Answer" aria-label="Card back" className={inputClass} />
                  <Button type="submit" icon={Plus} disabled={!cardDraft.front.trim() || !cardDraft.back.trim()}>Add card</Button>
                </form>
                {sec.cards.length === 0 ? (
                  <EmptyState title="No flashcards yet" body="Add your own, extract them from My notes, or let the AI make a deck from the whole section." />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sec.cards.map((c) => {
                      const isDue = new Date(c.due).getTime() <= nowMs
                      return (
                        <Panel key={c.id} padded={false} className="group relative p-4">
                          <p className="pr-8 text-sm font-semibold text-parchment">{c.front}</p>
                          <p className="mt-1 text-sm text-parchment/60">{c.back}</p>
                          <p className="mt-2 font-mono text-[10px] text-parchment/35">
                            {c.reps === 0 ? 'New' : isDue ? 'Due now' : `Next in ${Math.max(1, Math.round((new Date(c.due).getTime() - nowMs) / 86400000))}d`}
                          </p>
                          <IconButton icon={Trash2} tone="danger" label="Delete card" className="absolute right-2 top-2 can-hover:opacity-0 can-hover:group-hover:opacity-100"
                            onClick={async () => { if (await api(`/api/learning/items/card/${c.id}`, 'DELETE')) await load() }} />
                        </Panel>
                      )
                    })}
                  </div>
                )}
              </Section>
            )}

            {sec.state !== 'done' && !locked && (
              <Panel className="flex flex-col gap-3 border-gold/30 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-parchment">Ready to move on?</p>
                  <p className="text-caption text-parchment/55">
                    {sec.mastery !== null ? `You have mastered ${sec.mastery}% of this section's cards. ` : ''}{track.inOrder ? 'Finishing unlocks the next section.' : 'Mark it finished when you know it well.'}
                  </p>
                  {sec.mastery !== null && <Meter value={sec.mastery} tone="moss" className="mt-2 max-w-xs" />}
                </div>
                <Button variant="primary" icon={Check} onClick={() => complete(true)}>Mark finished</Button>
              </Panel>
            )}
          </section>
        ) : (
          <EmptyState title="Add your first section" body={track.inOrder ? 'Break what you are learning into sections. Each one unlocks after the one before it.' : 'Add a section for each subject, e.g. Financial Engineering, then keep your notes inside it.'} />
        )}
      </div>

      {study && (
        <StudyDeck cards={study.cards} title={study.title}
          onClose={(n) => { setStudy(null); if (n) showToast(`Reviewed ${n} card${n === 1 ? '' : 's'}`, 'success'); void load() }} />
      )}
    </Page>
  )
}
