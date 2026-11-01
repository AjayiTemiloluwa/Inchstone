'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown, ArrowLeft, ArrowUp, Archive, BookOpen, Check, FileText, Layers, Link2, Lock, NotebookPen, Paperclip,
  Pencil, Plus, RotateCcw, Sparkles, Trash2, Upload, Wand2, X, Zap,
} from 'lucide-react'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import { Badge, Button, EmptyState, IconButton, Meter, Page, Panel, RowActions, Segmented, cx, inputClass } from '@/components/ds'
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

/**
 * One idea per screen: a track holds sections (subjects), a section holds your
 * notes, and the notes become concepts and flashcards. Three tabs, no more.
 */
type Tab = 'notes' | 'concepts' | 'cards'

const textarea = 'w-full rounded-lg border border-gold/20 bg-ink/40 px-3 py-2.5 text-sm leading-relaxed text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20'
const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Render notes: "Heading:" lines become headings, "- " lines bullets. */
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
  const [importing, setImporting] = useState<{ text: string; picking: boolean } | null>(null)
  const [pickNotes, setPickNotes] = useState(false)
  const [quick, setQuick] = useState({ title: '', text: '' })
  const [editNote, setEditNote] = useState<{ id: string; title: string; text: string } | null>(null)
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [attach, setAttach] = useState<{ title: string; url: string } | null>(null)
  const [editConcept, setEditConcept] = useState<Concept | null>(null)
  const [concept, setConcept] = useState({ term: '', explanation: '' })
  const [cardDraft, setCardDraft] = useState({ front: '', back: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  /** When the track was last loaded: due dates are compared against it. */
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Arriving from "Import my notes": open the import panel straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('start') !== 'notes') return
    const t = setTimeout(() => setImporting({ text: '', picking: true }), 0)
    return () => clearTimeout(t)
  }, [])

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
  const pick = (sid: string) => { setSelected(sid); setEditNote(null); setEditConcept(null); setGuideOpen(false) }

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!track || !newSection.trim()) return
    const data = await api(`/api/learning/${track.id}`, 'POST', { title: newSection })
    if (!data) return
    setNewSection('')
    await load()
    setSelected(data.section.id)
    setTab('notes')
  }

  /** Concepts and flashcards from one note, or from every note not yet extracted. */
  const extract = async (materialId?: string) => {
    if (!sec) return
    setAi(materialId ? `x:${materialId}` : 'extract')
    const data = await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'ai', task: 'extract', materialId })
    setAi(null)
    if (!data) return
    showToast(`Added ${plural(data.concepts, 'concept')} and ${plural(data.cards, 'flashcard')}`, 'success')
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

  const runAi = async (task: 'notes' | 'flashcards') => {
    if (!sec) return
    setAi(task)
    const data = await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'ai', task })
    setAi(null)
    if (!data) return
    showToast(task === 'notes' ? 'Study guide written' : `${plural(data.added, 'flashcard')} made`, 'success')
    if (task === 'notes') { setTab('notes'); setGuideOpen(true) }
    await load()
  }

  const complete = async (done: boolean) => {
    const data = await patchSection({ complete: done })
    if (!data) return
    if (done) {
      if (data.trackDone) {
        showToast(`Track finished: ${track?.title}! 🏆`, 'success')
        import('@/components/ui/Confetti').then((m) => m.fireConfetti()).catch(() => {})
      } else showToast(data.unlocked && track?.inOrder ? `Section done. Unlocked: ${data.unlocked}` : 'Section marked finished', 'success')
      navigator.vibrate?.(30)
    }
    await load()
  }

  const upload = async (file: File) => {
    if (!sec) return
    if (file.size > 4 * 1024 * 1024) { showToast('Files must be 4 MB or smaller', 'error'); return }
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/learning/sections/${sec.id}`, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(data.error || 'Upload failed', 'error'); return }
    showToast(data.material?.readable ? 'File attached. The AI can read it.' : 'File attached', 'success')
    await load()
  }

  const runImport = async () => {
    if (!track || !importing) return
    setAi('import')
    const data = await api(`/api/learning/${track.id}`, 'POST', { kind: 'organize', text: importing.text })
    setAi(null)
    if (data) { showToast(`Made ${plural(data.added, 'section')} from your notes`, 'success'); setImporting(null); await load() }
  }

  if (missing) return <Page><EmptyState title="Track not found" action={<Button href="/challenge/learning" icon={ArrowLeft}>Back to the lab</Button>} /></Page>
  if (!track) return <Loader routeKey="challenge" />

  const locked = sec?.state === 'locked'
  const notes = (sec?.materials ?? []).filter((m) => m.kind === 'note').reverse()
  const attachments = (sec?.materials ?? []).filter((m) => m.kind !== 'note')
  const fresh = notes.filter((m) => !m.extractedAt && m.content).length
  const totalNotes = track.sections.reduce((n, s) => n + s.materials.filter((m) => m.kind === 'note').length, 0)
  const totalCards = track.sections.reduce((n, s) => n + s.cards.length, 0)

  const tabs: { value: Tab; label: string }[] = sec ? [
    { value: 'notes', label: `Notes · ${notes.length}` },
    { value: 'concepts', label: `Concepts · ${sec.concepts.length}` },
    { value: 'cards', label: `Flashcards · ${sec.cards.length}` },
  ] : []

  return (
    <Page width="wide">
      <ChallengeTabs />

      {/* Track header: back, name, one line of facts, the actions */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link href="/challenge/learning" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-parchment/55 hover:text-parchment">
            <ArrowLeft className="h-4 w-4" /> Learning Lab
          </Link>
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-parchment sm:text-4xl">
            {track.emoji && <span aria-hidden>{track.emoji}</span>}
            <span className="min-w-0 truncate">{track.title}</span>
            {track.completedAt && <Badge tone="moss">Finished</Badge>}
          </h1>
          <p className="text-sm text-parchment/55">
            {plural(track.sections.length, 'section')} · {plural(totalNotes, 'note')} · {plural(totalCards, 'flashcard')}
            {track.inOrder && track.sections.length > 0 && <> · {track.progress.done} of {track.progress.total} finished</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dueAll.length > 0 && (
            <Button variant="primary" icon={Zap} onClick={() => setStudy({ cards: dueAll, title: `${track.title}: due cards` })}>Review {dueAll.length} due</Button>
          )}
          <RowActions label="Track options" className="[&>button]:opacity-100" actions={[
            { label: 'Import notes into sections', icon: Wand2, onSelect: () => setImporting({ text: '', picking: false }) },
            track.inOrder
              ? { label: 'Open every section', icon: Layers, onSelect: async () => { if (await api(`/api/learning/${track.id}`, 'PATCH', { inOrder: false })) { showToast('Every section is open now', 'success'); await load() } } }
              : { label: 'Unlock sections in order', icon: Lock, onSelect: async () => { if (await api(`/api/learning/${track.id}`, 'PATCH', { inOrder: true })) { showToast('Sections now unlock one after another', 'success'); await load() } } },
            { label: 'Archive track', icon: Archive, onSelect: async () => { if (await api(`/api/learning/${track.id}`, 'PATCH', { archived: true })) router.push('/challenge/learning') } },
            { label: 'Delete track', icon: Trash2, destructive: true, onSelect: async () => {
              if (await confirm(`Delete "${track.title}" with every section, note and card?`) && await api(`/api/learning/${track.id}`, 'DELETE')) router.push('/challenge/learning')
            } },
          ]} />
        </div>
      </header>

      {/* Import notes: AI splits pasted notes into sections */}
      {importing && (
        <Panel className="space-y-3 border-gold/30 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-parchment">Import notes into sections</p>
              <p className="text-caption text-parchment/55">Paste a syllabus, class notes or a chapter. The AI splits it into sections using only your text, and files each part as a note.</p>
            </div>
            <IconButton icon={X} label="Close" onClick={() => setImporting(null)} />
          </div>
          <textarea value={importing.text} onChange={(e) => setImporting({ ...importing, text: e.target.value })} rows={8} placeholder="Paste your notes here…" aria-label="Notes to import" className={textarea} />
          {importing.picking && (
            <NotesPicker cta="Use" onClose={() => setImporting({ ...importing, picking: false })}
              onPick={(ns) => setImporting({ picking: false, text: [importing.text, ...ns.map((n) => `# ${n.title}\n${n.text}`)].filter(Boolean).join('\n\n').slice(0, 24000) })} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={importFileRef} type="file" accept=".txt,.md,.markdown,.csv,.json,.html,text/*" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const t = await f.text(); setImporting((o) => o && { ...o, text: (o.text ? o.text + '\n\n' : '') + t.slice(0, 24000) }) } }} />
            <Button size="sm" variant="ghost" icon={NotebookPen} onClick={() => setImporting({ ...importing, picking: true })}>From Notes page</Button>
            <Button size="sm" variant="ghost" icon={Upload} onClick={() => importFileRef.current?.click()}>Text file</Button>
            <span className="font-mono text-[10px] text-parchment/40">{importing.text.length.toLocaleString()} / 24,000</span>
            <Button className="ml-auto" variant="primary" icon={Sparkles} disabled={ai === 'import' || importing.text.trim().length < 40} onClick={runImport}>
              {ai === 'import' ? 'Making sections… (about 30s)' : 'Make sections'}
            </Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Sections list */}
        <nav aria-label="Sections" className="space-y-2 lg:sticky lg:top-20 lg:self-start">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">Sections</p>
          {track.sections.length > 0 && (
            <ul className="space-y-0.5">
              {track.sections.map((s) => {
                const n = s.materials.filter((m) => m.kind === 'note').length
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => pick(s.id)} aria-current={s.id === selected ? 'page' : undefined}
                      className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                        s.id === selected ? 'bg-gold/[0.12] text-parchment' : 'text-parchment/75 hover:bg-gold/[0.05]')}>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block truncate text-sm font-semibold', s.state === 'locked' && 'text-parchment/45')}>{s.title}</span>
                        <span className="block font-mono text-[10px] text-parchment/40">{plural(n, 'note')} · {plural(s.cards.length, 'card')}</span>
                      </span>
                      {s.state === 'done' ? <Check className="h-4 w-4 shrink-0 text-moss" aria-label="Finished" />
                        : s.state === 'locked' ? <Lock className="h-3.5 w-3.5 shrink-0 text-parchment/30" aria-label="Locked" />
                          : s.due > 0 ? <span className="shrink-0 rounded-full bg-ember/15 px-1.5 font-mono text-[10px] text-ember">{s.due}</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <form onSubmit={addSection} className="flex gap-1.5">
            <input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Add a section…" aria-label="New section name" className={cx(inputClass, 'h-10')} />
            <Button type="submit" icon={Plus} disabled={!newSection.trim()} aria-label="Add section"><span className="sr-only">Add</span></Button>
          </form>
        </nav>

        {/* Selected section */}
        {sec ? (
          <section className="min-w-0 space-y-4" aria-label={sec.title}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold text-parchment sm:text-3xl">{sec.title}</h2>
                {sec.summary && <p className="mt-1 text-sm text-parchment/60">{sec.summary}</p>}
                {locked && <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-parchment/55"><Lock className="h-3.5 w-3.5" /> Opens when you finish the section before it. You can still add notes.</p>}
              </div>
              <div className="flex items-center gap-2">
                {sec.cards.length > 0 && <Button icon={BookOpen} onClick={() => setStudy({ cards: sec.cards, title: sec.title })}>Study</Button>}
                <RowActions label="Section options" className="[&>button]:opacity-100" actions={[
                  sec.state === 'done'
                    ? { label: 'Mark not finished', icon: RotateCcw, onSelect: () => complete(false) }
                    : { label: 'Mark finished', icon: Check, onSelect: () => { if (!locked) void complete(true); else showToast('Finish the section before it first', 'error') } },
                  { label: sec.notes ? 'Rewrite study guide with AI' : 'Write a study guide with AI', icon: Sparkles, onSelect: () => runAi('notes') },
                  { label: 'Rename', icon: Pencil, onSelect: async () => { const t = window.prompt('Section name', sec.title); if (t && t.trim() && await patchSection({ title: t })) await load() } },
                  { label: 'Edit description', icon: NotebookPen, onSelect: async () => { const t = window.prompt('What this section covers', sec.summary ?? ''); if (t !== null && await patchSection({ summary: t })) await load() } },
                  ...(sec.order > 0 ? [{ label: 'Move up', icon: ArrowUp, onSelect: async () => { if (await patchSection({ move: 'up' })) await load() } }] : []),
                  ...(sec.order < track.sections.length - 1 ? [{ label: 'Move down', icon: ArrowDown, onSelect: async () => { if (await patchSection({ move: 'down' })) await load() } }] : []),
                  { label: 'Delete section', icon: Trash2, destructive: true, onSelect: async () => { if (await confirm(`Delete "${sec.title}" with its notes and cards?`) && await api(`/api/learning/sections/${sec.id}`, 'DELETE')) await load() } },
                ]} />
              </div>
            </div>

            <Segmented options={tabs} value={tab} onChange={setTab} ariaLabel="Section views" />

            {/* ── Notes ── */}
            {tab === 'notes' && (
              <div className="space-y-3">
                <Panel className="space-y-2">
                  <input value={quick.title} onChange={(e) => setQuick({ ...quick, title: e.target.value })} placeholder="Topic (optional)" aria-label="Note topic"
                    className="w-full bg-transparent text-sm font-semibold text-parchment placeholder:text-parchment/35 focus:outline-none" />
                  <textarea value={quick.text} onChange={(e) => setQuick({ ...quick, text: e.target.value })} rows={4}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void saveQuick(false) } }}
                    placeholder={`Write a note on ${sec.title}…`} aria-label="Note" className={textarea} />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={() => setPickNotes((v) => !v)} className="mr-auto inline-flex min-h-9 items-center gap-1.5 text-xs text-parchment/50 hover:text-gold">
                      <NotebookPen className="h-3.5 w-3.5" /> Bring in from Notes page
                    </button>
                    <Button variant="ghost" disabled={!quick.text.trim() || !!ai} onClick={() => saveQuick(false)}>Save</Button>
                    <Button variant="primary" icon={Sparkles} disabled={!quick.text.trim() || !!ai} onClick={() => saveQuick(true)}
                      title="Save, then pull concepts and flashcards out of this note">
                      Save and make cards
                    </Button>
                  </div>
                </Panel>

                {pickNotes && (
                  <NotesPicker onClose={() => setPickNotes(false)} onPick={async (ns) => {
                    for (const n of ns) await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'note', title: n.title, content: n.text })
                    setPickNotes(false)
                    showToast(`Added ${plural(ns.length, 'note')}`, 'success')
                    await load()
                  }} />
                )}

                {fresh > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/20 bg-gold/[0.05] px-4 py-2.5">
                    <p className="text-sm text-parchment/75">{fresh} notes have not been turned into cards yet.</p>
                    <Button size="sm" icon={Sparkles} disabled={!!ai} onClick={() => extract()}>{ai === 'extract' ? 'Working…' : 'Make cards from all'}</Button>
                  </div>
                )}

                {sec.notes && (
                  <Panel className="space-y-2 border-gold/30">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-gold" aria-hidden />
                      <p className="flex-1 text-sm font-semibold text-parchment">Study guide</p>
                      <Button size="sm" variant="ghost" onClick={() => setGuideOpen((v) => !v)}>{guideOpen ? 'Hide' : 'Read'}</Button>
                    </div>
                    {guideOpen ? <NotesView text={sec.notes} /> : <p className="line-clamp-2 text-sm text-parchment/60">{sec.notes}</p>}
                  </Panel>
                )}

                {notes.length === 0 && !sec.notes ? (
                  <p className="py-6 text-center text-sm text-parchment/45">No notes yet. Write your first one above.</p>
                ) : (
                  <ul className="space-y-2">
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
                                  <p className="font-mono text-[10px] text-parchment/40">{shortDate(m.createdAt)}{m.extractedAt ? ' · cards made' : ''}</p>
                                </div>
                                {!m.extractedAt && m.content && (
                                  <Button size="sm" variant="ghost" icon={Sparkles} disabled={!!ai} onClick={() => extract(m.id)}>
                                    {ai === `x:${m.id}` ? 'Working…' : 'Make cards'}
                                  </Button>
                                )}
                                <RowActions label={`Options for ${m.title}`} actions={[
                                  { label: 'Edit', icon: Pencil, onSelect: () => setEditNote({ id: m.id, title: m.title, text: m.content ?? '' }) },
                                  ...(m.extractedAt && m.content ? [{ label: 'Make cards again', icon: Sparkles, onSelect: () => extract(m.id) }] : []),
                                  { label: 'Delete', icon: Trash2, destructive: true, onSelect: async () => { if (await confirm(`Delete the note "${m.title}"?`) && await api(`/api/learning/items/material/${m.id}`, 'DELETE')) await load() } },
                                ]} />
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

                {/* Attachments: files and links that go with this section */}
                <div className="space-y-2 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mr-auto font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">Files and links</p>
                    <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} />
                    <Button size="sm" variant="ghost" icon={Upload} onClick={() => fileRef.current?.click()}>Attach file</Button>
                    <Button size="sm" variant="ghost" icon={Link2} onClick={() => setAttach({ title: '', url: '' })}>Add link</Button>
                  </div>
                  {attach && (
                    <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]" onSubmit={async (e) => {
                      e.preventDefault()
                      if (await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'link', title: attach.title, url: attach.url })) { setAttach(null); await load() }
                    }}>
                      <input value={attach.url} onChange={(e) => setAttach({ ...attach, url: e.target.value })} placeholder="https://" inputMode="url" aria-label="Link" className={inputClass} autoFocus />
                      <input value={attach.title} onChange={(e) => setAttach({ ...attach, title: e.target.value })} placeholder="Name (optional)" aria-label="Link name" className={inputClass} />
                      <Button type="submit" variant="primary" disabled={!attach.url.trim()}>Add</Button>
                      <Button variant="ghost" onClick={() => setAttach(null)}>Cancel</Button>
                    </form>
                  )}
                  {attachments.length > 0 && (
                    <ul className="divide-y divide-gold/10 overflow-hidden rounded-xl border border-gold/15">
                      {attachments.map((m) => (
                        <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                          {m.kind === 'link' ? <Link2 className="h-4 w-4 shrink-0 text-gold-dim" /> : m.kind === 'file' ? <Paperclip className="h-4 w-4 shrink-0 text-gold-dim" /> : <FileText className="h-4 w-4 shrink-0 text-gold-dim" />}
                          <a href={m.kind === 'link' ? m.url ?? '#' : `/api/learning/items/material/${m.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-parchment hover:text-gold">{m.title}</a>
                          {m.kind === 'file' && m.size ? <span className="font-mono text-[10px] text-parchment/35">{Math.round(m.size / 1024)} KB</span> : null}
                          <IconButton icon={Trash2} tone="danger" label={`Remove ${m.title}`} onClick={async () => { if (await confirm(`Remove "${m.title}"?`) && await api(`/api/learning/items/material/${m.id}`, 'DELETE')) await load() }} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* ── Concepts ── */}
            {tab === 'concepts' && (
              <div className="space-y-3">
                <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
                  onSubmit={async (e) => { e.preventDefault(); if (!concept.term.trim()) return; if (await patchSection({ concepts: [...sec.concepts, { term: concept.term, explanation: concept.explanation }] })) { setConcept({ term: '', explanation: '' }); await load() } }}>
                  <input value={concept.term} onChange={(e) => setConcept({ ...concept, term: e.target.value })} placeholder="Concept" aria-label="Concept" className={inputClass} />
                  <input value={concept.explanation} onChange={(e) => setConcept({ ...concept, explanation: e.target.value })} placeholder="What it means" aria-label="Meaning" className={inputClass} />
                  <Button type="submit" icon={Plus} disabled={!concept.term.trim()}>Add</Button>
                </form>
                {sec.concepts.length === 0 ? (
                  <EmptyState title="No concepts yet" body="Add one above, or write notes and press Make cards: the key ideas land here." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sec.concepts.map((c) => editConcept?.id === c.id ? (
                      <Panel key={c.id} className="space-y-2">
                        <input value={editConcept.term} onChange={(e) => setEditConcept({ ...editConcept, term: e.target.value })} aria-label="Concept" className={inputClass} autoFocus />
                        <textarea value={editConcept.explanation} onChange={(e) => setEditConcept({ ...editConcept, explanation: e.target.value })} rows={3} aria-label="Meaning" className={textarea} />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditConcept(null)}>Cancel</Button>
                          <Button size="sm" variant="primary" onClick={async () => { if (await patchSection({ concepts: sec.concepts.map((x) => x.id === c.id ? editConcept : x) })) { setEditConcept(null); await load() } }}>Save</Button>
                        </div>
                      </Panel>
                    ) : (
                      <Panel key={c.id} className="group relative space-y-1">
                        <button type="button" onClick={() => setEditConcept(c)} className="block w-full pr-8 text-left" title="Edit">
                          <p className="font-display text-lg font-bold text-gold">{c.term}</p>
                          <p className="text-sm leading-relaxed text-parchment/75">{c.explanation || <span className="text-parchment/35">Add what it means</span>}</p>
                        </button>
                        <IconButton icon={Trash2} tone="danger" label={`Remove ${c.term}`} className="absolute right-2 top-2 can-hover:opacity-0 can-hover:group-hover:opacity-100"
                          onClick={async () => { if (await patchSection({ concepts: sec.concepts.filter((x) => x.id !== c.id) })) await load() }} />
                      </Panel>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Flashcards ── */}
            {tab === 'cards' && (
              <div className="space-y-3">
                <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  onSubmit={async (e) => { e.preventDefault(); if (await api(`/api/learning/sections/${sec.id}`, 'POST', { kind: 'card', ...cardDraft })) { setCardDraft({ front: '', back: '' }); await load() } }}>
                  <input value={cardDraft.front} onChange={(e) => setCardDraft({ ...cardDraft, front: e.target.value })} placeholder="Question" aria-label="Question" className={inputClass} />
                  <input value={cardDraft.back} onChange={(e) => setCardDraft({ ...cardDraft, back: e.target.value })} placeholder="Answer" aria-label="Answer" className={inputClass} />
                  <Button type="submit" icon={Plus} disabled={!cardDraft.front.trim() || !cardDraft.back.trim()}>Add</Button>
                </form>
                <div className="flex flex-wrap items-center gap-2">
                  {sec.mastery !== null && (
                    <div className="mr-auto flex items-center gap-2 text-xs text-parchment/55">
                      <Meter value={sec.mastery} tone="moss" className="w-24" /> {sec.mastery}% learned
                    </div>
                  )}
                  <Button size="sm" variant="ghost" icon={Sparkles} disabled={!!ai} onClick={() => runAi('flashcards')} className="ml-auto">
                    {ai === 'flashcards' ? 'Making cards…' : 'More cards with AI'}
                  </Button>
                </div>
                {sec.cards.length === 0 ? (
                  <EmptyState title="No flashcards yet" body="Add one above, or write notes and press Make cards." />
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
              </div>
            )}
          </section>
        ) : (
          <Panel className="space-y-3 py-10 text-center">
            <p className="font-display text-2xl font-bold text-parchment">Add your first section</p>
            <p className="mx-auto max-w-md text-sm text-parchment/60">A section is one subject or topic, like Financial Engineering. Type its name on the left, then write notes inside it. Or import notes you already have and the AI will make the sections.</p>
            <div className="flex justify-center"><Button icon={Wand2} onClick={() => setImporting({ text: '', picking: false })}>Import notes</Button></div>
          </Panel>
        )}
      </div>

      {study && (
        <StudyDeck cards={study.cards} title={study.title}
          onClose={(n) => { setStudy(null); if (n) showToast(`Reviewed ${plural(n, 'card')}`, 'success'); void load() }} />
      )}
    </Page>
  )
}
