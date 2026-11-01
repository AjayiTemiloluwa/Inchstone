import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runAgent } from '@/lib/ai/agent'
import { aiConfigured } from '@/lib/ai/llm'

// POST /api/ai/chat — { context: 'applications' | 'general', messages: [{role, content}], tz, applicationId? }
// Runs the assistant on free OpenRouter models with key/model failover and
// returns { reply, actions, changed, model }.

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ configured: aiConfigured() })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!aiConfigured()) return NextResponse.json({ error: 'The assistant is not set up yet: add OPENROUTER_API_KEYS.' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: { role?: string; content?: unknown }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content }))
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Send a message' }, { status: 400 })
  }

  try {
    const out = await runAgent({
      userId,
      context: body.context === 'applications' ? 'applications' : 'general',
      history,
      tzOffset: Number(body.tz) || 0,
      timeZone: typeof body.timeZone === 'string' ? body.timeZone.slice(0, 64) : undefined,
      applicationId: typeof body.applicationId === 'string' ? body.applicationId : undefined,
    })
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The assistant failed' }, { status: 503 })
  }
}
