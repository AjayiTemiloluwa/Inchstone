'use client'

import { Card } from '@/components/ui/Card'
import { NudgeModal } from '@/components/items/NudgeModal'
import { useState, useEffect } from 'react'
import { Plus, Bell, X } from 'lucide-react'

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([])
  const [nudges, setNudges] = useState<any[]>([])
  const [nudgeTarget, setNudgeTarget] = useState<{ id: string; name: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPartner, setNewPartner] = useState({ name: '', email: '', role: 'accountability' })
  const [adding, setAdding] = useState(false)

  const fetchPartners = () => {
    fetch('/api/partners').then(r => r.json()).then(data => setPartners(data.partners || []))
  }

  const fetchNudges = () => {
    fetch('/api/nudges').then(r => r.json()).then(data => setNudges(data.nudges || []))
  }

  useEffect(() => {
    fetchPartners()
    fetchNudges()
  }, [])

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.email) return
    setAdding(true)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPartner),
      })
      if (res.ok) {
        setShowAddForm(false)
        setNewPartner({ name: '', email: '', role: 'accountability' })
        fetchPartners()
      }
    } catch (err) {
      console.error('Failed to add partner', err)
    } finally {
      setAdding(false)
    }
  }

  const unreadCount = nudges.filter(n => !n.read).length

  const handleMarkRead = async (nudgeId: string) => {
    await fetch('/api/nudges', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nudgeId, read: true }),
    })
    fetchNudges()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-display font-bold text-ink">Accountability Partners</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-ink text-surface rounded hover:bg-ink/90 font-medium flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Partner</span>
        </button>
      </div>

      {/* Nudge Inbox */}
      {nudges.length > 0 && (
        <Card className="border-gold/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink flex items-center space-x-2">
              <Bell className="w-4 h-4 text-gold" />
              <span>Nudge Inbox</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-coral/20 text-coral text-xs font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
          </div>
          <div className="space-y-2">
            {nudges.slice(0, 5).map(nudge => (
              <div
                key={nudge.id}
                className={`flex items-start justify-between p-3 rounded-lg ${!nudge.read ? 'bg-gold/5 border border-gold/20' : 'bg-surface'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{nudge.message}</p>
                  <p className="text-xs text-ink/50 mt-1">
                    From {nudge.partner?.name || 'a partner'} &middot; {new Date(nudge.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {!nudge.read && (
                  <button
                    onClick={() => handleMarkRead(nudge.id)}
                    className="ml-2 p-1 text-ink/40 hover:text-ink transition-colors"
                    title="Mark as read"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Partner Form */}
      {showAddForm && (
        <Card className="border-gold">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-ink">New Partner</h3>
            <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-mist rounded-full">
              <X className="w-5 h-5 text-ink/60" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-ink/70 mb-1 block">Name</label>
              <input
                type="text"
                value={newPartner.name}
                onChange={e => setNewPartner(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-mist p-2.5 text-sm bg-paper"
                placeholder="Partner's name"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink/70 mb-1 block">Email</label>
              <input
                type="email"
                value={newPartner.email}
                onChange={e => setNewPartner(prev => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-mist p-2.5 text-sm bg-paper"
                placeholder="partner@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink/70 mb-1 block">Role</label>
              <select
                value={newPartner.role}
                onChange={e => setNewPartner(prev => ({ ...prev, role: e.target.value }))}
                className="w-full rounded-lg border border-mist p-2.5 text-sm bg-paper"
              >
                <option value="accountability">Accountability</option>
                <option value="mentor">Mentor</option>
                <option value="collaborator">Collaborator</option>
              </select>
            </div>
            <button
              onClick={handleAddPartner}
              disabled={adding || !newPartner.name || !newPartner.email}
              className="w-full py-2.5 bg-gold text-surface font-semibold rounded-lg hover:bg-gold/90 transition disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Partner'}
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partners.length === 0 && !showAddForm ? (
          <p className="text-ink/60 p-4 border border-dashed border-mist rounded text-center col-span-2">No partners added yet.</p>
        ) : (
          partners.map(partner => (
            <Card key={partner.id} className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-mist rounded-full flex items-center justify-center font-bold text-ink/50 text-xl shrink-0">
                {partner.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-ink truncate">{partner.name}</h3>
                <p className="text-xs text-ink/70 truncate">{partner.email}</p>
                <span className="inline-block mt-2 px-2 py-1 bg-gold/10 text-gold rounded text-[10px] font-bold uppercase">
                  {partner.role}
                </span>
              </div>
              <button
                onClick={() => setNudgeTarget({ id: partner.id, name: partner.name })}
                className="text-xs font-bold text-coral hover:underline shrink-0"
              >
                Nudge
              </button>
            </Card>
          ))
        )}
      </div>

      {nudgeTarget && (
        <NudgeModal
          partnerId={nudgeTarget.id}
          partnerName={nudgeTarget.name}
          onClose={() => setNudgeTarget(null)}
          onSent={fetchNudges}
        />
      )}
    </div>
  )
}