// The assistant's and the scout's view of the web: search, read any page, read feeds.
// Server only. Every fetch goes through `safeUrl`, so a URL the AI picked can
// never reach this server's own network (localhost, private ranges, metadata).

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const TIMEOUT_MS = 12_000

export interface SearchHit { title: string; url: string; snippet: string }
export interface Page { url: string; title: string; text: string; links: { text: string; url: string }[] }
export interface FeedItem { title: string; url: string; date: Date | null; summary: string }

// ── Safety ───────────────────────────────────────────────────────────────────

function privateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase()
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && privateIp(v.slice(7))
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

/** A public http(s) URL, or null. Resolves the host so DNS tricks cannot reach private addresses. */
export async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) return null
  if (isIP(host)) return privateIp(host) ? null : u
  try {
    const addrs = await lookup(host, { all: true })
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null
  } catch { return null }
  return u
}

async function get(url: string, init: RequestInit = {}, ms = TIMEOUT_MS) {
  return fetch(url, { ...init, redirect: 'follow', signal: AbortSignal.timeout(ms), headers: { 'User-Agent': UA, 'Accept-Language': 'en', ...(init.headers || {}) } })
}

// ── Text helpers ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
export function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, k) => ENTITIES[k.toLowerCase()] ?? m)
}
export const stripTags = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/** Readable text of an HTML page, with block breaks kept and chrome (nav, footer, scripts) removed. */
function htmlToText(html: string) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim()
}

function linksOf(html: string, base: string) {
  const out: { text: string; url: string }[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(m[2]).slice(0, 140)
    if (text.length < 12) continue
    let url: string
    try { url = new URL(decode(m[1]), base).toString() } catch { continue }
    if (!/^https?:/.test(url) || seen.has(url)) continue
    seen.add(url)
    out.push({ text, url })
    if (out.length >= 80) break
  }
  return out
}

// ── Search ───────────────────────────────────────────────────────────────────

/** Unwrap DuckDuckGo's redirect links (//duckduckgo.com/l/?uddg=<target>). */
function ddgTarget(href: string) {
  const m = href.match(/[?&]uddg=([^&]+)/)
  try { return m ? decodeURIComponent(m[1]) : href.startsWith('//') ? `https:${href}` : href } catch { return href }
}

/**
 * Web search. Uses Tavily or Brave when their key is set (best results),
 * otherwise DuckDuckGo Lite, which needs no key.
 */
export async function webSearch(query: string, count = 8): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 300)
  if (!q) return []
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await get('https://api.tavily.com/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: q, max_results: count }),
      })
      if (res.ok) {
        const d = await res.json() as { results?: { title: string; url: string; content: string }[] }
        return (d.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: (r.content || '').slice(0, 400) }))
      }
    } catch { /* fall through */ }
  }
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const res = await get(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}`, { headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY, Accept: 'application/json' } })
      if (res.ok) {
        const d = await res.json() as { web?: { results?: { title: string; url: string; description: string }[] } }
        return (d.web?.results ?? []).map((r) => ({ title: stripTags(r.title), url: r.url, snippet: stripTags(r.description || '') }))
      }
    } catch { /* fall through */ }
  }
  // The Lite page: the full HTML endpoint answers server-side fetches with a bot check.
  const res = await get(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}&kl=wt-wt`, { headers: { Accept: 'text/html' } })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const html = await res.text()
  const hits: SearchHit[] = []
  // Each result is a link row followed by its snippet row.
  const parts = html.split(/class=['"]result-link['"]/)
  for (let i = 0; i < parts.length - 1; i++) {
    const href = parts[i].match(/href="([^"]+)"[^>]*$/)?.[1]
    const title = parts[i + 1].match(/^[^>]*>([\s\S]*?)<\/a>/)?.[1]
    if (!href || !title) continue
    const url = ddgTarget(decode(href))
    if (/duckduckgo\.com\/y\.js|bing\.com\/aclick/.test(url) || !/^https?:/.test(url)) continue // ads
    const snip = parts[i + 1].match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/)?.[1]
    hits.push({ title: stripTags(title), url, snippet: snip ? stripTags(snip).slice(0, 400) : '' })
    if (hits.length >= count) break
  }
  return hits
}

// ── Reading pages ────────────────────────────────────────────────────────────

/**
 * Read any public web page as text (plus its links). Pages that need
 * JavaScript come back almost empty, so those are re-read through Jina Reader,
 * which renders them first.
 */
export async function readPage(raw: string, maxChars = 12_000): Promise<Page> {
  const u = await safeUrl(raw)
  if (!u) throw new Error('That address cannot be opened')
  let title = '', text = '', links: Page['links'] = []
  try {
    const res = await get(u.toString(), { headers: { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' } })
    const type = res.headers.get('content-type') || ''
    if (res.ok && /html|text\/plain|xml/.test(type)) {
      const body = (await res.text()).slice(0, 1_500_000)
      if (/html/.test(type)) {
        title = stripTags(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
        const main = body.match(/<(main|article)\b[\s\S]*?<\/\1>/i)?.[0]
        text = htmlToText(main && main.length > 2000 ? main : body)
        links = linksOf(body, res.url || u.toString())
      } else text = body
    }
  } catch { /* try the reader */ }
  if (text.length < 400) {
    try {
      const res = await get(`https://r.jina.ai/${u.toString()}`, { headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' } }, 20_000)
      if (res.ok) {
        const md = await res.text()
        title ||= md.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? ''
        text = md.replace(/^(Title|URL Source|Published Time):.*$/gm, '').replace(/^Markdown Content:\s*/m, '').trim()
        if (!links.length) {
          for (const m of md.matchAll(/\[([^\]]{12,140})\]\((https?:[^)\s]+)\)/g)) { links.push({ text: m[1], url: m[2] }); if (links.length >= 80) break }
        }
      }
    } catch { /* keep what we have */ }
  }
  if (!text) throw new Error('Could not read that page')
  return { url: u.toString(), title: title || u.hostname, text: text.slice(0, maxChars), links }
}

// ── Feeds ────────────────────────────────────────────────────────────────────

function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  for (const m of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const it = m[0]
    const tag = (t: string) => it.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'))?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') ?? ''
    const url = stripTags(tag('link')) || it.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || ''
    const when = tag('pubDate') || tag('published') || tag('updated') || tag('dc:date')
    const d = when ? new Date(stripTags(when)) : null
    items.push({
      title: stripTags(tag('title')),
      url: decode(url.trim()),
      date: d && !isNaN(d.getTime()) ? d : null,
      summary: stripTags(tag('description') || tag('summary') || tag('content:encoded') || tag('content')).slice(0, 700),
    })
  }
  return items.filter((i) => i.title && /^https?:/.test(i.url))
}

/**
 * Items from a site's RSS/Atom feed. Accepts the feed itself or any page of the
 * site: the feed is found from the page's <link rel="alternate"> or at /feed/.
 * Returns null when the site has no feed.
 */
export async function readFeed(raw: string): Promise<FeedItem[] | null> {
  const u = await safeUrl(raw)
  if (!u) return null
  const tryXml = async (url: string) => {
    if (!(await safeUrl(url))) return null
    const res = await get(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.5' } }).catch(() => null)
    if (!res?.ok) return null
    const body = await res.text()
    if (/<(rss|feed)\b/i.test(body.slice(0, 2000))) return { items: parseFeed(body) }
    return { html: body, url: res.url || url }
  }
  const first = await tryXml(u.toString())
  if (first && 'items' in first) return first.items ?? null
  const alt = first?.html?.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)["']/i)?.[1]
  for (const candidate of [alt && new URL(decode(alt), first!.url).toString(), new URL('/feed/', u).toString()].filter(Boolean) as string[]) {
    const r = await tryXml(candidate)
    if (r && 'items' in r && r.items?.length) return r.items
  }
  return null
}
