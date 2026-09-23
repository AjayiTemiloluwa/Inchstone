/* eslint-disable @typescript-eslint/no-explicit-any -- reset panel posts plain JSON */
'use client'

import { useState } from 'react'

const TARGET_EMAIL = 'temiloluwaajayi2019@gmail.com'

export function Q4ResetPanel() {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!confirm('Replace ALL current categories with the 7 Q4 2026 categories + Q4/monthly goals? Old categories and their nested goals will be deleted.')) return
    setBusy(true)
    setStatus('Running Q4 reset…')
    try {
      const res = await fetch('/api/admin/q4-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TARGET_EMAIL }),
      })
      const data: any = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('Failed: ' + (data.error || res.status))
      } else {
        const names = (data.categories || []).map((c: any) => c.title).join(', ')
        setStatus('Done. Deleted ' + data.deletedCats + ' old categories. New: ' + names + ' | Q-objectives: ' + data.q3count + ', Months: ' + data.monthCount + '. Reloading…')
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch (e: any) {
      setStatus('Failed: ' + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-gold/40 p-4 text-sm">
      <p className="font-bold">Q4 2026 Pack reset (one-time)</p>
      <p className="mt-1 text-xs opacity-70">Deletes the former categories, creates the 7 Q4 categories (Spiritual Growth, Academics and Research, Work and Practical Impact, Career and Professional Development, Personal Growth and Leadership, Health/Order/Lifestyle, Financial Stewardship), each with its SMART goal, Q4 objective checklist and Sep/Oct/Nov/Dec monthly goals.</p>
      <button onClick={run} disabled={busy} className="mt-3 rounded-lg bg-gold px-4 py-2 font-bold text-ink disabled:opacity-50">
        {busy ? 'Working…' : 'Apply Q4 2026 Pack'}
      </button>
      {status && <p className="mt-2 text-xs">{status}</p>}
    </div>
  )
}
