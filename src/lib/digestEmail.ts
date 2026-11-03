// The morning opportunity digest, as an email. Table layout with inline styles only, because mail
// clients (Gmail, Outlook, Apple Mail) ignore <style>, flexbox and most modern CSS. One 600px column
// that shrinks on a phone, a hidden preheader line for the inbox preview, and a card per opportunity.

export interface DigestEmailOpp {
  title: string
  url: string
  organization: string | null
  type: string
  location: string | null
  deadline: Date | null
  summary: string | null
  match: number
  matchReason: string | null
  scope: string
}

const C = {
  page: '#efe9dc', card: '#ffffff', ink: '#241e15', soft: '#5c503c', faint: '#8a7a5c', line: '#ece4d2',
  brass: '#96762f', brassDark: '#7a5f24', header: '#1b1710', cream: '#faf6ee',
  good: '#2f7d4f', goodBg: '#e6f3ea', mid: '#96762f', midBg: '#f6edd6', low: '#6d5f47', lowBg: '#efe9dc',
  hot: '#b3402a', hotBg: '#fbe7e1',
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const SERIF = "Georgia,'Times New Roman',serif"

function matchTone(m: number) {
  return m >= 75 ? { fg: C.good, bg: C.goodBg } : m >= 50 ? { fg: C.mid, bg: C.midBg } : { fg: C.low, bg: C.lowBg }
}

function deadlineChip(d: Date | null, now: number) {
  if (!d) return { text: 'No deadline given', fg: C.low, bg: C.lowBg }
  const days = Math.ceil((d.getTime() - now) / 86_400_000)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (days < 0) return { text: `Closed ${date}`, fg: C.low, bg: C.lowBg }
  if (days <= 7) return { text: `${days === 0 ? 'Closes today' : `${days} day${days === 1 ? '' : 's'} left`} · ${date}`, fg: C.hot, bg: C.hotBg }
  return { text: `Deadline ${date}`, fg: C.soft, bg: C.lowBg }
}

const chip = (text: string, fg: string, bg: string) =>
  `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 10px;border-radius:999px;background:${bg};color:${fg};font-family:${FONT};font-size:12px;line-height:18px;font-weight:600">${esc(text)}</span>`

function card(o: DigestEmailOpp, now: number) {
  const t = matchTone(o.match)
  const dl = deadlineChip(o.deadline, now)
  const meta = [o.organization, o.location].filter(Boolean).join(' · ')
  return `
  <tr><td style="padding:0 0 12px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:14px">
      <tr><td style="padding:18px 18px 16px 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" style="font-family:${SERIF};font-size:18px;line-height:24px;font-weight:bold;color:${C.ink}">
            <a href="${esc(o.url)}" style="color:${C.ink};text-decoration:none">${esc(o.title)}</a>
          </td>
          <td valign="top" align="right" width="72" style="padding-left:12px">
            <div style="display:inline-block;min-width:56px;text-align:center;padding:6px 8px;border-radius:12px;background:${t.bg}">
              <div style="font-family:${FONT};font-size:18px;line-height:20px;font-weight:700;color:${t.fg}">${o.match}%</div>
              <div style="font-family:${FONT};font-size:10px;line-height:12px;letter-spacing:0.08em;text-transform:uppercase;color:${t.fg}">match</div>
            </div>
          </td>
        </tr></table>
        ${meta ? `<div style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.faint};padding-top:4px">${esc(meta)}</div>` : ''}
        <div style="padding-top:10px">${chip(o.type, C.brassDark, C.midBg)}${chip(dl.text, dl.fg, dl.bg)}</div>
        ${o.summary ? `<div style="font-family:${FONT};font-size:14px;line-height:21px;color:${C.soft};padding-top:2px">${esc(o.summary)}</div>` : ''}
        ${o.matchReason ? `<div style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.brass};padding-top:8px"><strong>Why it fits:</strong> ${esc(o.matchReason)}</div>` : ''}
        <div style="padding-top:14px"><a href="${esc(o.url)}" style="font-family:${FONT};font-size:14px;font-weight:600;color:${C.brass};text-decoration:none">Open the opportunity &rarr;</a></div>
      </td></tr>
    </table>
  </td></tr>`
}

function section(label: string, hint: string, list: DigestEmailOpp[], now: number) {
  if (!list.length) return ''
  return `
  <tr><td style="padding:22px 0 12px 0">
    <span style="font-family:${SERIF};font-size:20px;line-height:26px;font-weight:bold;color:${C.ink}">${label}</span>
    <span style="font-family:${FONT};font-size:13px;color:${C.faint}">&nbsp;&nbsp;${list.length} · ${hint}</span>
  </td></tr>
  ${list.map((o) => card(o, now)).join('')}`
}

export function digestEmailHtml(input: { name?: string | null; opps: DigestEmailOpp[]; reviewUrl: string; schedule: string; now?: number }) {
  const now = input.now ?? Date.now()
  const { opps, reviewUrl } = input
  const local = opps.filter((o) => o.scope === 'local')
  const global = opps.filter((o) => o.scope !== 'local')
  const best = Math.max(...opps.map((o) => o.match))
  const soon = opps.filter((o) => o.deadline && o.deadline.getTime() - now > 0 && o.deadline.getTime() - now <= 7 * 86_400_000).length
  const first = (input.name || '').trim().split(/\s+/)[0]
  const stat = (n: string, label: string) => `
    <td align="center" style="padding:14px 6px">
      <div style="font-family:${SERIF};font-size:26px;line-height:30px;font-weight:bold;color:${C.ink}">${n}</div>
      <div style="font-family:${FONT};font-size:11px;line-height:14px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint}">${label}</div>
    </td>`
  const preheader = `${opps.length} new ${opps.length === 1 ? 'opportunity' : 'opportunities'} waiting for your review. Best match ${best}%.`

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Opportunity Scout</title></head>
<body style="margin:0;padding:0;background:${C.page}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.page}">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

      <tr><td style="background:${C.header};border-radius:18px 18px 0 0;padding:26px 24px 22px 24px">
        <div style="font-family:${FONT};font-size:11px;line-height:14px;letter-spacing:0.24em;text-transform:uppercase;color:#d4b25f">Inchstone &middot; Opportunity Scout</div>
        <div style="font-family:${SERIF};font-size:28px;line-height:34px;font-weight:bold;color:#faf6ee;padding-top:10px">${first ? `Good morning, ${esc(first)}.` : 'Good morning.'}</div>
        <div style="font-family:${FONT};font-size:15px;line-height:22px;color:#d9cfb8;padding-top:6px">${opps.length} new ${opps.length === 1 ? 'opportunity' : 'opportunities'} found for you, best fit first.</div>
      </td></tr>

      <tr><td style="background:${C.cream};padding:0 24px 8px 24px;border-radius:0 0 18px 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:14px;margin-top:-1px"><tr>
          ${stat(String(local.length), 'Local')}${stat(String(global.length), 'Global')}${stat(`${best}%`, 'Best match')}${stat(String(soon), 'Closing soon')}
        </tr></table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:22px 0 4px 0">
          <a href="${esc(reviewUrl)}" style="display:inline-block;background:${C.brass};color:#ffffff;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px">Review and approve</a>
          <div style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.faint};padding-top:10px">Approve all, one by one, or only the ones you pick.</div>
        </td></tr></table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${section('Local', 'close to home', local, now)}
          ${section('Global', 'worldwide', global, now)}
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:10px 0 22px 0">
          <a href="${esc(reviewUrl)}" style="display:inline-block;border:2px solid ${C.brass};color:${C.brass};font-family:${FONT};font-size:15px;line-height:18px;font-weight:700;text-decoration:none;padding:11px 26px;border-radius:12px">See all in Opportunity Scout</a>
        </td></tr></table>
      </td></tr>

      <tr><td align="center" style="padding:18px 12px 6px 12px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint}">
        Schedule: ${esc(input.schedule)}.<br>Change what is sent and when on the Application Tracker or Opportunity Scout page.<br>
        <span style="font-family:${SERIF};font-style:italic">Small deeds, every day &mdash; Inchstone</span>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}
