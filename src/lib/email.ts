/**
 * Email delivery via the Resend REST API (plain fetch — no SDK needed).
 *
 * Gated by RESEND_API_KEY: without it, sends are logged and skipped so local
 * dev degrades gracefully — in-app nudges and web push still deliver.
 *
 * Tone guard: every template here uses plain, respectful "accountability
 * partner" language — nothing that could be misread as anything else.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const RESEND_DOMAINS_ENDPOINT = 'https://api.resend.com/domains'
const FROM = process.env.EMAIL_FROM || 'Inchstone <onboarding@resend.dev>'
const USING_RESEND_DEV_SENDER = FROM.includes('@resend.dev')

/** Structured email result so the UI can say exactly what went wrong. */
export type EmailResult = {
  ok: boolean
  reason?: 'no_key' | 'sender_not_verified' | 'rejected' | 'error'
  detail?: string
}

let verifiedDomainsCache: { at: number; has: boolean } | null = null

/**
 * Whether this Resend account has at least one verified sending domain.
 * onboarding@resend.dev can ONLY deliver to your own account email — inviting
 * a partner (anyone else) is rejected with 403 until a domain is verified.
 * Cached ~60s so the send path stays cheap.
 */
export async function hasVerifiedResendDomain(key: string): Promise<boolean> {
  if (verifiedDomainsCache && Date.now() - verifiedDomainsCache.at < 60_000) {
    return verifiedDomainsCache.has
  }
  try {
    const res = await fetch(RESEND_DOMAINS_ENDPOINT, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ status?: string }> }
      const has =
        Array.isArray(data?.data) && data.data.some(d => d.status === 'verified')
      verifiedDomainsCache = { at: Date.now(), has }
      return has
    }
  } catch {
    /* fall through to the send attempt — it will reveal the truth */
  }
  verifiedDomainsCache = { at: Date.now(), has: false }
  return false
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info(`[email] RESEND_API_KEY not set — skipped "${opts.subject}" → ${opts.to}`)
    return { ok: false, reason: 'no_key', detail: 'RESEND_API_KEY is not set.' }
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
    })
    if (res.ok) return { ok: true }
    const detail = await res.text().catch(() => '')
    // Classify the common failure: onboarding@resend.dev / unverified domain.
    if (
      res.status === 403 &&
      (USING_RESEND_DEV_SENDER ||
        /verify|own account|testing email/i.test(detail) ||
        !(await hasVerifiedResendDomain(key)))
    ) {
      return { ok: false, reason: 'sender_not_verified', detail }
    }
    return { ok: false, reason: 'rejected', detail }
  } catch (e) {
    console.error('[email] send failed', e)
    return { ok: false, reason: 'error', detail: e instanceof Error ? e.message : 'network error' }
  }
}

const shell = (title: string, body: string) => `
  <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#faf6ee;color:#241e15;border:1px solid #e7decb;border-radius:12px">
    <p style="font-family:monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#96762f;margin:0 0 18px">Inchstone</p>
    <h1 style="font-size:22px;margin:0 0 14px">${title}</h1>
    ${body}
    <p style="font-size:12px;color:#8a7a5c;margin-top:26px">Small deeds, every day — Inchstone</p>
  </div>`

/** The partner has NOT onboarded yet → send a join invite. */
export function invitePartnerEmail(inviterName: string, acceptUrl: string) {
  return {
    subject: `${inviterName} invited you as their accountability partner on Inchstone`,
    html: shell(
      `You've been invited as an accountability partner`,
      `
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">
        <strong>${inviterName}</strong> is using Inchstone to keep their yearly
        goals on track and would like you as their <strong>accountability
        partner</strong> — someone who can see their progress, cheer the wins
        and send the occasional nudge.
      </p>
      <p style="margin:22px 0">
        <a href="${acceptUrl}" style="background:#96762f;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:bold;display:inline-block">View invitation</a>
      </p>
      <p style="font-size:13px;color:#6d5f47;margin:0">Creating an account takes a minute, and you choose exactly what you share back.</p>
      `,
    ),
  }
}

/** Both sides linked → confirmation. */
export function linkedPartnerEmail(meName: string, otherName: string) {
  return {
    subject: `You and ${otherName} are linked as accountability partners on Inchstone`,
    html: shell(
      `Accountability, activated`,
      `
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">
        <strong>${meName}</strong> and <strong>${otherName}</strong> are now
        linked as accountability partners on Inchstone.
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0;color:#4c4232">
        You can message each other, send nudges, and — only with each side's
        explicit consent — follow each other's progress.
      </p>
      `,
    ),
  }
}