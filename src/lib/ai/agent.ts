// The assistant's tool loop (server only): ask the model, run any tools it
// calls, feed the results back, repeat until it answers in words.
import { chat, type ChatMessage } from './llm'
import { toolsFor, type AssistantContext, type ToolCtx } from './tools'

const MAX_STEPS = 6

export interface AgentReply {
  reply: string
  actions: string[]
  changed: boolean
  model: string
}

function systemPrompt(context: AssistantContext, now: Date, tzOffset: number, page?: string) {
  const local = new Date(now.getTime() - tzOffset * 60_000).toISOString().slice(0, 16).replace('T', ' ')
  return [
    'You are the Inchstone assistant inside a personal planning app (Christian productivity: small deeds daily).',
    `The user's local date and time is ${local}. Write dates for tools in their local time as YYYY-MM-DD or YYYY-MM-DDTHH:mm.`,
    context === 'applications'
      ? 'You are on the Application Tracker, where the user tracks scholarships, jobs, schools, grants, fellowships and visas. Help them research what an opportunity needs, check whether they qualify, plan steps, draft essays, cover letters and emails, and keep the tracker up to date with your tools.'
      : 'Help with whatever the user is working on: their plan (year, quarterly quests, monthly milestones, weekly wins, daily deeds), tasks and habits, day scores, reflections and reviews, finances and budgets, calendar, long-term plans, challenge bottles, partners, notes and applications.',
    'You can READ all of the user’s own data with my_data_overview, query_my_data, finance_summary and progress_summary, and you can change applications and notes. Look things up instead of guessing, and quote real numbers and dates from the results. For money totals always use finance_summary; for how the user is doing use progress_summary.',
    page ? `The user is looking at this application right now: ${page}. "This application" or "it" means this one.` : '',
    'Rules:',
    '- Use tools to read before you change anything, and only change what the user asked for. Never invent requirements or deadlines as facts: if you are unsure, say so and suggest the user checks the official page.',
    '- When the user pastes an advert or call for applications, extract the name, organisation, deadline, requirements, documents and steps, then create or update the application.',
    '- After changing data, say in one short sentence what you changed.',
    '- Keep answers short and practical. Use plain text with short lists; no tables.',
    '- For long drafts (essays, letters), offer to save them as a note with create_note.',
    '- You only ever see this user’s own data. If asked about another person’s data, say you can only see theirs.',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function runAgent(opts: {
  userId: string
  context: AssistantContext
  history: { role: 'user' | 'assistant'; content: string }[]
  tzOffset: number
  applicationId?: string
}): Promise<AgentReply> {
  const tools = toolsFor(opts.context)
  const byName = new Map(tools.map((t) => [t.spec.function.name, t]))
  const ctx: ToolCtx = { userId: opts.userId, tzOffset: opts.tzOffset }

  let page: string | undefined
  if (opts.applicationId) {
    const get = byName.get('get_application')
    const found = get ? await get.run({ application: opts.applicationId }, ctx) : null
    if (found && !(found.result as { error?: string }).error) page = JSON.stringify(found.result).slice(0, 6000)
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(opts.context, new Date(), opts.tzOffset, page) },
    ...opts.history.slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })),
  ]

  const actions: string[] = []
  let changed = false
  let model = ''

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await chat(messages, tools.map((t) => t.spec))
    model = res.model
    const msg = res.message
    const calls = msg.tool_calls ?? []
    if (!calls.length) {
      return { reply: (msg.content || '').trim() || 'Done.', actions, changed, model }
    }
    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: calls })
    for (const call of calls) {
      const tool = byName.get(call.function.name)
      let output: unknown
      if (!tool) output = { error: `Unknown tool ${call.function.name}` }
      else {
        try {
          const args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
          const { result, summary } = await tool.run(args, ctx)
          output = result
          if (summary && !(result as { error?: string })?.error) {
            actions.push(summary)
            if (tool.mutates) changed = true
          }
        } catch (e) {
          output = { error: e instanceof Error ? e.message : 'Tool failed' }
        }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(output).slice(0, 12000) })
    }
  }

  return { reply: actions.length ? 'Done.' : 'I could not finish that. Try asking in a simpler way.', actions, changed, model }
}
