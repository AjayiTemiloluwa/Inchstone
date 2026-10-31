'use client'

import { useState, useEffect, useRef, type ElementType } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  Plus,
  X,
  Mail,
  Loader2,
  Link as LinkIcon,
  Trash2,
  MessageSquare,
  Send,
  ArrowLeft,
  Bell,
  ListChecks,
  Sprout,
  Target,
  CalendarDays,
  Copy,
} from 'lucide-react'
import { format } from 'date-fns'
import { Scramble } from '@/components/ui/motion'
import { Loader } from '@/components/ui/Loader'
import { useToast } from '@/components/ui/ToastProvider'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Page,
  PageHeader,
  Panel,
  RowActions,
  Section,
  cx,
  inputClass,
  type RowAction,
} from '@/components/ds'

interface Partner {
  id: string
  name: string
  email: string
  role: string
  status: string
  shareProgress: boolean
  shareWhat?: string | null
  inviteCode?: string | null
  connectionUserId?: string | null
  partnerLinks: unknown[]
}

/** What an owner can choose to share with a partner. */
export const SHARE_SCOPE_OPTIONS: { key: string; label: string; hint: string; icon: ElementType }[] = [
  { key: 'deeds', label: 'Deeds', hint: "Today's to-dos done/total", icon: ListChecks },
  { key: 'habits', label: 'Habits', hint: "Today's habit completions", icon: Sprout },
  { key: 'frog', label: 'Frog', hint: 'Hardest task done?', icon: Target },
  { key: 'week', label: 'Week', hint: "This week's completion", icon: CalendarDays },
]

/** Initial-letter avatar: the one people mark used across the partners screen. */
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full border border-moss/30 bg-moss/10 font-display text-moss',
        size === 'sm' ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg',
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/** Display figure for the shared-progress percentage. */
function Figure({ children }: { children: React.ReactNode }) {
  return <span className="font-display text-2xl leading-none tabular-nums text-gold">{children}</span>
}

function shareScopesOf(partner: Partner): string[] {
  return (partner.shareWhat || 'deeds').split(',').filter(Boolean)
}

/** Post-add feedback: was the invite emailed, and the link if it wasn't. */
interface InviteNotice {
  name: string
  linked: boolean
  emailSent: boolean
  emailReason?: string | null
  emailDetail?: string | null
  acceptUrl: string | null
}

interface SharedSummary {
  sharedWithMe: Array<{
    id: string
    name: string
    email: string
    scopes: string[]
    tasksTotal?: number
    tasksDone?: number
    habitsDone?: number
    habitsTotal?: number
    frogDone?: boolean | null
    weekTotal?: number
    weekDone?: number
  }>
  iShareWith: Array<{ name: string; email: string; shareWhat?: string | null }>
}

interface Message {
  id: string
  message: string
  senderId: string
  receiverId: string
  partnerId: string
  read: boolean
  createdAt: string
  partner: { name: string }
}

export default function PartnersPage() {
  const { user } = useUser()
  const { showToast, confirm } = useToast()
  const myId = user?.id || null
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [incomingNudges, setIncomingNudges] = useState<Message[]>([])
  const [shared, setShared] = useState<SharedSummary | null>(null)
  const [inviteNotice, setInviteNotice] = useState<InviteNotice | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showNudges, setShowNudges] = useState(false)

  const copyInviteLink = async (code: string, id: string) => {
    const url = `${window.location.origin}/partners/accept?code=${code}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API can be blocked — fall back to a manual-copy prompt.
      window.prompt('Copy this invite link:', url)
    }
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2200)
  }

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/partners')
      const data = await res.json()
      if (data.partners) {
        setPartners(data.partners)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchShared = async () => {
    try {
      const res = await fetch('/api/partners/shared')
      const data = await res.json()
      if (data.success) setShared({ sharedWithMe: data.sharedWithMe || [], iShareWith: data.iShareWith || [] })
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleShare = async (partner: Partner) => {
    const next = !partner.shareProgress
    const scopes = next ? shareScopesOf(partner) : []
    if (next && scopes.length === 0) scopes.push('deeds')
    setPartners(prev => prev.map(p => (p.id === partner.id ? { ...p, shareProgress: next, shareWhat: scopes.join(',') } : p)))
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareProgress: next }),
      })
      if (!res.ok) throw new Error()
      fetchShared()
    } catch {
      setPartners(prev => prev.map(p => (p.id === partner.id ? { ...p, shareProgress: !next, shareWhat: partner.shareWhat } : p)))
    }
  }

  const handleToggleScope = async (partner: Partner, key: string) => {
    const current = shareScopesOf(partner)
    const scopes = current.includes(key) ? current.filter(k => k !== key) : [...current, key]
    const on = scopes.length > 0
    setPartners(prev => prev.map(p => (p.id === partner.id ? { ...p, shareProgress: on, shareWhat: scopes.join(',') } : p)))
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareWhat: scopes }),
      })
      if (!res.ok) throw new Error()
      fetchShared()
    } catch {
      setPartners(prev => prev.map(p => (p.id === partner.id ? { ...p, shareProgress: partner.shareProgress, shareWhat: partner.shareWhat } : p)))
    }
  }

  const fetchIncomingNudges = async () => {
    try {
      const res = await fetch('/api/nudges')
      const data = await res.json()
      if (data.nudges) {
        setIncomingNudges(data.nudges)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const autoOpenChat = useRef<string | null>(null)

  // Deep-link support: /partners?chat=<id> (from a push notification tap)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const chat = new URLSearchParams(window.location.search).get('chat')
    if (chat) autoOpenChat.current = chat
  }, [])

  useEffect(() => {
    // Initial load — every setState happens inside async callbacks, never
    // synchronously in the effect body.
    const partners = fetch('/api/partners').then(r => r.json()).then(d => {
      if (d.partners) setPartners(d.partners)
    }).catch(() => {})
    const nudges = fetch('/api/nudges').then(r => r.json()).then(d => {
      if (d.nudges) setIncomingNudges(d.nudges)
    }).catch(() => {})
    const shared = fetch('/api/partners/shared').then(r => r.json()).then(d => {
      if (d.success) setShared({ sharedWithMe: d.sharedWithMe || [], iShareWith: d.iShareWith || [] })
    }).catch(() => {})
    Promise.all([partners, nudges, shared]).finally(() => setLoading(false))
  }, [])

  const fetchMessages = async (partnerId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingMessages(true)
    try {
      const res = await fetch(`/api/messages?partnerId=${partnerId}`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (e) {
      console.error(e)
    } finally {
      if (!opts?.silent) setLoadingMessages(false)
    }
  }

  // Auto-refresh messages via LONG-POLL: the request hangs on the server for
  // up to ~25s and answers the moment the thread changes, so a quiet chat
  // costs a couple of lightweight requests a minute — no 5-second hammering.
  const messagesRef = useRef<Message[]>([])
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    if (!selectedPartner) return
    let stop = false
    const controller = new AbortController()
    const partnerId = selectedPartner.id

    const loop = async () => {
      while (!stop) {
        try {
          const res = await fetch(
            `/api/messages/wait?partnerId=${partnerId}&known=${messagesRef.current.length}`,
            { signal: controller.signal, cache: 'no-store' }
          )
          if (stop) return
          if (!res.ok) {
            // Server hiccup — pause briefly, then resume watching.
            await new Promise(r => setTimeout(r, 4000))
            continue
          }
          const data = await res.json()
          if (!stop && data.changed && Array.isArray(data.messages)) {
            setMessages(data.messages)
          }
        } catch {
          if (stop) return // aborted on unmount / partner switch
          await new Promise(r => setTimeout(r, 4000))
        }
      }
    }
    loop()

    return () => {
      stop = true
      controller.abort()
    }
  }, [selectedPartner])

    // Scroll to the bottom after every render that changes the message list.
  // Using requestAnimationFrame + scrollTo (instead of immediate
  // scrollIntoView) guarantees the new message is in the DOM on mobile
  // before we scroll — no "stuck" or "jumps then snaps back" issues.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    // Defer to after React has committed the new messages.
    const raf = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [messages])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newEmail) return

    setSaving(true)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, role: 'Accountability Partner' })
      })
      if (res.ok) {
        const data = await res.json()
        setNewName('')
        setNewEmail('')
        setAdding(false)
        // Tell the user exactly how the invite travelled — and hand them the
        // link when email couldn't deliver (no provider key, restricted
        // sender domain, etc.) so the invite never dead-ends.
        setInviteNotice({
          name: newName.trim(),
          linked: !!data.linked,
          emailSent: !!data.emailSent,
          emailReason: data.emailReason || null,
          emailDetail: data.emailDetail || null,
          acceptUrl: data.acceptUrl || null,
        })
        await fetchPartners()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to add partner', 'error')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm('Are you sure you want to remove this partner?'))) return
    try {
      const res = await fetch(`/api/partners?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPartners(partners.filter(p => p.id !== id))
        if (selectedPartner?.id === id) {
          setSelectedPartner(null)
          setMessages([])
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSelectPartner = async (partner: Partner) => {
    setSelectedPartner(partner)
    setMessages([])
    await fetchMessages(partner.id)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPartner || sendingMessage) return

    setSendingMessage(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: selectedPartner.id,
          message: newMessage.trim()
        })
      })
      if (res.ok) {
        const data = await res.json()
        setNewMessage('')
        // Show my message INSTANTLY — pop it in and let the auto-scroll drop
        // the view to it. No loader flash; the long-poll reconciles the rest.
        if (data.nudge) {
          const mine: Message = { ...data.nudge, partner: { name: selectedPartner.name } }
          setMessages(prev => (prev.some(m => m.id === mine.id) ? prev : [...prev, mine]))
        }
        // Silent reconcile (no loader) — in case the server enriched fields.
        fetchMessages(selectedPartner.id, { silent: true })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSendingMessage(false)
    }
  }

  const handleDismissNudge = async (nudgeId: string) => {
    try {
      await fetch('/api/nudges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nudgeId, read: true })
      })
      setIncomingNudges(prev => prev.filter(n => n.id !== nudgeId))
    } catch (e) {
      console.error(e)
    }
  }

  const handleBack = () => {
    setSelectedPartner(null)
    setMessages([])
    fetchIncomingNudges()
  }

  // Full-page gamified loading gate — same pattern as every other route.
  if (loading) return <Loader routeKey="partners" />

  // Conversation panel — WhatsApp/Telegram style: messages scroll between a
  // header and a composer that stay put. On desktop it is the right-hand pane
  // beside the partner list; on phones it takes the whole screen.
  const conversation = selectedPartner && (
    <Panel
      padded={false}
      aria-label={`Conversation with ${selectedPartner.name}`}
      className={cx(
        'chat-sheet flex min-h-[22rem] flex-col overflow-hidden',
        // Fill the viewport between the topbar and the bottom nav / page padding
        'h-[calc(100dvh_-_14rem_-_env(safe-area-inset-top,0px)_-_env(safe-area-inset-bottom,0px))]',
        'lg:h-[calc(100dvh_-_10rem)] lg:max-h-[56rem]',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gold/10 px-2 py-2 sm:px-3">
        <IconButton icon={ArrowLeft} label="Back to partners" onClick={handleBack} className="lg:hidden" />
        <Avatar name={selectedPartner.name} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-heading text-parchment">{selectedPartner.name}</h2>
          <p className="truncate text-caption text-parchment/50">{selectedPartner.role}</p>
        </div>
        <IconButton icon={X} label="Close conversation" onClick={handleBack} className="max-lg:hidden" />
      </div>

      {/* Messages */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-lenis-prevent
        ref={scrollContainerRef}
      >
        {loadingMessages ? (
          <Loader compact label="Fetching messages…" routeKey="partners" />
        ) : messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-end px-6 pb-8 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold/20">
              <MessageSquare className="h-5 w-5 text-gold" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h3 className="text-heading text-parchment/80">Say hello</h3>
            <p className="mt-2 max-w-xs text-body text-parchment/50">
              This is the start of your conversation with {selectedPartner.name}. Your first message appears right here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3 px-4 py-4">
            {messages.map((msg) => {
              const isSent = myId ? msg.senderId === myId : msg.senderId === msg.receiverId
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isSent ? 'items-end' : 'items-start'}`}
                >
                  <div className={isSent ? 'message-bubble-sent' : 'message-bubble-received'}>
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                  </div>
                  <span className="mt-1 px-1 font-mono text-[10px] tabular-nums text-parchment/40">
                    {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gold/10 px-3 py-3 sm:px-4">
        <div className="relative flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            aria-label={`Message ${selectedPartner.name}`}
            placeholder={`Message ${selectedPartner.name}…`}
            className={cx(inputClass, 'min-h-12 rounded-full pl-5 pr-14')}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sendingMessage}
            aria-label="Send message"
            className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink transition-colors hover:bg-gold-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-40"
          >
            {sendingMessage ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </Panel>
  )

  const hasShared = !!shared && (shared.sharedWithMe.length > 0 || shared.iShareWith.length > 0)

  return (
    <Page width="wide">
      {/* Everything above the panes steps aside on phones while a conversation is open */}
      <div className={cx('space-y-6', selectedPartner && 'max-lg:hidden')}>
        <PageHeader
          eyebrow="Accountability"
          title={<Scramble text="Partners" mono={false} />}
          description="Manage your accountability partners"
          meta={partners.length > 0 ? `${partners.length} ${partners.length === 1 ? 'partner' : 'partners'}` : undefined}
          actions={
            <>
              {/* Incoming nudges bell */}
              {incomingNudges.length > 0 && (
                <button
                  onClick={() => setShowNudges(!showNudges)}
                  aria-label="Incoming nudges"
                  aria-expanded={showNudges}
                  className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gold/25 text-parchment/70 transition-colors hover:border-gold/50 hover:text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  <Bell className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1 font-mono text-[10px] tabular-nums text-surface">
                    {incomingNudges.length}
                  </span>
                </button>
              )}
              <Button
                variant={adding ? 'secondary' : 'primary'}
                icon={adding ? X : Plus}
                onClick={() => setAdding(!adding)}
                data-cursor="Bring someone aboard"
                aria-expanded={adding}
              >
                {adding ? 'Cancel' : 'Add Partner'}
              </Button>
            </>
          }
        />

        {/* Invite delivery notice — honest about what actually happened */}
        {inviteNotice && (
          <Panel
            role="status"
            className={cx(
              'flex items-start gap-3',
              inviteNotice.linked || inviteNotice.emailSent ? 'border-moss/30' : 'border-gold/40',
            )}
          >
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {inviteNotice.linked ? (
                <>
                  <p className="text-heading text-parchment">
                    {`You and ${inviteNotice.name} are linked — they were already on Inchstone.`}
                  </p>
                  <p className="mt-1 text-caption text-parchment/55">
                    {inviteNotice.emailSent
                      ? 'A confirmation email is on its way to them.'
                      : 'Email delivery is not configured, so no confirmation email was sent — they still see the link in-app.'}
                  </p>
                </>
              ) : inviteNotice.emailSent ? (
                <>
                  <p className="text-heading text-parchment">
                    {`Invite email sent to ${inviteNotice.name}.`}
                  </p>
                  <p className="mt-1 text-caption text-parchment/55">They&apos;ll accept from their inbox — the link stays valid here too.</p>
                </>
              ) : (
                <>
                  <p className="text-heading text-parchment">
                    {`${inviteNotice.name} was added, but the invite email couldn't be sent.`}
                  </p>
                  <p className="mt-1 text-caption text-parchment/55">
                    {inviteNotice.emailReason === 'sender_not_verified' ? (
                      <>
                        Your email provider is ready, but it needs a <strong>verified domain</strong> before it can
                        deliver to anyone outside your own account. Add one at{' '}
                        <a
                          href="https://resend.com/domains"
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-gold underline decoration-gold/40 underline-offset-2"
                        >
                          resend.com/domains
                        </a>
                        {' '}and set EMAIL_FROM to it — invite emails will then send automatically.
                      </>
                    ) : inviteNotice.emailReason === 'no_key' ? (
                      <>
                        Email isn&apos;t configured yet — add a RESEND_API_KEY to start sending invites. Until then,
                        share the link below.
                      </>
                    ) : (
                      <>
                        Email delivery failed{inviteNotice.emailDetail ? ` (${inviteNotice.emailDetail.replace(/\s+/g, ' ').trim().slice(0, 140)})` : ''}.
                        {' '}Share the link below, or try re-adding them in a moment.
                      </>
                    )}
                  </p>
                  {inviteNotice.acceptUrl && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        readOnly
                        aria-label="Invite link"
                        value={inviteNotice.acceptUrl}
                        onFocus={e => e.currentTarget.select()}
                        className={cx(inputClass, 'min-w-0 flex-1 font-mono text-[11px] text-parchment/70')}
                      />
                      <Button
                        icon={Copy}
                        onClick={() => copyInviteLink(inviteNotice.acceptUrl!.split('code=')[1] || '', 'notice')}
                        className="shrink-0"
                      >
                        {copiedId === 'notice' ? 'Copied!' : 'Copy link'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
            <IconButton icon={X} label="Dismiss" onClick={() => setInviteNotice(null)} className="-mr-2 -mt-2" />
          </Panel>
        )}

        {/* Incoming nudges */}
        {showNudges && incomingNudges.length > 0 && (
          <Section title={<>Incoming messages · <span className="tabular-nums">{incomingNudges.length}</span></>}>
            <Panel padded={false}>
              <ul className="divide-y divide-gold/10">
                {incomingNudges.map(nudge => (
                  <li key={nudge.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <Avatar name={nudge.partner?.name || 'a partner'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-caption text-parchment/60">
                        From {nudge.partner?.name || 'a partner'}
                      </p>
                      <p className="mt-0.5 text-body text-parchment/85">&quot;{nudge.message}&quot;</p>
                      <p className="mt-1 font-mono text-[10px] tabular-nums text-parchment/40">
                        {format(new Date(nudge.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <IconButton icon={X} label="Dismiss nudge" onClick={() => handleDismissNudge(nudge.id)} />
                  </li>
                ))}
              </ul>
            </Panel>
          </Section>
        )}

        {/* Add Partner Form */}
        {adding && (
          <Panel>
            <form onSubmit={handleAdd} className="space-y-5">
              <h3 className="text-heading text-parchment">Invite a new partner</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Name">
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className={inputClass}
                    placeholder="Jane Doe"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className={inputClass}
                    placeholder="jane@example.com"
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  <span>Add Partner</span>
                </Button>
              </div>
            </form>
          </Panel>
        )}
      </div>

      {partners.length === 0 ? (
        <div className="space-y-10">
          <EmptyState
            title="No partners yet"
            body="Add an accountability partner to share your goals with. They'll be able to send you messages and track your progress."
          />
          {hasShared && <SharedProgress shared={shared!} />}
        </div>
      ) : (
        // Two panes on desktop (people | conversation); one at a time on phones
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className={cx('min-w-0 space-y-10', selectedPartner && 'max-lg:hidden')}>
            <Section title="People">
              <Panel padded={false}>
                <ul className="divide-y divide-gold/10">
                  {partners.map(partner => {
                    const isOpen = selectedPartner?.id === partner.id
                    const accepted = partner.status === 'accepted'
                    const actions: RowAction[] = [
                      { label: 'Message', icon: MessageSquare, onSelect: () => handleSelectPartner(partner) },
                      ...(!accepted && partner.inviteCode
                        ? [{ label: 'Copy invite link', icon: Copy, onSelect: () => copyInviteLink(partner.inviteCode!, partner.id) }]
                        : []),
                      { label: 'Remove partner', icon: Trash2, destructive: true, onSelect: () => handleDelete(partner.id) },
                    ]
                    return (
                      <li
                        key={partner.id}
                        aria-current={isOpen ? 'true' : undefined}
                        className={cx('group space-y-3 px-3 py-3 transition-colors sm:px-4', isOpen && 'bg-gold/[0.05]')}
                      >
                        {/* Identity row: tapping it opens the conversation */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectPartner(partner)}
                            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                          >
                            <Avatar name={partner.name} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-heading text-parchment transition-colors group-hover:text-gold">{partner.name}</span>
                              <span className="mt-0.5 flex items-center gap-1 truncate text-caption text-parchment/50">
                                <Mail className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                                <span className="truncate">{partner.email}</span>
                              </span>
                            </span>
                          </button>
                          {accepted ? (
                            <Badge tone="moss" className="shrink-0">
                              <LinkIcon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                              Linked
                            </Badge>
                          ) : (
                            <Badge tone="gold" className="shrink-0">
                              <Mail className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                              Invite pending
                            </Badge>
                          )}
                          <RowActions actions={actions} label={`Actions for ${partner.name}`} />
                        </div>

                        {/* Sharing + invite controls */}
                        <div className="flex flex-wrap items-center gap-2 pl-1 sm:pl-[3.75rem]">
                          <button
                            type="button"
                            onClick={() => handleToggleShare(partner)}
                            title="Turn sharing on or off for this partner"
                            aria-pressed={partner.shareProgress}
                            className={cx(
                              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors pointer-fine:min-h-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                              partner.shareProgress
                                ? 'border-moss/40 bg-moss/10 text-moss'
                                : 'border-gold/20 text-parchment/55 hover:border-gold/40 hover:text-gold',
                            )}
                          >
                            <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', partner.shareProgress ? 'bg-moss' : 'bg-parchment/25')} />
                            {partner.shareProgress ? 'Sharing' : 'Share progress'}
                          </button>
                          {!accepted && partner.inviteCode && (
                            <button
                              type="button"
                              onClick={() => copyInviteLink(partner.inviteCode!, partner.id)}
                              title="Copy their invite link to share"
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/20 px-3 text-xs text-parchment/55 transition-colors pointer-fine:min-h-8 hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                            >
                              <Copy className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                              {copiedId === partner.id ? 'Copied' : 'Copy invite'}
                            </button>
                          )}
                          <span className="ml-auto flex items-center gap-3 text-caption text-parchment/50">
                            <span>{partner.role}</span>
                            <span className="flex items-center gap-1 font-mono tabular-nums text-moss" title="Shared links">
                              <LinkIcon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                              {partner.partnerLinks?.length || 0}
                            </span>
                          </span>
                        </div>

                        {/* What to share — granular, per partner, opt-in scopes */}
                        {accepted && partner.shareProgress && (
                          <div className="space-y-2 pl-1 sm:pl-[3.75rem]">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">
                              What {partner.name.split(' ')[0]} can see
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {SHARE_SCOPE_OPTIONS.map(opt => {
                                const active = shareScopesOf(partner).includes(opt.key)
                                const Icon = opt.icon
                                return (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => handleToggleScope(partner, opt.key)}
                                    title={opt.hint}
                                    aria-pressed={active}
                                    className={cx(
                                      'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors pointer-fine:min-h-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                                      active
                                        ? 'border-gold/50 bg-gold/10 text-gold'
                                        : 'border-gold/15 text-parchment/50 hover:border-gold/30 hover:text-parchment/75',
                                    )}
                                  >
                                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                            <p className="text-caption text-parchment/40">
                              Pick exactly what&apos;s shared — nothing else leaves your account.
                            </p>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </Section>

            {/* Shared progress — consent-gated, both directions */}
            {hasShared && <SharedProgress shared={shared!} />}
          </div>

          {/* Conversation pane */}
          <div className={cx('min-w-0 lg:sticky lg:top-0', !selectedPartner && 'max-lg:hidden')}>
            {conversation || (
              <EmptyState
                className="lg:min-h-[24rem] lg:justify-center"
                title="Pick someone to talk to"
                body="Choose a partner on the left to open your conversation. Nudges and messages land here."
              />
            )}
          </div>
        </div>
      )}
    </Page>
  )
}

function SharedProgress({ shared }: { shared: SharedSummary }) {
  return (
    <Section
      title="Shared progress"
      description="Only what each side explicitly opts in to — nothing is shared by default."
    >
      <div className="space-y-4">
        {shared.sharedWithMe.length > 0 && (
          <Panel padded={false}>
            <ul className="divide-y divide-gold/10">
              {shared.sharedWithMe.map(s => {
                const hasDeeds = typeof s.tasksTotal === 'number'
                const pct = hasDeeds && (s.tasksTotal || 0) > 0
                  ? Math.round(((s.tasksDone || 0) / (s.tasksTotal || 0)) * 100)
                  : null
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Avatar name={s.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-heading text-parchment">{s.name}</p>
                      {/* Scope badges */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.scopes.map(scope => {
                          const opt = SHARE_SCOPE_OPTIONS.find(o => o.key === scope)
                          const label = opt?.label || scope
                          const Icon = opt?.icon
                          return (
                            <Badge key={scope}>
                              {Icon && <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />}
                              {label}
                            </Badge>
                          )
                        })}
                      </div>
                      {/* Stats per scope */}
                      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-parchment/50">
                        {[
                          hasDeeds ? `${s.tasksDone}/${s.tasksTotal} deeds done today` : null,
                          typeof s.habitsTotal === 'number' ? `${s.habitsDone}/${s.habitsTotal} habits` : null,
                          s.frogDone != null ? `frog ${s.frogDone ? 'done' : 'pending'}` : null,
                          typeof s.weekTotal === 'number' ? `${s.weekDone}/${s.weekTotal} this week` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {pct != null && <Figure>{pct}%</Figure>}
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}
        {shared.iShareWith.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/45">You share with</p>
            <div className="flex flex-wrap gap-1.5">
              {shared.iShareWith.map(s => {
                const scopes = (s.shareWhat || 'deeds').split(',').filter(Boolean)
                return (
                  <span key={s.email} className="rounded-full border border-gold/15 px-3 py-1 text-caption text-parchment/65">
                    {s.name}
                    <span className="text-parchment/40"> · {scopes.map(sc => SHARE_SCOPE_OPTIONS.find(o => o.key === sc)?.label || sc).join(', ')}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}
