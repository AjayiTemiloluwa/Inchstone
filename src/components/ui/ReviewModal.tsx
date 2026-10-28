'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useDialog } from '@/components/ui/useDialog'
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented'

interface ReviewModalProps {
  onClose: () => void
  onSaved: () => void
}

const PERIOD_OPTIONS: SegmentedOption<string>[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const MOOD_OPTIONS: SegmentedOption<string>[] = [
  { value: '1', label: 'Low' },
  { value: '2', label: 'Okay' },
  { value: '3', label: 'Good' },
  { value: '4', label: 'Great' },
]

export function ReviewModal({ onClose, onSaved }: ReviewModalProps) {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose)
  const [periodType, setPeriodType] = useState('daily')
  const [mood, setMood] = useState<string | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [reflection, setReflection] = useState('')
  const [wins, setWins] = useState('')
  const [misses, setMisses] = useState('')
  const [tomorrowTop3, setTomorrowTop3] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fieldCls =
    'w-full rounded-[6px] border border-gold-dim/25 bg-ink px-3 py-2.5 text-sm text-parchment placeholder:text-parchment/30 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'
  const labelCls = 'mb-1.5 block text-xs text-parchment/55'

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
          mood: mood ? parseInt(mood) : null,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/60 p-0 sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="New review" tabIndex={-1} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-[8px] border border-gold-dim/25 bg-surface-solid pb-[env(safe-area-inset-bottom)] sm:pb-0">
        <div className="flex shrink-0 items-center justify-between border-b border-gold-dim/20 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-parchment">New Review</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-md text-parchment/50 transition-colors hover:text-parchment"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4 sm:p-6" data-lenis-prevent>
          <div>
            <label className={labelCls}>Period</label>
            <Segmented options={PERIOD_OPTIONS} value={periodType} onChange={setPeriodType} />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Mood</label>
              <Segmented options={MOOD_OPTIONS} value={mood ?? '2'} onChange={setMood} />
            </div>
            <div>
              <label className={labelCls}>Energy (0–10)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={energy ?? 5}
                  onChange={e => setEnergy(parseInt(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gold-dim/30 accent-gold"
                />
                <span className="w-6 text-center font-mono text-sm text-parchment/80 tabular-nums">{energy ?? 5}</span>
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Reflection</label>
            <textarea value={reflection} onChange={e => setReflection(e.target.value)} className={`${fieldCls} h-20 resize-none`} placeholder="How did this period go?" />
          </div>

          <div>
            <label className={labelCls}>Wins</label>
            <textarea value={wins} onChange={e => setWins(e.target.value)} className={`${fieldCls} h-20 resize-none`} placeholder="What went well?" />
          </div>

          <div>
            <label className={labelCls}>Misses</label>
            <textarea value={misses} onChange={e => setMisses(e.target.value)} className={`${fieldCls} h-20 resize-none`} placeholder="What could have been better?" />
          </div>

          <div>
            <label className={labelCls}>Top 3 priorities (one per line)</label>
            <textarea value={tomorrowTop3} onChange={e => setTomorrowTop3(e.target.value)} className={`${fieldCls} h-20 resize-none`} placeholder={'1.\n2.\n3.'} />
          </div>

          {error && <p className="text-sm text-[#cf8f78]">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-gold-dim/20 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <button onClick={onClose} className="rounded-md px-4 py-2.5 sm:py-2 text-sm text-parchment/70 transition-colors hover:text-parchment">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-gold px-4 py-2.5 sm:py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-glow disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Review'}
          </button>
        </div>
      </div>
    </div>
  )
}