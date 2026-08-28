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
const FROM = process.env.EMAIL_FROM || 'Inchstone <onboarding@resend.dev>'

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info(`[email] RESEND_API_KEY not set — skipped "${opts.subject}" → ${opts.to}`)
    return false
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
      console.error('[email] Resend error', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error('[email] send failed', e)
    return false
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