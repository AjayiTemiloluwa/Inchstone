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
  inviteCode?: string | null
  connectionUserId?: string | null
  partnerLinks: unknown[]
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
  sharedWithMe: Array<{ id: string; name: string; email: string; tasksTotal: number; tasksDone: number }>
  iShareWith: Array<{ name: string; email: string }>
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
    setPartners(prev => prev.map(p => (p.id === partner.id ? { ...p, shareProgress: next } : p)))
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareProgress: next }),
      })
      if (!res.ok) throw new Error()
      fetchShared()
    } catch {
      setPartners(prev => prev.map(p => (p.id === partner.id ? { ...p, shareProgress: !next } : p)))
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

  const fetchMessages = async (partnerId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/messages?partnerId=${partnerId}`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMessages(false)
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
        // Show my message immediately — the long-poll covers the other side.
        if (data.nudge) {
          const mine: Message = { ...data.nudge, partner: { name: selectedPartner.name } }
          setMessages(prev => (prev.some(m => m.id === mine.id) ? prev : [...prev, mine]))
        }
        await fetchMessages(selectedPartner.id)
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

  // Chat view
  if (selectedPartner) {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto pb-24 lg:pb-0">
        {/* Chat Header */}
        <div className="flex items-center space-x-3 p-4 border-b border-gold-dim/15 bg-surface-solid sticky top-0 z-10">
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" data-lenis-prevent>
          {loadingMessages ? (
            <Loader compact label="Fetching messages…" routeKey="partners" />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="mb-4 h-12 w-12 text-gold-dim" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-parchment/80">No messages yet</h3>
              <p className="text-sm text-parchment/50 mt-2 max-w-xs">
                Send a message to {selectedPartner.name} to start the conversation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col space-y-3">
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

        {/* Message Input */}
        <div className="border-t border-gold-dim/15 bg-surface-solid p-4">
          <div className="flex items-center gap-2">
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
              placeholder="Type a message..."
              className="min-h-11 flex-1 rounded-[6px] border border-gold-dim/25 bg-ink px-4 py-3 text-sm text-parchment transition-colors placeholder:text-parchment/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              aria-label="Send message"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md bg-gold text-ink transition-colors hover:bg-[#cbaa6f] disabled:opacity-50"
            >
              {sendingMessage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" strokeWidth={1.5} />
              )}
            </button>
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
                const pct = s.tasksTotal > 0 ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/15 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-parchment">{s.name}</p>
                      <p className="text-[11px] text-parchment/45">{s.tasksDone}/{s.tasksTotal} deeds done today</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 font-mono text-xs font-bold text-gold tabular-nums">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
          {shared.iShareWith.length > 0 && (
            <p className="mt-3 text-[11px] text-parchment/40">
              You share your daily progress with {shared.iShareWith.map(s => s.name).join(', ')}.
            </p>
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
                  title="Let this partner see your daily progress"
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    partner.shareProgress
                      ? 'border-moss/40 bg-moss/10 text-moss'
                      : 'border-white/15 text-parchment/45 hover:border-gold/40 hover:text-gold'
                  }`}
                >
                  {partner.shareProgress ? '✓ Sharing progress' : 'Share progress'}
                </button>
              </div>

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