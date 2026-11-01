import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { BUILT_IN_SOURCES, approveOpportunities, runScout, scoutProfile, sendDigest } from '@/lib/scout'
import { safeUrl } from '@/lib/web'

// GET  /api/opportunities — the scout profile, built-in sources and every opportunity found
// PUT  /api/opportunities — save the profile { interests, homeCountry, types[], sources[], builtIn, emailDigest }
// POST /api/opportunities — { action: 'scout' } run now
//                           { action: 'approve' | 'dismiss' | 'restore', ids: string[] }  (approve copies into the tracker)
//                           { action: 'digest' } email the preview now

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [profile, opportunities] = await Promise.all([
    scoutProfile(userId),
    prisma.opportunity.findMany({ where: { userId }, orderBy: [{ foundAt: 'desc' }, { match: 'desc' }], take: 500 }),
  ])
  return NextResponse.json({ profile, opportunities, builtInSources: BUILT_IN_SOURCES })
}

export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await scoutProfile(userId)
  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof b.interests === 'string') data.interests = b.interests.slice(0, 1000)
  if (typeof b.homeCountry === 'string' && b.homeCountry.trim()) data.homeCountry = b.homeCountry.trim().slice(0, 80)
  if (Array.isArray(b.types)) data.types = b.types.map(String).filter(Boolean).slice(0, 12).join(',')
  if (typeof b.builtIn === 'boolean') data.builtIn = b.builtIn
  if (typeof b.emailDigest === 'boolean') data.emailDigest = b.emailDigest
  if (Array.isArray(b.sources)) {
    const out: string[] = []
    for (const raw of b.sources.slice(0, 25)) {
      const s = String(raw).trim()
      const u = await safeUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`)
      if (!u) return NextResponse.json({ error: `"${s}" is not a public web address` }, { status: 400 })
      if (!out.includes(u.toString())) out.push(u.toString())
    }
    data.sources = out
  }
  const profile = await prisma.scoutProfile.update({ where: { userId }, data })
  return NextResponse.json({ profile })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))

  if (b.action === 'scout') {
    try { return NextResponse.json(await runScout(userId, 52_000)) } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'The scout could not run' }, { status: 503 })
    }
  }
  if (b.action === 'digest') {
    const r = await sendDigest(userId, { includeSent: true })
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.reason }, { status: 400 })
  }

  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 500) : []
  if (!ids.length) return NextResponse.json({ error: 'Choose at least one opportunity' }, { status: 400 })
  if (b.action === 'approve') return NextResponse.json({ approved: await approveOpportunities(userId, ids) })
  if (b.action === 'dismiss' || b.action === 'restore') {
    const res = await prisma.opportunity.updateMany({
      where: { userId, id: { in: ids }, status: { not: 'approved' } },
      data: { status: b.action === 'dismiss' ? 'dismissed' : 'new' },
    })
    return NextResponse.json({ updated: res.count })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
