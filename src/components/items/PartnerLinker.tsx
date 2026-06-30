'use client'

import { useState, useEffect } from 'react'
import { Link as LinkIcon, Plus, X, Users, Loader2 } from 'lucide-react'

interface Partner {
  id: string
  name: string
}

export function PartnerLinker({ itemId, linkedPartnerIds }: { itemId: string, linkedPartnerIds?: string[] }) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState('')

  useEffect(() => {
    // Only fetch if they click to open the menu
    if (linking && partners.length === 0) {
      setLoading(true)
      fetch('/api/partners')
        .then(res => res.json())
        .then(data => {
          if (data.partners) setPartners(data.partners)
        })
        .finally(() => setLoading(false))
    }
  }, [linking])

  const handleLink = async () => {
    if (!selectedPartnerId) return
    try {
      setLoading(true)
      const res = await fetch('/api/partner-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: selectedPartnerId, itemId })
      })
      if (res.ok) {
        setLinking(false)
        setSelectedPartnerId('')
        // Optionally refresh page or callback
        window.location.reload() 
      } else {
        alert('Failed to link partner')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async (linkId: string) => {
    if (!confirm('Unlink this partner?')) return
    try {
      await fetch(`/api/partner-links?id=${linkId}`, { method: 'DELETE' })
      window.location.reload()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-ink/70 flex items-center">
          <Users className="w-3 h-3 mr-1" />
          Accountability Partners
        </h3>
        {!linking && (
          <button 
            onClick={() => setLinking(true)}
            className="text-xs text-sage hover:text-sage/80 font-semibold flex items-center transition"
          >
            <Plus className="w-3 h-3 mr-1" /> Add
          </button>
        )}
      </div>

      {linking && (
        <div className="flex items-center space-x-2 bg-paper border border-mist p-2 rounded-lg mb-2">
          {loading && partners.length === 0 ? (
            <Loader2 className="w-4 h-4 animate-spin text-ink/30" />
          ) : partners.length === 0 ? (
            <span className="text-xs text-ink/50">No partners. Add one in the Partners page.</span>
          ) : (
            <>
              <select 
                value={selectedPartnerId}
                onChange={e => setSelectedPartnerId(e.target.value)}
                className="flex-1 text-xs bg-transparent focus:outline-none"
              >
                <option value="">Select a partner...</option>
                {partners.filter(p => !linkedPartnerIds?.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button 
                onClick={handleLink}
                disabled={!selectedPartnerId || loading}
                className="p-1 bg-sage text-white rounded hover:bg-sage/90 disabled:opacity-50"
              >
                <LinkIcon className="w-3 h-3" />
              </button>
            </>
          )}
          <button onClick={() => setLinking(false)} className="p-1 text-ink/40 hover:text-ink/80">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* For this simplified version, we just let the parent pass linkedPartnerIds and we render them if available.
          Realistically we would want to fetch the links for this item, or include them in the item model. */}
      {linkedPartnerIds && linkedPartnerIds.length > 0 && (
         <div className="flex flex-wrap gap-2 mt-2">
           <span className="text-[10px] bg-sage/10 text-sage px-2 py-1 rounded-full font-semibold">
             {linkedPartnerIds.length} Linked Partner{linkedPartnerIds.length > 1 ? 's' : ''}
           </span>
         </div>
      )}
    </div>
  )
}
