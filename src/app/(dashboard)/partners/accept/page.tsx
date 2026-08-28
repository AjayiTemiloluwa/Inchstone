'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

/**
 * /partners/accept — the landing page for the accountability-partner invite
 * email. Validates the invite code, proves the signed-in email matches the
 * invited address, and links both sides.
 */
function AcceptInner() {
  const params = useSearchParams()
  const code = params.get('code')
  const [state, setState] = useState<'working' | 'done' | 'error'>('working')
  const [message, setMessage] = useState('Linking your invitation…')

  useEffect(() => {
    if (!code) {
      setState('error')
      setMessage('This invitation link is missing its code.')
      return
    }
    fetch('/api/partners/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setState('error')
          setMessage(data.error || 'This invitation could not be accepted.')
        } else {
          setState('done')
          setMessage("You're linked! You can now message each other and — with consent — follow each other's progress.")
        }
      })
      .catch(() => {
        setState('error')
        setMessage('Network error — please try the link again.')
      })
  }, [code])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-gold/25 bg-surface-solid p-8">
        {state === 'working' && <Loader2 className="mx-auto h-10 w-10 animate-spin text-gold" />}
        {state === 'done' && <CheckCircle2 className="mx-auto h-10 w-10 text-moss" />}
        {state === 'error' && <XCircle className="mx-auto h-10 w-10 text-ember" />}
        <h1 className="mt-4 font-display text-2xl font-bold text-parchment">
          {state === 'done' ? 'Accountability, activated' : state === 'error' ? 'Invitation issue' : 'One moment…'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-parchment/60">{message}</p>
        {state === 'done' && (
          <Link
            href="/partners"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-gold px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-[#cbaa6f]"
          >
            Open Partners
          </Link>
        )}
      </div>
    </div>
  )
}

export default function PartnerAcceptPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInner />
    </Suspense>
  )
}