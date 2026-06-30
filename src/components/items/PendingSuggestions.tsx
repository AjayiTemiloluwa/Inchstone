'use client'

import { useState, useEffect } from 'react'
import { Check, X, Sparkles, Loader2 } from 'lucide-react'

interface Suggestion {
  id: string
  suggestedTitle: string
  status: string
}

export function PendingSuggestions({ 
  itemId, 
  goalTitle, 
  layer, 
  parentTitle,
  onSuggestionAccepted 
}: { 
  itemId: string
  goalTitle: string
  layer: number
  parentTitle?: string
  onSuggestionAccepted: () => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fetchSuggestions = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/suggestions')
      const data = await res.json()
      if (data.suggestions) {
        // Filter suggestions for this specific item and only show 'pending'
        const relevant = data.suggestions.filter((s: any) => s.itemId === itemId && s.status === 'pending')
        setSuggestions(relevant)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuggestions()
  }, [itemId])

  const generateSuggestions = async () => {
    try {
      setGenerating(true)
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, goalTitle, layer, parentTitle })
      })
      if (!res.ok) {
        const err = await res.json()
        alert('Failed to generate suggestions: ' + (err.error || 'Unknown error'))
        return
      }
      await fetchSuggestions()
    } catch (e) {
      console.error(e)
      alert('Error connecting to AI service.')
    } finally {
      setGenerating(false)
    }
  }

  const updateSuggestionStatus = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      const res = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: id, status })
      })
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== id))
        if (status === 'accepted') {
          onSuggestionAccepted()
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleAccept = async (suggestion: Suggestion) => {
    try {
      // Create the new item based on the suggestion
      const targetLayer = layer + 1
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: targetLayer,
          parentId: itemId,
          title: suggestion.suggestedTitle,
          weight: 100, // Default weight
        })
      })
      if (res.ok) {
        await updateSuggestionStatus(suggestion.id, 'accepted')
      } else {
        alert('Failed to create the goal.')
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return null

  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <div className="bg-sage/10 border border-sage/30 rounded-xl p-4">
          <h3 className="text-sm font-bold text-sage mb-3 flex items-center">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Suggestions
          </h3>
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-surface p-3 rounded-lg border border-sage/20">
                <span className="text-sm text-ink font-medium">{s.suggestedTitle}</span>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => updateSuggestionStatus(s.id, 'rejected')}
                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-md transition"
                    title="Reject"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleAccept(s)}
                    className="p-1.5 bg-sage text-white hover:bg-sage/90 rounded-md transition"
                    title="Accept & Create"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length === 0 && layer < 5 && (
        <button 
          onClick={generateSuggestions}
          disabled={generating}
          className="flex items-center space-x-2 text-sm text-sage hover:text-sage/80 font-semibold transition disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{generating ? 'Generating...' : 'Suggest Breakdown'}</span>
        </button>
      )}
    </div>
  )
}
