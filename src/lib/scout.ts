// Opportunity Scout: finds scholarships, jobs, fellowships, grants and more for
// one user, from opportunity feeds, the user's own sites and web searches built
// from their interests. The AI reads each candidate, classifies it local or
// global, scores the fit, and drops anything closed or irrelevant.

import prisma from '@/lib/prisma'
import { chat } from '@/lib/ai/llm'
import { parseJson } from '@/lib/learning'
import { APPLICATION_TYPES, DEFAULT_ITEM_STATUS, starterItemsFor } from '@/lib/applications'
import { readFeed, readPage, webSearch } from '@/lib/web'
import { sendEmail } from '@/lib/email'
import { describeSchedule, digestSelection } from '@/lib/digest'

/** Opportunity sites with reliable RSS feeds, read when "built-in sources" is on. */
export const BUILT_IN_SOURCES = [
  { name: 'Opportunity Desk', url: 'https://opportunitydesk.org/feed/' },
  { name: 'Opportunities for Africans', url: 'https://www.opportunitiesforafricans.com/feed/' },
  { name: 'Scholars4Dev', url: 'https://www.scholars4dev.com/feed/' },
  { name: 'Opportunities Corners', url: 'https://opportunitiescorners.com/feed/' },
]

const TYPES: string[] = APPLICATION_TYPES.map((t) => t.value)

export async function scoutProfile(userId: string) {
  return (await prisma.scoutProfile.findUnique({ where: { userId } }))
    ?? prisma.scoutProfile.create({ data: { userId } })
}

interface Candidate { title: string; url: string; text: string; source: string; date?: Date | null }
interface Judged {
  n: number; keep: boolean; title?: string; organization?: string; type?: string; scope?: string; location?: string
  deadline?: string | null; value?: string; summary?: string; eligibility?: string; match?: number; reason?: string
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2)

/** Rough relevance before the AI sees anything, so the best candidates go first. */
function prescore(c: Candidate, keys: string[]) {
  const hay = `${c.title} ${c.text}`.toLowerCase()
  return keys.reduce((n, k) => n + (hay.includes(k) ? 1 : 0), 0) + (c.date ? Math.max(0, 3 - (Date.now() - c.date.getTime()) / 86_400_000 / 3) : 0)
}

function queriesFor(interests: string, types: string[], country: string) {
  const year = new Date().getFullYear()
  const topics = interests.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
  const kinds = types.slice(0, 3).join(' OR ') || 'opportunities'
  const qs = topics.map((t) => `${t} ${kinds} ${year} apply deadline`)
  qs.push(`${types.includes('scholarship') ? 'fully funded scholarships' : kinds} for ${country} ${year} ${year + 1} apply`)
  if (topics[0]) qs.push(`${topics[0]} opportunities in ${country} ${year} application open`)
  return qs.slice(0, 4)
}

async function judge(batch: Candidate[], p: { interests: string; homeCountry: string; types: string[] }): Promise<Judged[]> {
  const today = new Date().toISOString().slice(0, 10)
  const list = batch.map((c, i) => `#${i + 1} ${c.title}\nURL: ${c.url}\n${c.text.slice(0, 350)}`).join('\n\n')
  const reply = await chat([
    {
      role: 'system',
      content: `You screen opportunities (scholarships, jobs, internships, fellowships, grants, competitions, school admissions, conferences) for one person. Today is ${today}.
Person: lives in ${p.homeCountry}. Interests: ${p.interests || 'not given; judge general usefulness'}. Wants: ${p.types.join(', ')}.
For each numbered candidate decide if it is ONE specific, real opportunity that is still open (deadline today or later, or not stated), and not a list/roundup article, ad or news story. Reply with JSON only:
{"items":[{"n":1,"keep":true,"title":"official name","organization":"who offers it","type":"one of ${TYPES.join('|')}","scope":"local if it is in or only for ${p.homeCountry}, otherwise global","location":"city/country or Remote","deadline":"YYYY-MM-DD or null","value":"what it is worth, short","summary":"one sentence","eligibility":"who can apply, short","match":0-100,"reason":"why it fits or not, under 15 words"}]}
Use only facts in the text; leave a field out when unknown. Set keep false for closed, irrelevant or roundup items.`,
    },
    { role: 'user', content: list },
  ], undefined, { maxTokens: 2400 })
  const out = parseJson<{ items?: Judged[] } | Judged[]>(reply.message.content || '')
  return (Array.isArray(out) ? out : out?.items ?? []).filter((j) => j && typeof j.n === 'number')
}

/**
 * One scouting run for one user. Stays inside `budgetMs` (serverless time
 * limits), saving whatever it has judged so far.
 */
export async function runScout(userId: string, budgetMs = 50_000) {
  const started = Date.now()
  const left = () => budgetMs - (Date.now() - started)
  const p = await scoutProfile(userId)
  const types = p.types.split(',').map((t) => t.trim()).filter(Boolean)
  const userSources = ((p.sources as unknown as string[]) ?? []).filter((s) => typeof s === 'string')
  const known = new Set((await prisma.opportunity.findMany({ where: { userId }, select: { url: true } })).map((o) => o.url))
  const fresh = (url: string) => !known.has(url)
  const since = Date.now() - (p.lastRunAt ? 10 : 21) * 86_400_000
  const cands: Candidate[] = []
  const notes: string[] = []

  // 1. Feeds and the user's sites, all at once.
  const feeds = [...(p.builtIn ? BUILT_IN_SOURCES : []), ...userSources.map((u) => ({ name: (() => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } })(), url: u }))]
  await Promise.all(feeds.map(async (f) => {
    try {
      const items = await readFeed(f.url)
      if (items?.length) {
        for (const it of items) if ((!it.date || it.date.getTime() >= since) && fresh(it.url)) cands.push({ title: it.title, url: it.url, text: it.summary, source: f.name, date: it.date })
        return
      }
      // No feed: read the page and treat its links as listings.
      const page = await readPage(f.url, 4000)
      for (const l of page.links.slice(0, 40)) if (fresh(l.url) && l.url !== page.url) cands.push({ title: l.text, url: l.url, text: '', source: f.name })
    } catch { notes.push(`${f.name} could not be read`) }
  }))

  // 2. Web searches shaped by the user's interests.
  if (left() > 25_000) {
    const hits = await Promise.all(queriesFor(p.interests, types, p.homeCountry).map((q) => webSearch(q, 8).catch(() => [])))
    for (const h of hits.flat()) if (fresh(h.url)) cands.push({ title: h.title, url: h.url, text: h.snippet, source: 'Web search' })
  }

  // 3. Best first, deduped, then the AI judges them in parallel batches.
  const keys = words(`${p.interests} ${types.join(' ')} ${p.homeCountry}`)
  const seen = new Set<string>()
  const ranked = cands
    .filter((c) => { const k = c.url.replace(/[?#].*$/, '').replace(/\/$/, ''); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => prescore(b, keys) - prescore(a, keys))
    .slice(0, 32)
  const batches: Candidate[][] = []
  for (let i = 0; i < ranked.length; i += 8) batches.push(ranked.slice(i, i + 8))

  let added = 0
  const now = new Date()
  await Promise.all(batches.map(async (batch) => {
    if (left() < 12_000) return
    let judged: Judged[] = []
    try { judged = await judge(batch, { interests: p.interests, homeCountry: p.homeCountry, types }) } catch { notes.push('the AI was busy for one batch'); return }
    const rows = judged
      .filter((j) => j.keep && batch[j.n - 1])
      .map((j) => {
        const c = batch[j.n - 1]
        const deadline = j.deadline && /^\d{4}-\d{2}-\d{2}/.test(j.deadline) ? new Date(`${j.deadline.slice(0, 10)}T23:59:00Z`) : null
        return {
          userId, url: c.url.slice(0, 1000), source: c.source,
          title: String(j.title || c.title).slice(0, 200),
          organization: j.organization ? String(j.organization).slice(0, 160) : null,
          type: TYPES.includes(String(j.type)) ? String(j.type) : 'other',
          scope: j.scope === 'local' ? 'local' : 'global',
          location: j.location ? String(j.location).slice(0, 160) : null,
          deadline: deadline && !isNaN(deadline.getTime()) ? deadline : null,
          value: j.value ? String(j.value).slice(0, 200) : null,
          summary: j.summary ? String(j.summary).slice(0, 600) : null,
          eligibility: j.eligibility ? String(j.eligibility).slice(0, 600) : null,
          match: Math.max(0, Math.min(100, Math.round(Number(j.match) || 50))),
          matchReason: j.reason ? String(j.reason).slice(0, 200) : null,
        }
      })
      .filter((r) => !r.deadline || r.deadline >= now)
    if (rows.length) added += (await prisma.opportunity.createMany({ data: rows, skipDuplicates: true })).count
  }))

  const note = `Checked ${ranked.length} of ${cands.length} leads from ${feeds.length} sites and the web; ${added} new.${notes.length ? ` Note: ${[...new Set(notes)].slice(0, 3).join('; ')}.` : ''}`
  await prisma.scoutProfile.update({ where: { userId }, data: { lastRunAt: new Date(), lastRunNote: note } })
  return { added, checked: ranked.length, leads: cands.length, note }
}

/** Approve: copy each opportunity into the Application Tracker with a starter checklist. */
export async function approveOpportunities(userId: string, ids: string[]) {
  const opps = await prisma.opportunity.findMany({ where: { userId, id: { in: ids }, status: { not: 'approved' } } })
  for (const o of opps) {
    const app = await prisma.application.create({
      data: {
        userId, title: o.title, organization: o.organization, type: o.type, url: o.url, location: o.location,
        value: o.value, deadline: o.deadline, status: 'researching', priority: o.match >= 75 ? 'high' : 'medium',
        summary: [o.summary, o.eligibility && `Who can apply: ${o.eligibility}`].filter(Boolean).join('\n\n') || null,
        whyApply: o.matchReason,
      },
    })
    await prisma.applicationItem.createMany({
      data: starterItemsFor(o.type as Parameters<typeof starterItemsFor>[0]).map((s, i) => ({ applicationId: app.id, userId, kind: s.kind, label: s.label, status: DEFAULT_ITEM_STATUS[s.kind], order: i })),
    })
    await prisma.opportunity.update({ where: { id: o.id }, data: { status: 'approved', applicationId: app.id } })
  }
  return opps.length
}

// ── Morning preview email ────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const appUrl = () => process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

/**
 * Email the user their digest: the opportunities waiting for review that pass
 * their digest settings (match, local/global, types, how many), grouped Local
 * and Global, best match first. The settings preview uses the same selection.
 */
export async function sendDigest(userId: string) {
  const [profile, settings] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { email: true, name: true } }),
    scoutProfile(userId),
  ])
  if (!profile?.email) return { ok: false, reason: 'No email address on this account' }
  const all = await prisma.opportunity.findMany({ where: { userId, status: 'new', emailSkip: false } })
  const opps = digestSelection(settings, all)
  if (!opps.length) return { ok: false, reason: 'Nothing matches your digest settings right now' }
  const review = `${appUrl()}/challenge/opportunities`
  const row = (o: (typeof opps)[number]) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #e7decb">
      <a href="${esc(o.url)}" style="color:#241e15;font-weight:bold;font-size:15px;text-decoration:none">${esc(o.title)}</a>
      <div style="font-size:12px;color:#8a7a5c;margin-top:3px">${esc([o.organization, o.type, o.location, o.deadline ? `Deadline ${o.deadline.toISOString().slice(0, 10)}` : 'No deadline given'].filter(Boolean).join(' · '))}</div>
      ${o.summary ? `<div style="font-size:13px;color:#4b4030;margin-top:5px;line-height:1.5">${esc(o.summary)}</div>` : ''}
      <div style="font-size:12px;color:#96762f;margin-top:4px">${o.match}% match${o.matchReason ? ` · ${esc(o.matchReason)}` : ''}</div>
    </td></tr>`
  const group = (label: string, list: typeof opps) => list.length ? `<h2 style="font-size:16px;margin:22px 0 4px">${label} · ${list.length}</h2><table style="width:100%;border-collapse:collapse">${list.map(row).join('')}</table>` : ''
  const local = opps.filter((o) => o.scope === 'local'), global = opps.filter((o) => o.scope !== 'local')
  const html = `
    <div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;padding:28px 22px;background:#faf6ee;color:#241e15;border:1px solid #e7decb;border-radius:12px">
      <p style="font-family:monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#96762f;margin:0 0 14px">Inchstone · Opportunity Scout</p>
      <h1 style="font-size:22px;margin:0 0 8px">${opps.length} new ${opps.length === 1 ? 'opportunity' : 'opportunities'} for you</h1>
      <p style="font-size:14px;color:#4b4030;margin:0 0 6px">Review them and choose which go into your Application Tracker: approve all, one by one, or just the ones you pick.</p>
      <p style="margin:18px 0"><a href="${review}" style="background:#96762f;color:#fff;text-decoration:none;padding:11px 24px;border-radius:10px;font-weight:bold;display:inline-block">Review and approve</a></p>
      ${group('Local', local)}${group('Global', global)}
      <p style="font-size:12px;color:#8a7a5c;margin-top:24px">Schedule: ${esc(describeSchedule(settings))}. Change what is sent and when on the Application Tracker or Opportunity Scout page.</p>
    </div>`
  const res = await sendEmail({ to: profile.email, subject: `${opps.length} new opportunities to review`, html })
  if (res.ok) await prisma.opportunity.updateMany({ where: { id: { in: opps.map((o) => o.id) } }, data: { emailedAt: new Date() } })
  return res.ok ? { ok: true, sent: opps.length, to: profile.email } : { ok: false, reason: res.reason === 'sender_not_verified' ? 'The email sender is not verified for this address yet' : res.detail || 'Email failed' }
}
