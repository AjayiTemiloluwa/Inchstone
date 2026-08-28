import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasVerifiedResendDomain } from '@/lib/email'

/**
 * GET /api/email-status — report whether invite email is actually ready:
 *  · apiKey    — RESEND_API_KEY present?
 *  · domain    — has a verified sending domain?
 *  · from      — the sender being used
 *  · ready     — email will deliver to partners right now
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.RESEND_API_KEY || ''
  const from = process.env.EMAIL_FROM || 'Inchstone <onboarding@resend.dev>'
  const usingDevSender = from.includes('@resend.dev')

  let domain = false
  if (key) {
    try {
      domain = await hasVerifiedResendDomain(key)
    } catch {
      domain = false
    }
  }

  const ready = Boolean(key && (domain || !usingDevSender))

  return NextResponse.json({
    ready,
    apiKey: Boolean(key),
    domain,
    devSender: usingDevSender,
    from,
  })
}