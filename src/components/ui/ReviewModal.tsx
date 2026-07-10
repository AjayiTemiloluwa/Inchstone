'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ReviewModalProps {
  onClose: () => void
  onSaved: () => void
}

const PERIOD_TYPES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
const moodLabels = ['Low', 'Okay', 'Good', 'Great']

export function ReviewModal({ onClose, onSaved }: ReviewModalProps) {
  const [periodType, setPeriodType] = useState('daily')
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [reflection, setReflection] = useState('')
  const [wins, setWins] = useState('')
  const [misses, setMisses] = useState('')
  const [tomorrowTop3, setTomorrowTop3] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodType,
          periodStart: new Date().toISOString(),
          mood,
          energy,
          reflection: reflection.trim() || null,
          wins: wins.trim() || null,
          misses: misses.trim() || null,
          tomorrowTop3: tomorrowTop3 ? tomorrowTop3.split('\n').filter(Boolean) : null,
        }),
      })
      if (res.ok) {
        onSaved()
        onClose()
      } else {
        setError('Failed to save review. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
      <div className="bg-paper w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-mist shrink-0">
          <h3 className="font-bold text-ink">New Review</h3>
          <button onClick={onClose} className="p-1 hover:bg-mist rounded-full transition-colors">
            <X className="w-5 h-5 text-ink/60" />
          </button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Period Type */}
          <div>
            <label className="text-xs font-bold text-ink/70 mb-2 block">Period</label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_TYPES.map(pt => (
                <button
                  key={pt}
                  onClick={() => setPeriodType(pt)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                    periodType === pt
                      ? 'bg-ink text-surface border-ink'
                      : 'border-mist text-ink/70 hover:bg-mist'
                  }`}
                >
                  {pt.charAt(0).toUpperCase() + pt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Mood & Energy Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-ink/70 mb-1 block">Mood</label>
              <div className="flex gap-2">
                {moodLabels.map((label, idx) => (
                  <button
                    key={label}
                    onClick={() => setMood(idx + 1)}
                    className={`flex-1 py-2 text-xs border rounded transition ${
                      mood === idx + 1
                        ? 'bg-gold/20 text-gold border-gold/30 font-bold'
                        : 'border-mist text-ink/60 hover:bg-mist'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-ink/70 mb-1 block">Energy (0-10)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="0" max="10"
                  value={energy ?? 5}
                  onChange={e => setEnergy(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono font-bold text-ink/70 w-6 text-center">{energy ?? 5}</span>
              </div>
            </div>
          </div>

          {/* Reflection */}
          <div>
            <label className="text-xs font-bold text-ink/70 mb-1 block">Reflection</label>
            <textarea
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface h-20 resize-none"
              placeholder="How did this period go?"
            />
          </div>

          {/* Wins */}
          <div>
            <label className="text-xs font-bold text-ink/70 mb-1 block">Wins</label>
            <textarea
              value={wins}
              onChange={e => setWins(e.target.value)}
              className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface h-20 resize-none"
              placeholder="What went well?"
            />
          </div>

          {/* Misses */}
          <div>
            <label className="text-xs font-bold text-ink/70 mb-1 block">Misses</label>
            <textarea
              value={misses}
              onChange={e => setMisses(e.target.value)}
              className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface h-20 resize-none"
              placeholder="What could have been better?"
            />
          </div>

          {/* Tomorrow's Top 3 */}
          <div>
            <label className="text-xs font-bold text-ink/70 mb-1 block">Top 3 Priorities (one per line)</label>
            <textarea
              value={tomorrowTop3}
              onChange={e => setTomorrowTop3(e.target.value)}
              className="w-full rounded-lg border border-mist p-2.5 text-sm bg-surface h-20 resize-none"
              placeholder="1.&#10;2.&#10;3."
            />
          </div>

          {error && (
            <p className="text-xs text-coral">{error}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-mist shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:text-ink transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-ink text-surface rounded-lg font-medium hover:bg-ink/90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
