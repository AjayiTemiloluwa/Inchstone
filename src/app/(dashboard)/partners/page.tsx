'use client'

import { useState, useEffect, useRef } from 'react'
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
  partnerLinks: any[]
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
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('Accountability Partner')
  const [saving, setSaving] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [incomingNudges, setIncomingNudges] = useState<Message[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showNudges, setShowNudges] = useState(false)

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
    fetchPartners()
    fetchIncomingNudges()
  }, [])

  // Auto-refresh messages
  useEffect(() => {
    if (!selectedPartner) return
    const interval = setInterval(() => {
      fetchMessages(selectedPartner.id)
    }, 5000)
    return () => clearInterval(interval)
  }, [selectedPartner])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newEmail) return

    setSaving(true)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, role: newRole })
      })
      if (res.ok) {
        setNewName('')
        setNewEmail('')
        setAdding(false)
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
        setNewMessage('')
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
            <Loader compact label="Fetching messages…" />
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
                const isSent = msg.senderId === msg.receiverId
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
            className="flex min-h-11 items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[#cbaa6f]"
          >
            {adding ? <X className="h-4 w-4" strokeWidth={1.5} /> : <Plus className="h-4 w-4" strokeWidth={1.5} />}
            <span>{adding ? 'Cancel' : 'Add Partner'}</span>
          </button>
        </div>
      </div>

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

      {/* Partners List */}
      {loading ? (
        <Loader compact label="Gathering your partners…" />
      ) : partners.length === 0 ? (
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