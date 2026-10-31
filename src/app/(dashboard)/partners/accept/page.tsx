'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button, Page, Panel } from '@/components/ds'

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
    <Page width="narrow" className="flex min-h-[60vh] flex-col items-center justify-center">
      <Panel className="w-full max-w-sm text-center sm:p-8">
        <div aria-live="polite" className="flex flex-col items-center gap-3">
          {state === 'working' && <Loader2 className="h-10 w-10 animate-spin text-gold" strokeWidth={1.5} aria-hidden="true" />}
          {state === 'done' && <CheckCircle2 className="h-10 w-10 text-moss" strokeWidth={1.5} aria-hidden="true" />}
          {state === 'error' && <XCircle className="h-10 w-10 text-ember" strokeWidth={1.5} aria-hidden="true" />}
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold-dim">Partner invitation</p>
          <h1 className="text-h1 text-parchment">
            {state === 'done' ? 'Accountability, activated' : state === 'error' ? 'Invitation issue' : 'One moment…'}
          </h1>
          <p className="text-body text-parchment/60">{message}</p>
        </div>
        {state === 'done' && (
          <Button href="/partners" variant="primary" className="mt-6">
            Open Partners
          </Button>
        )}
      </Panel>
    </Page>
  )
}

export default function PartnerAcceptPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInner />
    </Suspense>
  )
}