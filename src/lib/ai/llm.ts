// Free-model LLM client with failover (server only).
//
// Keys:   OPENROUTER_API_KEYS  comma-separated; OPENROUTER_API_KEY also read.
// Models: OPENROUTER_MODELS    optional comma-separated preference list. When
//         unset, the live OpenRouter catalogue is read (cached for an hour) and
//         every free model that supports tool calling is used, best first,
//         ending with the `openrouter/free` router.
// Last resort: GEMINI_API_KEY through Google's OpenAI-compatible endpoint.
//
// Every call walks model × key until one answers. A key that is rejected or
// out of credit rests for 10 minutes; a model that is down or cannot call
// tools rests for 30. Requests rotate the starting key so load spreads out.

export type Role = 'system' | 'user' | 'assistant' | 'tool'

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: Role
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface ChatResult {
  message: ChatMessage
  model: string
  provider: 'openrouter' | 'gemini' | 'groq'
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
/** Groq models that handle tools, best first. */
const GROQ_MODELS = (process.env.GROQ_MODELS || 'openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b').split(',').map((m) => m.trim()).filter(Boolean)
const TIMEOUT_MS = 28_000
const KEY_REST_MS = 10 * 60_000
const MODEL_REST_MS = 30 * 60_000

/** Free models known to handle tools well, tried first when present in the catalogue. */
const PREFERRED = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'thinkingmachines/inkling:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'thinkingmachines/inkling-small:free',
]
const ROUTER = 'openrouter/free'

const resting = new Map<string, number>() // "key:<i>" | "model:<id>" → until (ms)
let rotation = 0
let catalogue: { at: number; models: string[] } | null = null

const isResting = (k: string) => (resting.get(k) ?? 0) > Date.now()
const rest = (k: string, ms: number) => resting.set(k, Date.now() + ms)

export function openRouterKeys(): string[] {
  const raw = [process.env.OPENROUTER_API_KEYS, process.env.OPENROUTER_API_KEY].filter(Boolean).join(',')
  return [...new Set(raw.split(',').map((k) => k.trim()).filter(Boolean))]
}

export function groqKeys(): string[] {
  return [...new Set((process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map((k) => k.trim()).filter(Boolean))]
}

export function aiConfigured(): boolean {
  return groqKeys().length > 0 || openRouterKeys().length > 0 || !!process.env.GEMINI_API_KEY
}

async function freeModels(): Promise<string[]> {
  const pinned = (process.env.OPENROUTER_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean)
  if (pinned.length) return pinned
  if (catalogue && Date.now() - catalogue.at < 60 * 60_000) return catalogue.models
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(8000) })
    const { data } = (await res.json()) as {
      data: { id: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[] }[]
    }
    const free = data.filter(
      (m) =>
        Number(m.pricing?.prompt) === 0 &&
        Number(m.pricing?.completion) === 0 &&
        (m.supported_parameters ?? []).includes('tools') &&
        m.id !== ROUTER,
    )
    const rank = (id: string) => {
      const i = PREFERRED.indexOf(id)
      return i === -1 ? PREFERRED.length : i
    }
    free.sort((a, b) => rank(a.id) - rank(b.id) || (b.context_length ?? 0) - (a.context_length ?? 0))
    const models = [...free.map((m) => m.id), ROUTER]
    catalogue = { at: Date.now(), models }
    return models
  } catch {
    return catalogue?.models ?? [...PREFERRED, ROUTER]
  }
}

class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function post(url: string, key: string, body: unknown, extraHeaders: Record<string, string> = {}, signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new ProviderError(0, e instanceof Error ? e.message : 'network error')
  }
  const text = await res.text()
  let json: { choices?: { message?: ChatMessage }[]; error?: { message?: string; code?: number } } = {}
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON error page */
  }
  // OpenRouter can answer 200 with an error body when the upstream fails.
  if (!res.ok || json.error) throw new ProviderError(json.error?.code ?? res.status, json.error?.message || text.slice(0, 300))
  const message = json.choices?.[0]?.message
  if (!message || (!message.content && !message.tool_calls?.length)) throw new ProviderError(502, 'empty response')
  return message
}

/** How long a failure benches a key or model, by what went wrong. */
function bench(err: ProviderError, keyIndex: number, model: string) {
  const msg = err.message.toLowerCase()
  if (err.status === 401 || err.status === 402 || err.status === 403) return rest(`key:${keyIndex}`, KEY_REST_MS)
  if (err.status === 429) {
    // A daily free-model cap is key-wide; a per-minute burst only needs a breather.
    if (/per-day|per day|daily/.test(msg)) return rest(`key:${keyIndex}`, 60 * 60_000)
    return rest(`pair:${keyIndex}:${model}`, 60_000)
  }
  if (err.status === 404 || (err.status === 400 && /tool|function/.test(msg))) return rest(`model:${model}`, MODEL_REST_MS)
  // Timeouts, 5xx, empty replies: likely momentary.
  rest(`model:${model}`, 2 * 60_000)
}

const HEDGE_AFTER_MS = 9_000 // start a backup request if the first is this slow
const MAX_IN_FLIGHT = 3
const DEADLINE_MS = 48_000 // keep inside the 60s function limit

export async function chat(messages: ChatMessage[], tools?: ToolSpec[], opts: { maxTokens?: number } = {}): Promise<ChatResult> {
  const maxTokens = opts.maxTokens ?? 1400
  const keys = openRouterKeys()
  const errors: string[] = []

  // Groq first: fast, and its limit is separate from OpenRouter's. Any failure falls through.
  const gk = groqKeys()
  for (const model of GROQ_MODELS) {
    if (!gk.length) break
    if (isResting(`groq:model:${model}`)) continue
    const key = gk[rotation++ % gk.length]
    try {
      const message = await post(GROQ_URL, key, { model, messages, ...(tools?.length ? { tools, tool_choice: 'auto' } : {}), temperature: 0.4, max_tokens: maxTokens })
      return { message, model, provider: 'groq' }
    } catch (e) {
      const err = e as ProviderError
      errors.push(`groq ${model}: ${err.status} ${err.message.slice(0, 100)}`)
      // A daily cap rests the model for an hour; a burst limit or odd reply only briefly.
      rest(`groq:model:${model}`, err.status === 429 && /day|daily/i.test(err.message) ? 60 * 60_000 : err.status === 401 ? KEY_REST_MS : 2 * 60_000)
    }
  }

  if (keys.length) {
    const models = (await freeModels()).filter((m) => !isResting(`model:${m}`))
    if (!models.includes(ROUTER)) models.push(ROUTER)
    const start = rotation++ % keys.length
    // Every (model, key) pair, best model first, keys rotated so load spreads.
    const pairs: { model: string; ki: number }[] = []
    for (const model of models) for (let n = 0; n < keys.length; n++) pairs.push({ model, ki: (start + n) % keys.length })

    const deadline = Date.now() + DEADLINE_MS
    const controller = new AbortController()
    let next = 0
    let inFlight = 0

    const winner = await new Promise<ChatResult | null>((resolve) => {
      let settled = false
      const finish = (r: ChatResult | null) => {
        if (settled) return
        settled = true
        controller.abort()
        resolve(r)
      }
      const launch = () => {
        while (next < pairs.length && Date.now() < deadline) {
          const { model, ki } = pairs[next++]
          if (isResting(`key:${ki}`) || isResting(`model:${model}`) || isResting(`pair:${ki}:${model}`)) continue
          inFlight++
          post(
            OPENROUTER_URL,
            keys[ki],
            { model, messages, ...(tools?.length ? { tools, tool_choice: 'auto' } : {}), temperature: 0.4, max_tokens: maxTokens },
            { 'HTTP-Referer': 'https://myinchstone.vercel.app', 'X-Title': 'Inchstone' },
            controller.signal,
          )
            .then((message) => finish({ message, model, provider: 'openrouter' }))
            .catch((e: ProviderError) => {
              if (settled) return
              errors.push(`${model} key${ki + 1}: ${e.status} ${String(e.message).slice(0, 100)}`)
              bench(e, ki, model)
              inFlight--
              launch() // a failure frees a slot: try the next pair straight away
              if (inFlight === 0 && (next >= pairs.length || Date.now() >= deadline)) finish(null)
            })
          return
        }
        if (inFlight === 0) finish(null)
      }
      launch()
      // Hedge: while nothing has answered, add a parallel attempt every few seconds.
      const hedge = setInterval(() => {
        if (settled) return clearInterval(hedge)
        if (Date.now() >= deadline) { clearInterval(hedge); if (inFlight === 0) finish(null); return }
        if (inFlight < MAX_IN_FLIGHT) launch()
      }, HEDGE_AFTER_MS)
      setTimeout(() => { clearInterval(hedge); finish(null) }, DEADLINE_MS + 2_000)
    })
    if (winner) return winner
  }

  const gemini = process.env.GEMINI_API_KEY
  if (gemini) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    try {
      const message = await post(GEMINI_URL, gemini, {
        model,
        messages,
        ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
        temperature: 0.4,
      })
      return { message, model, provider: 'gemini' }
    } catch (e) {
      errors.push(`gemini: ${(e as Error).message.slice(0, 120)}`)
    }
  }

  console.error('[ai] every provider failed', errors)
  if (!keys.length && !gemini && !gk.length) throw new Error('AI is not set up: add GROQ_API_KEY or OPENROUTER_API_KEYS.')
  if (keys.length && keys.every((_, i) => isResting(`key:${i}`)) && !gemini) {
    throw new Error('Every OpenRouter key is rejected or has used its free daily limit. It resets daily; adding $10 credit to a key raises the free limit to 1,000 a day.')
  }
  throw new Error('The free AI models did not answer in time. Try again in a moment.')
}
