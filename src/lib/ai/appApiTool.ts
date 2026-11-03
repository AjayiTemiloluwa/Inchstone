// The "do anything the user can do" tools: call any of Inchstone's own API routes in-process,
// exactly as the page would. Every handler reads the user from the Clerk session of the chat
// request (never from the model), so the same ownership checks, validation, score recalculation,
// notification re-arming and calendar sync apply as when the user clicks.
//
// The registry and the endpoint catalog are generated from the route files:
//   node scripts/gen-ai-api-registry.js
import { APP_API_CATALOG, APP_ROUTES } from './appApi.generated'
import type { Tool } from './tools'
import type { ToolSpec } from './llm'

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const compiled = APP_ROUTES.map((r) => {
  const names: string[] = []
  const re = new RegExp('^' + r.pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)' }) + '$')
  return { ...r, re, names }
})

function resolve(path: string, method: string) {
  // Longest literal route wins, so /api/habits/overview is never read as a dynamic segment.
  const matches = compiled
    .map((r) => ({ r, m: r.re.exec(path) }))
    .filter((x): x is { r: (typeof compiled)[number]; m: RegExpExecArray } => !!x.m && x.r.methods.includes(method))
    .sort((a, b) => a.r.names.length - b.r.names.length)
  const hit = matches[0]
  if (!hit) return null
  const params: Record<string, string> = {}
  hit.r.names.forEach((n, i) => { params[n] = decodeURIComponent(hit.m[i + 1]) })
  return { handler: hit.r.mod[method] as Handler, params }
}

const spec = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolSpec => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
})

export const APP_API_TOOLS: Tool[] = [
  {
    mutates: false,
    spec: spec('find_app_endpoints', 'Look up which Inchstone API endpoints exist for something the user wants done (a page, feature or noun), with their query params and body fields. Use before call_app_api when no dedicated tool fits.', {
      search: { type: 'string', description: 'Words like "habit", "purse", "plan goal", "tracker", "review", "partner", "learning"' },
    }, ['search']),
    async run(a) {
      const words = String(a.search ?? '').toLowerCase().split(/\s+/).filter(Boolean)
      const lines = APP_API_CATALOG.filter((l) => words.every((w) => l.toLowerCase().includes(w)))
      const any = lines.length ? lines : APP_API_CATALOG.filter((l) => words.some((w) => l.toLowerCase().includes(w)))
      return { result: { endpoints: any.slice(0, 40), note: 'Fields in {} are the JSON body; ?x are query params; :id is a path segment.' } }
    },
  },
  {
    mutates: true,
    spec: spec('call_app_api', 'Do anything the user can do in the app by calling one of its own API endpoints, as if they clicked it. Use the dedicated tools (add_deed, update_deed, log_money…) when one fits; use this for everything else: habits, plans, goals, milestones, trackers, reviews, partners, nudges, budgets, purses, categories, bottles, learning, items (year/quarter/month/week/day), calendar. Look endpoints up with find_app_endpoints. DELETE needs confirmed=true after the user clearly said yes.', {
      method: { type: 'string', enum: [...METHODS], description: 'HTTP method' },
      path: { type: 'string', description: 'Endpoint path, e.g. /api/habits or /api/plan-goals/abc123. Query string allowed.' },
      body: { type: 'object', description: 'JSON body for POST/PUT/PATCH/DELETE', additionalProperties: true },
      confirmed: { type: 'boolean', description: 'Required true for DELETE, only after the user said yes in this conversation' },
    }, ['method', 'path']),
    async run(a) {
      const method = String(a.method ?? '').toUpperCase()
      const raw = String(a.path ?? '')
      if (!(METHODS as readonly string[]).includes(method)) return { result: { error: 'method must be GET, POST, PUT, PATCH or DELETE' } }
      if (!raw.startsWith('/api/')) return { result: { error: 'path must start with /api/' } }
      const [pathname, query] = raw.split('?')
      const found = resolve(pathname.replace(/\/+$/, ''), method)
      if (!found) return { result: { error: `No ${method} endpoint at ${pathname}. Use find_app_endpoints to see what exists.` } }
      if (method === 'DELETE' && a.confirmed !== true) {
        return { result: { error: 'Deleting needs the user’s clear yes in this conversation. Ask them, then call again with confirmed=true.' } }
      }
      const hasBody = method !== 'GET' && a.body !== undefined && a.body !== null
      const req = new Request(`http://inchstone.internal${pathname}${query ? `?${query}` : ''}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: hasBody ? JSON.stringify(a.body) : undefined,
      })
      const res = await found.handler(req, { params: Promise.resolve(found.params) })
      const text = await res.text()
      let data: unknown = text
      try { data = JSON.parse(text) } catch { /* not JSON */ }
      if (!res.ok) return { result: { error: (data as { error?: string })?.error || `Request failed (${res.status})`, status: res.status } }
      return method === 'GET'
        ? { result: data }
        : { result: { ok: true, data }, summary: `${method} ${pathname}` }
    },
  },
]
