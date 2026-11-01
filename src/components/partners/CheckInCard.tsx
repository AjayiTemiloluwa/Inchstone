'use client'

import { useState } from 'react'
import { Check, Flame, Users } from 'lucide-react'
import { Button, cx, inputClass } from '@/components/ds'

export interface CheckInData {
  today: string
  me: { checkedIn: boolean; mood: number | null; note: string | null; streak: number; best: number; total: number; days: boolean[] }
  partners: { partnerId: string; name: string; checkedIn: boolean; streak: number; together: number; bestTogether: number; days: boolean[] }[]
}

const MOODS = ['😞', '😕', '😐', '🙂', '😄']

/** Fourteen little days: filled when checked in, the last one is today. */
export function DayDots({ days, tone = 'gold' }: { days: boolean[]; tone?: 'gold' | 'moss' }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {days.map((on, i) => (
        <span key={i} className={cx('h-2 w-2 rounded-full', on ? (tone === 'moss' ? 'bg-moss' : 'bg-gold') : 'bg-gold/15', i === days.length - 1 && 'ring-1 ring-parchment/40 ring-offset-1 ring-offset-[var(--surface-solid)]')} />
      ))}
    </span>
  )
}

/**
 * Daily check-in: one tap says "I showed up today". Streaks build from
 * consecutive days; partners you are linked with see your streak, and the two
 * of you share a "together" streak for days you both checked in.
 */
export function CheckInCard({ data, onCheckIn, busy }: { data: CheckInData; onCheckIn: (mood: number | null, note: string) => Promise<void>; busy: boolean }) {
  const [mood, setMood] = useState<number | null>(data.me.mood)
  const [note, setNote] = useState(data.me.note ?? '')
  const [editing, setEditing] = useState(false)
  const { me } = data
  const showForm = !me.checkedIn || editing
  const partnersIn = data.partners.filter((p) => p.checkedIn).length

  return (
    <section aria-label="Daily check-in" className="relative overflow-hidden rounded-2xl border border-gold/20 bg-surface-solid p-5 sm:p-6">
      <span aria-hidden className="hero-orb pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-ember/[0.08] blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className={cx('relative flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-3xl border',
            me.checkedIn ? 'border-ember/40 bg-ember/10' : 'border-gold/20 bg-gold/[0.05]')}>
            <Flame className={cx('h-7 w-7', me.checkedIn ? 'fill-ember/40 text-ember' : 'text-parchment/35')} strokeWidth={1.6} aria-hidden />
            <span className="font-display text-2xl font-bold leading-none tabular-nums text-parchment">{me.streak}</span>
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-parchment/45">Your streak</p>
            <p className="font-display text-xl font-bold text-parchment sm:text-2xl">
              {me.streak === 0 ? 'Start today' : `${me.streak} day${me.streak === 1 ? '' : 's'} in a row`}
            </p>
            <p className="text-caption text-parchment/50">Best {me.best} · {me.total} check-ins</p>
            <div className="mt-2"><DayDots days={me.days} /></div>
          </div>
        </div>

        <div className="min-w-0 flex-1 sm:border-l sm:border-gold/10 sm:pl-6">
          {showForm ? (
            <div className="space-y-3">
              <p className="text-sm text-parchment/75">How did today go?</p>
              <div className="flex gap-1.5">
                {MOODS.map((m, i) => (
                  <button key={m} type="button" onClick={() => setMood(mood === i + 1 ? null : i + 1)} aria-pressed={mood === i + 1} aria-label={`Mood ${i + 1} of 5`}
                    className={cx('flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition-transform active:scale-90',
                      mood === i + 1 ? 'border-gold/60 bg-gold/15' : 'border-gold/10 hover:border-gold/30')}>{m}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="One line for your partners (optional)" aria-label="Check-in note" className={inputClass} />
                <Button variant="primary" icon={Check} disabled={busy} onClick={async () => { await onCheckIn(mood, note); setEditing(false) }}>
                  {me.checkedIn ? 'Update' : 'Check in'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-moss"><Check className="h-4 w-4" strokeWidth={3} /> Checked in today {me.mood ? MOODS[me.mood - 1] : ''}</p>
                {me.note && <p className="mt-1 text-sm text-parchment/70">“{me.note}”</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          )}
          {data.partners.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-caption text-parchment/50">
              <Users className="h-3.5 w-3.5" aria-hidden /> {partnersIn} of {data.partners.length} partner{data.partners.length === 1 ? '' : 's'} checked in today
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
