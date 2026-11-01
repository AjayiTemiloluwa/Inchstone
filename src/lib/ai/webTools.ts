// Web tools for the assistant: search the internet, open any page, and run the
// Opportunity Scout. Reading the web never changes the user's data.
import prisma from '@/lib/prisma'
import { readPage, webSearch } from '@/lib/web'
import { runScout } from '@/lib/scout'
import type { ToolSpec } from './llm'
import type { Tool } from './tools'

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolSpec => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
})

export const WEB_TOOLS: Tool[] = [
  {
    spec: fn('web_search', 'Search the internet. Returns titles, links and snippets. Use it for anything current: opportunities, deadlines, requirements, news, prices. Then open the best links with read_webpage.', {
      query: { type: 'string', description: 'What to search for, e.g. "Chevening scholarship 2027 deadline eligibility"' },
    }, ['query']),
    mutates: false,
    run: async (a) => {
      const hits = await webSearch(String(a.query || ''), 8)
      return { result: hits.length ? { results: hits } : { error: 'No results. Try different words.' }, summary: `Searched the web: ${String(a.query).slice(0, 60)}` }
    },
  },
  {
    spec: fn('read_webpage', 'Open any public web page and read its text and links: official opportunity pages, application portals, job adverts, articles. Follow links from the result to go deeper.', {
      url: { type: 'string', description: 'Full https:// address' },
    }, ['url']),
    mutates: false,
    run: async (a) => {
      try {
        const page = await readPage(String(a.url || ''), 9000)
        return { result: { url: page.url, title: page.title, text: page.text, links: page.links.slice(0, 30) }, summary: `Read ${page.title.slice(0, 60)}` }
      } catch (e) {
        return { result: { error: e instanceof Error ? e.message : 'Could not open the page' } }
      }
    },
  },
  {
    spec: fn('find_opportunities', 'Run the Opportunity Scout now: it checks opportunity sites, the user\'s own sites and web searches from their interests, and lists new finds for the user to approve on the Opportunity Scout page. Use list_opportunities to show what it found.', {}),
    mutates: true,
    run: async (_a, ctx) => {
      const r = await runScout(ctx.userId, 45_000)
      return { result: r, summary: `Scouted: ${r.added} new opportunities` }
    },
  },
  {
    spec: fn('list_opportunities', 'Opportunities the scout found for the user, best match first. status new = waiting for approval.', {
      status: { type: 'string', enum: ['new', 'approved', 'dismissed'], description: 'Default new' },
      scope: { type: 'string', enum: ['local', 'global'], description: 'Only local or only global' },
    }),
    mutates: false,
    run: async (a, ctx) => {
      const rows = await prisma.opportunity.findMany({
        where: { userId: ctx.userId, status: typeof a.status === 'string' ? a.status : 'new', ...(a.scope === 'local' || a.scope === 'global' ? { scope: a.scope } : {}) },
        orderBy: [{ match: 'desc' }, { deadline: 'asc' }],
        take: 30,
        select: { id: true, title: true, organization: true, type: true, scope: true, location: true, deadline: true, value: true, summary: true, match: true, matchReason: true, url: true },
      })
      return { result: { count: rows.length, opportunities: rows } }
    },
  },
]
