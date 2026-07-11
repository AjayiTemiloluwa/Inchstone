'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Plus, X, Users, Mail, Loader2, Link as LinkIcon, Trash2, MessageSquare, Send, ArrowLeft, Bell } from 'lucide-react'
import { format } from 'date-fns'

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
        <div className="flex items-center space-x-3 p-4 border-b border-mist bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-mist rounded-lg active:scale-90 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-ink/60" />
          </button>
          <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sage font-bold text-lg">
            {selectedPartner.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-ink">{selectedPartner.name}</h2>
            <p className="text-xs text-ink/50">{selectedPartner.role}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingMessages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-sage" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="w-12 h-12 text-ink/20 mb-4" />
              <h3 className="text-lg font-bold text-ink/70">No messages yet</h3>
              <p className="text-sm text-ink/50 mt-2 max-w-xs">
                Send a message to {selectedPartner.name} to start the conversation!
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
                    <span className="text-[10px] text-ink/40 mt-1 px-1">
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
        <div className="p-4 border-t border-mist bg-surface/80 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
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
              className="flex-1 px-4 py-3 bg-paper border border-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 text-sm min-h-[44px]"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              className="p-3 bg-gold text-surface rounded-xl hover:bg-gold-glow active:scale-90 transition disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {sendingMessage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
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
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sage/20 rounded-xl">
            <Users className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink">Partners</h1>
            <p className="text-sm text-ink/60 mt-1">Manage your accountability partners</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Incoming nudges bell */}
          {incomingNudges.length > 0 && (
            <button
              onClick={() => setShowNudges(!showNudges)}
              className="relative p-2.5 bg-sage/10 text-sage rounded-xl hover:bg-sage/20 active:scale-90 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {incomingNudges.length}
              </span>
            </button>
          )}
          <button
            onClick={() => setAdding(!adding)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-ink text-surface rounded-xl hover:bg-ink/80 active:scale-95 transition min-h-[44px]"
          >
            {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="text-sm font-medium">{adding ? 'Cancel' : 'Add Partner'}</span>
          </button>
        </div>
      </div>

      {/* Incoming Nudges Panel */}
      {showNudges && incomingNudges.length > 0 && (
        <Card className="p-4 border-sage/30 bg-sage/5">
          <h3 className="font-bold text-ink mb-3 flex items-center space-x-2">
            <Bell className="w-4 h-4 text-sage" />
            <span>Incoming Messages</span>
          </h3>
          <div className="space-y-2">
            {incomingNudges.map(nudge => (
              <div key={nudge.id} className="flex items-start justify-between p-3 bg-paper rounded-xl border border-mist">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-ink/70 mb-1">
                    From {nudge.partner?.name || 'a partner'}
                  </p>
                  <p className="text-sm text-ink/80">"{nudge.message}"</p>
                  <p className="text-[10px] text-ink/40 mt-1">
                    {format(new Date(nudge.createdAt), 'MMM d, h:mm a')}
                  </p>
                </div>
                <button
                  onClick={() => handleDismissNudge(nudge.id)}
                  className="p-1.5 text-ink/30 hover:text-ink hover:bg-mist rounded-lg active:scale-90 transition ml-2 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Partner Form */}
      {adding && (
        <Card className="p-6 border-gold/50 bg-gold/5">
          <form onSubmit={handleAdd} className="space-y-4">
            <h3 className="font-bold text-ink mb-2">Invite a new partner</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink/70 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-4 py-3 bg-paper border border-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-sm min-h-[44px]"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/70 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-paper border border-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30 text-sm min-h-[44px]"
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-gold text-surface font-semibold rounded-xl hover:bg-gold/90 active:scale-95 transition disabled:opacity-50 flex items-center space-x-2 min-h-[44px]"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Add Partner</span>
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Partners List */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-sage" />
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-mist rounded-2xl">
          <Users className="w-12 h-12 text-ink/20 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-ink/70">No partners yet</h3>
          <p className="text-sm text-ink/50 mt-2 max-w-md mx-auto">
            Add accountability partners to share your goals with. They'll be able to send you messages and track your progress.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map(partner => (
            <Card
              key={partner.id}
              className="p-5 hover:border-sage active:scale-[0.98] transition-all cursor-pointer"
              onClick={() => handleSelectPartner(partner)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center text-sage font-bold text-lg">
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-ink">{partner.name}</h3>
                    <p className="text-xs text-ink/50 flex items-center mt-0.5">
                      <Mail className="w-3 h-3 mr-1" />
                      {partner.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(partner.id) }}
                  className="p-1.5 text-ink/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Remove Partner"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-mist">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-ink/60 font-semibold">{partner.role}</span>
                  <span className="text-sage flex items-center bg-sage/10 px-2 py-1 rounded-full text-xs font-bold">
                    <LinkIcon className="w-3 h-3 mr-1" />
                    {partner.partnerLinks?.length || 0}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSelectPartner(partner) }}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-gold/10 text-gold rounded-xl text-xs font-bold hover:bg-gold/20 active:scale-90 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
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