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
  provider: 'openrouter' | 'gemini'
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const TIMEOUT_MS = 30_000
const KEY_REST_MS = 10 * 60_000
const MODEL_REST_MS = 30 * 60_000
const MAX_MODELS_PER_CALL = 6

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

export function aiConfigured(): boolean {
  return openRouterKeys().length > 0 || !!process.env.GEMINI_API_KEY
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

async function post(url: string, key: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
  if (!message) throw new ProviderError(502, 'empty response')
  return message
}

export async function chat(messages: ChatMessage[], tools?: ToolSpec[], opts: { maxTokens?: number } = {}): Promise<ChatResult> {
  const maxTokens = opts.maxTokens ?? 1400
  const keys = openRouterKeys()
  const errors: string[] = []

  if (keys.length) {
    const models = (await freeModels()).filter((m) => !isResting(`model:${m}`)).slice(0, MAX_MODELS_PER_CALL)
    if (!models.includes(ROUTER)) models.push(ROUTER)
    const start = rotation++ % keys.length

    for (const model of models) {
      for (let n = 0; n < keys.length; n++) {
        const ki = (start + n) % keys.length
        if (isResting(`key:${ki}`)) continue
        try {
          const message = await post(
            OPENROUTER_URL,
            keys[ki],
            { model, messages, ...(tools?.length ? { tools, tool_choice: 'auto' } : {}), temperature: 0.4, max_tokens: maxTokens },
            { 'HTTP-Referer': 'https://myinchstone.vercel.app', 'X-Title': 'Inchstone' },
          )
          return { message, model, provider: 'openrouter' }
        } catch (e) {
          const err = e as ProviderError
          errors.push(`${model} key${ki + 1}: ${err.status} ${err.message.slice(0, 120)}`)
          if (err.status === 401 || err.status === 402 || err.status === 403) {
            rest(`key:${ki}`, KEY_REST_MS) // bad or out-of-credit key: try the next key
            continue
          }
          if (err.status === 429) continue // this key is rate-limited on this model: next key
          rest(`model:${model}`, MODEL_REST_MS) // model down, unknown, or no tool support: next model
          break
        }
      }
    }
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
  if (!keys.length && !gemini) throw new Error('AI is not set up: add OPENROUTER_API_KEYS.')
  if (keys.length && keys.every((_, i) => isResting(`key:${i}`)) && !gemini) {
    throw new Error('Every OpenRouter key was rejected. Check OPENROUTER_API_KEYS in the environment settings.')
  }
  throw new Error('All free AI models are busy right now. Try again in a minute.')
}
