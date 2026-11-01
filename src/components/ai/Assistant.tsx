'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Check, Eraser, Sparkles, X } from 'lucide-react'
import { cx } from '@/components/ds'
import { OPEN_ASSISTANT } from '@/lib/uiEvents'

/**
 * The Inchstone assistant: a floating chat on every page, running on free
 * OpenRouter models (the server rotates keys and models when one is down).
 * On the Application Tracker it knows the application you are looking at and
 * can add, update and check things off for you. When it changes data it fires
 * `inchstone:data-changed` so the page reloads what it shows.
 */

interface Msg {
  role: 'user' | 'assistant'
  content: string
  actions?: string[]
  error?: boolean
}

export const DATA_CHANGED = 'inchstone:data-changed'

function contextFor(pathname: string) {
  const m = pathname.match(/^\/challenge\/applications\/([^/]+)/)
  if (m) return { context: 'applications' as const, applicationId: m[1], key: `app:${m[1]}` }
  if (pathname.startsWith('/challenge/applications')) return { context: 'applications' as const, key: 'apps' }
  return { context: 'general' as const, key: 'general' }
}

const SUGGESTIONS: Record<string, string[]> = {
  detail: [
    'Do I qualify? Go through the requirements with me',
    'Make a step-by-step plan to submit before the deadline',
    'Draft an outline for the personal statement',
    'What documents am I still missing?',
  ],
  list: [
    'I will paste an advert: add it to my tracker',
    'What is due in the next two weeks?',
    'Which application should I focus on first?',
  ],
  general: [
    'How did I do this week?',
    'What applications are due soon?',
    'Give me my report for this month',
    'How much did I spend this month, by category?',
    'Find my notes about scholarships',
  ],
}

/** Minimal formatting: **bold**, line breaks and in-app links [label](/path). External links are shown as text. */
function Rich({ text, onNavigate }: { text: string; onNavigate: (href: string) => void }) {
  const parts: ReactNode[] = []
  text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)\s]*\))/g).forEach((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) parts.push(<strong key={i} className="font-semibold text-parchment">{p.slice(2, -2)}</strong>)
    else {
      const m = p.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/)
      if (m) parts.push(
        <button key={i} type="button" onClick={() => onNavigate(m[2])} className="font-medium text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold">
          {m[1]}
        </button>,
      )
      else parts.push(p)
    }
  })
  return <p className="whitespace-pre-wrap break-words">{parts}</p>
}

const store = {
  read(key: string): Msg[] {
    try { return JSON.parse(sessionStorage.getItem(`inchstone-ai:${key}`) || '[]') } catch { return [] }
  },
  write(key: string, msgs: Msg[]) {
    try { sessionStorage.setItem(`inchstone-ai:${key}`, JSON.stringify(msgs.slice(-30))) } catch { /* private mode */ }
  },
}

export function Assistant() {
  const pathname = usePathname()
  const router = useRouter()
  const ctx = useMemo(() => contextFor(pathname), [pathname])
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<Record<string, Msg[]>>({})
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const msgs = threads[ctx.key] ?? []

  // Load this page's thread from the session the first time it is shown.
  useEffect(() => {
    if (threads[ctx.key]) return
    const t = setTimeout(() => setThreads((s) => (s[ctx.key] ? s : { ...s, [ctx.key]: store.read(ctx.key) })), 0)
    return () => clearTimeout(t)
  }, [ctx.key, threads])

  // Open from the nav buttons (sidebar, phone dock, More sheet).
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_ASSISTANT, onOpen)
    return () => window.removeEventListener(OPEN_ASSISTANT, onOpen)
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs.length, busy, open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open])

  const setMsgs = (key: string, next: Msg[]) => {
    setThreads((s) => ({ ...s, [key]: next }))
    store.write(key, next)
  }

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    const key = ctx.key
    const history: Msg[] = [...msgs, { role: 'user', content }]
    setMsgs(key, history)
    setDraft('')
    setBusy(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: ctx.context,
          applicationId: 'applicationId' in ctx ? ctx.applicationId : undefined,
          tz: new Date().getTimezoneOffset(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsgs(key, [...history, { role: 'assistant', content: data.error || 'Something went wrong. Try again.', error: true }])
        return
      }
      setMsgs(key, [...history, { role: 'assistant', content: data.reply, actions: data.actions }])
      if (data.changed) window.dispatchEvent(new Event(DATA_CHANGED))
    } catch {
      setMsgs(key, [...history, { role: 'assistant', content: 'You seem to be offline. The assistant needs a connection.', error: true }])
    } finally {
      setBusy(false)
    }
  }

  const suggestions = ctx.context === 'applications' ? ('applicationId' in ctx ? SUGGESTIONS.detail : SUGGESTIONS.list) : SUGGESTIONS.general
  const title = ctx.context === 'applications' ? 'Application assistant' : 'Inchstone assistant'

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Open the ${title.toLowerCase()}`}
            data-cursor="Ask the assistant"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            className="fixed bottom-6 right-6 z-[58] hidden h-14 w-14 items-center justify-center rounded-2xl border border-gold/40 bg-gold text-ink shadow-[0_12px_36px_rgb(var(--gold-rgb)/0.35)] lg:flex"
          >
            <Sparkles className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label={title}
            data-lenis-prevent
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-[66] flex h-[min(86dvh,680px)] flex-col overflow-hidden rounded-t-3xl border border-gold/20 bg-surface-solid shadow-[0_-18px_60px_rgba(0,0,0,0.5)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(80dvh,640px)] sm:w-[420px] sm:rounded-3xl"
          >
            <header className="flex items-center gap-3 border-b border-gold/10 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-parchment">{title}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/40">Free models · switches if one is down</p>
              </div>
              {msgs.length > 0 && (
                <button type="button" onClick={() => setMsgs(ctx.key, [])} aria-label="Clear this conversation" title="Clear"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-parchment/45 hover:bg-gold/[0.06] hover:text-parchment">
                  <Eraser className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close the assistant"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-parchment/45 hover:bg-gold/[0.06] hover:text-parchment">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="space-y-4 py-2">
                  <p className="text-sm leading-relaxed text-parchment/70">
                    {ctx.context === 'applications'
                      ? 'Ask about an opportunity, paste an advert to add it, check your eligibility, plan your steps or draft an essay. I can update the tracker for you.'
                      : 'Ask me anything. I can also look after your Application Tracker and your notes.'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {suggestions.map((q) => (
                      <button key={q} type="button" onClick={() => send(q)}
                        className="rounded-xl border border-gold/15 px-3 py-2.5 text-left text-sm text-parchment/75 transition-colors hover:border-gold/40 hover:bg-gold/[0.05] hover:text-parchment">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((m, i) => (
                <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cx(
                      'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'rounded-br-md bg-gold text-ink'
                        : m.error
                          ? 'rounded-bl-md border border-ember/30 bg-ember/[0.07] text-ember'
                          : 'rounded-bl-md border border-gold/10 bg-ink/40 text-parchment/85',
                    )}
                  >
                    <Rich text={m.content} onNavigate={(href) => { router.push(href); if (window.innerWidth < 640) setOpen(false) }} />
                    {m.actions && m.actions.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-gold/10 pt-2">
                        {m.actions.map((a, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-moss">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" /> {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start" aria-live="polite">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-gold/10 bg-ink/40 px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-gold"
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
                    ))}
                    <span className="sr-only">Thinking</span>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(draft) }}
              className="flex items-end gap-2 border-t border-gold/10 p-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) } }}
                rows={1}
                placeholder={ctx.context === 'applications' ? 'Ask, or paste an advert…' : 'Ask anything…'}
                aria-label="Message"
                className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-gold/20 bg-ink/40 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20 [field-sizing:content]"
              />
              <button type="submit" disabled={!draft.trim() || busy} aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold text-ink transition-opacity disabled:opacity-30">
                <ArrowUp className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
