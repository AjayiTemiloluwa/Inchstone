'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Plus, X, Users, Mail, Loader2, Link as LinkIcon, Trash2 } from 'lucide-react'

interface Partner {
  id: string
  name: string
  email: string
  role: string
  partnerLinks: any[]
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('Accountability Partner')
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    fetchPartners()
  }, [])

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
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sage/20 rounded-xl">
            <Users className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-ink">Partners</h1>
            <p className="text-ink/60 mt-1">Manage your accountability partners</p>
          </div>
        </div>
        <button 
          onClick={() => setAdding(!adding)}
          className="flex items-center space-x-2 px-4 py-2 bg-ink text-surface rounded-lg hover:bg-ink/80 transition"
        >
          {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{adding ? 'Cancel' : 'Add Partner'}</span>
        </button>
      </div>

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
                  className="w-full px-3 py-2 bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
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
                  className="w-full px-3 py-2 bg-paper border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30"
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={saving}
                className="px-6 py-2 bg-gold text-surface font-semibold rounded-lg hover:bg-gold/90 transition disabled:opacity-50 flex items-center space-x-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Add Partner</span>
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-sage" />
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-mist rounded-2xl">
          <Users className="w-12 h-12 text-ink/20 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-ink/70">No partners yet</h3>
          <p className="text-sm text-ink/50 mt-2 max-w-md mx-auto">
            Add accountability partners to share your goals with. They'll be able to send you nudges and track your progress.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {partners.map(partner => (
            <Card key={partner.id} className="p-5 flex flex-col justify-between hover:border-sage transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sage font-bold text-lg">
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
                  onClick={() => handleDelete(partner.id)}
                  className="p-1.5 text-ink/30 hover:text-red-500 hover:bg-red-50 rounded transition"
                  title="Remove Partner"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-4 border-t border-mist mt-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink/60 font-semibold">{partner.role}</span>
                  <span className="text-sage flex items-center bg-sage/10 px-2 py-1 rounded-full text-xs font-bold">
                    <LinkIcon className="w-3 h-3 mr-1" />
                    {partner.partnerLinks?.length || 0} Linked Goals
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
