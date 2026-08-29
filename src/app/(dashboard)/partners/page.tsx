'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card } from '@/components/ui/Card'
import { Plus, X, Users, Mail, Loader2, Link as LinkIcon, Trash2, MessageSquare, Send, ArrowLeft, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { Scramble } from '@/components/ui/motion'
import { Loader } from '@/components/ui/Loader'

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
export const SHARE_SCOPE_OPTIONS: { key: string; label: string; hint: string; icon: string }[] = [
  { key: 'deeds', label: 'Deeds', hint: "Today's to-dos done/total", icon: '✓' },
  { key: 'habits', label: 'Habits', hint: "Today's habit completions", icon: '🌱' },
  { key: 'frog', label: 'Frog', hint: 'Hardest task done?', icon: '🐸' },
  { key: 'week', label: 'Week', hint: "This week's completion", icon: '📅' },
]

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
        alert(data.error || 'Failed to add partner')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this partner?')) return
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

    // Chat view — WhatsApp/Telegram style: messages scroll underneath a
  // fixed composer at the bottom. The input is always at the bottom,
  // never centered — exactly like a native chat app.
  if (selectedPartner) {
    return (
      <div className="chat-sheet relative mx-auto h-full max-w-4xl">
        {/* Chat Header — pinned to the top */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center space-x-3 border-b border-gold-dim/15 bg-surface-solid/85 backdrop-blur-sm">
          <button
            onClick={handleBack}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-parchment/60 transition-colors hover:bg-mist hover:text-parchment"
            aria-label="Back to partners"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-moss/15 text-lg font-bold text-moss">
            {selectedPartner.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-parchment">{selectedPartner.name}</h2>
            <p className="text-xs text-parchment/50">{selectedPartner.role}</p>
          </div>
        </div>

        {/* Messages — scroll UNDER the fixed header and composer */}
        <div
          className="absolute left-0 right-0 overflow-y-auto scroll-pb-4 scroll-pt-[56px]"
          style={{ top: '56px', bottom: '72px' }}
                    data-lenis-prevent
          ref={scrollContainerRef}
        >
          {loadingMessages ? (
            <Loader compact label="Fetching messages…" routeKey="partners" />
          ) : messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-end text-center px-4 pb-6">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                <MessageSquare className="h-7 w-7 text-gold" strokeWidth={1.5} />
              </span>
              <h3 className="text-lg font-semibold text-parchment/80">Say hello 👋</h3>
              <p className="mt-2 max-w-xs text-sm text-parchment/50">
                This is the start of your conversation with {selectedPartner.name}. Your first message appears right here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col space-y-3 px-4 pt-2 pb-2">
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
                    <span className="text-[10px] text-parchment/40 mt-1 px-1">
                      {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer — pinned to the bottom, always visible */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20 border-t border-gold-dim/15 bg-surface-solid/90 backdrop-blur-sm"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <div className="px-3 pt-3 sm:px-4">
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
                placeholder={`Message ${selectedPartner.name}…`}
                className="min-h-12 w-full rounded-full border border-gold-dim/25 bg-ink pl-5 pr-14 text-sm text-parchment transition-colors placeholder:text-parchment/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                aria-label="Send message"
                className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-gold text-ink transition-all hover:bg-[#cbaa6f] disabled:opacity-40 active:scale-90"
              >
                {sendingMessage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-parchment"><Scramble text="Partners" mono={false} /></h1>
          <p className="mt-1 text-sm text-parchment/55">Manage your accountability partners</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Incoming nudges bell */}
          {incomingNudges.length > 0 && (
            <button
              onClick={() => setShowNudges(!showNudges)}
              aria-label="Incoming nudges"
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-md border hairline text-parchment/70 transition-colors hover:border-gold"
            >
              <Bell className="h-5 w-5" strokeWidth={1.5} />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ember text-[10px] font-bold text-white">
                {incomingNudges.length}
              </span>
            </button>
          )}
          <button
            onClick={() => setAdding(!adding)}
            data-cursor="Bring someone aboard"
            className="flex min-h-11 items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[#cbaa6f]"
          >
            {adding ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
            <span>{adding ? 'Cancel' : 'Add Partner'}</span>
          </button>
        </div>
      </div>

      {/* Invite delivery notice — honest about what actually happened */}
      {inviteNotice && (
        <Card className={`p-4 ${inviteNotice.linked ? 'border-moss/30 bg-moss/5' : inviteNotice.emailSent ? 'border-moss/30 bg-moss/5' : 'border-gold/40 bg-gold/5'}`}>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              {inviteNotice.linked ? (
                <>
                  <p className="text-sm font-semibold text-parchment">
                    {`You and ${inviteNotice.name} are linked — they were already on Inchstone.`}
                  </p>
                  <p className="mt-1 text-xs text-parchment/50">
                    {inviteNotice.emailSent
                      ? 'A confirmation email is on its way to them.'
                      : 'Email delivery is not configured, so no confirmation email was sent — they still see the link in-app.'}
                  </p>
                </>
              ) : inviteNotice.emailSent ? (
                <>
                  <p className="text-sm font-semibold text-parchment">
                    {`Invite email sent to ${inviteNotice.name}.`}
                  </p>
                  <p className="mt-1 text-xs text-parchment/50">They&apos;ll accept from their inbox — the link stays valid here too.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-parchment">
                    {`${inviteNotice.name} was added, but the invite email couldn't be sent.`}
                  </p>
                  <p className="mt-1 text-xs text-parchment/50">
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
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <input
                        readOnly
                        value={inviteNotice.acceptUrl}
                        onFocus={e => e.currentTarget.select()}
                        className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 font-mono text-[11px] text-parchment/70 focus:outline-none"
                      />
                      <button
                        onClick={() => copyInviteLink(inviteNotice.acceptUrl!.split('code=')[1] || '', 'notice')}
                        className="flex shrink-0 items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-[#cbaa6f]"
                      >
                        {copiedId === 'notice' ? 'Copied!' : 'Copy link'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <button
              onClick={() => setInviteNotice(null)}
              aria-label="Dismiss"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-parchment/40 transition-colors hover:bg-mist hover:text-parchment"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Incoming Nudges Panel */}
      {showNudges && incomingNudges.length > 0 && (
        <Card className="p-4 border-moss/30 bg-moss/5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-parchment">
            <Bell className="h-4 w-4 text-moss" strokeWidth={1.5} />
            <span>Incoming Messages</span>
          </h3>
          <div className="space-y-2">
            {incomingNudges.map(nudge => (
              <div key={nudge.id} className="flex items-start justify-between rounded-lg border border-gold-dim/20 bg-surface-solid p-3">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-semibold text-parchment/70">
                    From {nudge.partner?.name || 'a partner'}
                  </p>
                  <p className="text-sm text-parchment/80">&quot;{nudge.message}&quot;</p>
                  <p className="mt-1 font-mono text-[10px] text-parchment/40">
                    {format(new Date(nudge.createdAt), 'MMM d, h:mm a')}
                  </p>
                </div>
                <button
                  onClick={() => handleDismissNudge(nudge.id)}
                  aria-label="Dismiss nudge"
                  className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-parchment/40 transition-colors hover:bg-mist hover:text-parchment"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Partner Form */}
      {adding && (
        <Card className="border-gold-dim/30 bg-gold/5 p-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <h3 className="mb-2 font-semibold text-parchment">Invite a new partner</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-parchment/55">Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="min-h-11 w-full rounded-[6px] border border-gold-dim/25 bg-ink px-4 py-3 text-sm text-parchment transition-colors placeholder:text-parchment/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-parchment/55">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="min-h-11 w-full rounded-[6px] border border-gold-dim/25 bg-ink px-4 py-3 text-sm text-parchment transition-colors placeholder:text-parchment/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex min-h-11 items-center gap-2 rounded-md bg-gold px-6 py-3 font-semibold text-ink transition-colors hover:bg-[#cbaa6f] disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Add Partner</span>
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Shared progress — consent-gated, both directions */}
      {shared && (shared.sharedWithMe.length > 0 || shared.iShareWith.length > 0) && (
        <Card className="p-5">
          <h3 className="font-semibold text-parchment">Shared progress</h3>
          <p className="mb-4 mt-1 text-xs text-parchment/50">
            Only what each side explicitly opts in to — nothing is shared by default.
          </p>
          {shared.sharedWithMe.length > 0 && (
            <div className="space-y-2">
              {shared.sharedWithMe.map(s => {
                const hasDeeds = typeof s.tasksTotal === 'number'
                const pct = hasDeeds && (s.tasksTotal || 0) > 0
                  ? Math.round(((s.tasksDone || 0) / (s.tasksTotal || 0)) * 100)
                  : null
                return (
                  <div key={s.id} className="rounded-lg border border-white/10 bg-black/15 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-parchment">{s.name}</p>
                        {/* Scope badges */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.scopes.map(scope => {
                            const opt = SHARE_SCOPE_OPTIONS.find(o => o.key === scope)
                            const label = opt?.label || scope
                            return (
                              <span key={scope} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-parchment/55">
                                {opt?.icon} {label}
                              </span>
                            )
                          })}
                        </div>
                        {/* Stats per scope */}
                        <p className="mt-1 text-[11px] text-parchment/45">
                          {[
                            hasDeeds ? `${s.tasksDone}/${s.tasksTotal} deeds done today` : null,
                            typeof s.habitsTotal === 'number' ? `${s.habitsDone}/${s.habitsTotal} habits` : null,
                            s.frogDone != null ? `frog ${s.frogDone ? 'done' : 'pending'}` : null,
                            typeof s.weekTotal === 'number' ? `${s.weekDone}/${s.weekTotal} this week` : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {pct != null && (
                        <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 font-mono text-xs font-bold text-gold tabular-nums">{pct}%</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {shared.iShareWith.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="text-[11px] text-parchment/45">You share with:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {shared.iShareWith.map(s => {
                  const scopes = (s.shareWhat || 'deeds').split(',').filter(Boolean)
                  return (
                    <span key={s.email} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-parchment/55">
                      {s.name}
                      <span className="text-parchment/35"> · {scopes.map(sc => SHARE_SCOPE_OPTIONS.find(o => o.key === sc)?.label || sc).join(', ')}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Partners List */}
      {partners.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-gold-dim/30 p-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-gold-dim" strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-parchment/80">No partners yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-parchment/50">
            Add an accountability partner to share your goals with. They&apos;ll be able to send you messages and track your progress.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {partners.map(partner => (
            <Card
              key={partner.id}
              className="p-5 transition-colors hover:border-moss/40 cursor-pointer"
              onClick={() => handleSelectPartner(partner)}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-moss/15 text-lg font-bold text-moss">
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-parchment">{partner.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-parchment/50">
                      <Mail className="h-3 w-3" strokeWidth={1.5} />
                      {partner.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(partner.id) }}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-parchment/30 transition-colors hover:bg-ember/15 hover:text-[#cf8f78]"
                  title="Remove Partner"
                  aria-label="Remove partner"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {partner.status === 'accepted' ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-moss/30 bg-moss/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-moss">
                    <LinkIcon className="h-3 w-3" strokeWidth={1.5} />
                    Linked
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gold">
                    <Mail className="h-3 w-3" strokeWidth={1.5} />
                    Invite pending
                  </span>
                )}
                {partner.status !== 'accepted' && partner.inviteCode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); copyInviteLink(partner.inviteCode!, partner.id) }}
                    title="Copy their invite link to share"
                    className="flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-parchment/55 transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    {copiedId === partner.id ? '✓ Copied' : 'Copy invite'}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleShare(partner) }}
                  title="Turn sharing on or off for this partner"
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    partner.shareProgress
                      ? 'border-moss/40 bg-moss/10 text-moss'
                      : 'border-white/15 text-parchment/45 hover:border-gold/40 hover:text-gold'
                  }`}
                >
                  {partner.shareProgress ? '✓ Sharing' : 'Share progress'}
                </button>
              </div>

              {/* What to share — granular, per partner, opt-in scopes */}
              {partner.status === 'accepted' && partner.shareProgress && (
                <div className="mb-3 rounded-xl border border-white/[0.06] bg-black/10 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-parchment/40">
                    What {partner.name.split(' ')[0]} can see
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SHARE_SCOPE_OPTIONS.map(opt => {
                      const active = shareScopesOf(partner).includes(opt.key)
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleScope(partner, opt.key) }}
                          title={opt.hint}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                            active
                              ? 'border-gold/50 bg-gold/15 text-gold'
                              : 'border-white/10 text-parchment/45 hover:border-white/25 hover:text-parchment/70'
                          }`}
                        >
                          <span>{opt.icon}</span>
                          {opt.label}
                          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-gold' : 'bg-white/20'}`} />
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-parchment/35">
                    Pick exactly what&apos;s shared — nothing else leaves your account.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-gold-dim/15 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-parchment/70">{partner.role}</span>
                  <span className="flex items-center gap-1 rounded-md font-mono text-xs font-bold text-moss">
                    <LinkIcon className="h-3 w-3" strokeWidth={1.5} />
                    {partner.partnerLinks?.length || 0}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSelectPartner(partner) }}
                  data-cursor="Say hello"
                  className="flex items-center gap-1.5 rounded-md border hairline px-3 py-2 text-xs font-semibold text-parchment transition-colors hover:border-gold"
                >
                  <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Message</span>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}