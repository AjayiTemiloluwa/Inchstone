import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { BUILT_IN_SOURCES, approveOpportunities, runScout, scoutProfile, sendDigest } from '@/lib/scout'
import { safeUrl } from '@/lib/web'

// GET  /api/opportunities — the scout profile, built-in sources and every opportunity found
// PUT  /api/opportunities — save the profile { interests, homeCountry, types[], sources[], builtIn } and the digest
//                           { emailDigest, digestFrequency, digestHour, digestDay, digestMinMatch, digestScope, digestTypes[], digestMax, digestOnlyNew, tz }
// POST /api/opportunities — { action: 'scout' } run now
//                           { action: 'approve' | 'dismiss' | 'restore', ids: string[] }  (approve copies into the tracker)
//                           { action: 'email-skip', ids, skip } take items out of (or back into) the email list
//                           { action: 'digest' } email the digest list now

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
  if (['daily', 'weekdays', 'weekly'].includes(b.digestFrequency)) data.digestFrequency = b.digestFrequency
  const int = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? v : undefined)
  for (const [k, lo, hi] of [['digestHour', 0, 23], ['digestDay', 0, 6], ['digestMinMatch', 0, 100], ['digestMax', 1, 60]] as const) {
    const v = int(b[k], lo, hi); if (v !== undefined) data[k] = v
  }
  if (['all', 'local', 'global'].includes(b.digestScope)) data.digestScope = b.digestScope
  if (Array.isArray(b.digestTypes)) data.digestTypes = b.digestTypes.map(String).filter(Boolean).slice(0, 12).join(',')
  if (typeof b.digestOnlyNew === 'boolean') data.digestOnlyNew = b.digestOnlyNew
  if (typeof b.tz === 'string' && b.tz.length < 64) { try { new Intl.DateTimeFormat('en', { timeZone: b.tz }); data.tz = b.tz } catch { /* ignore unknown zones */ } }
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
    const r = await sendDigest(userId)
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.reason }, { status: 400 })
  }

  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 500) : []
  if (!ids.length) return NextResponse.json({ error: 'Choose at least one opportunity' }, { status: 400 })
  if (b.action === 'approve') return NextResponse.json({ approved: await approveOpportunities(userId, ids) })
  if (b.action === 'email-skip') {
    const res = await prisma.opportunity.updateMany({ where: { userId, id: { in: ids } }, data: { emailSkip: b.skip !== false } })
    return NextResponse.json({ updated: res.count })
  }
  if (b.action === 'dismiss' || b.action === 'restore') {
    const res = await prisma.opportunity.updateMany({
      where: { userId, id: { in: ids }, status: { not: 'approved' } },
      data: { status: b.action === 'dismiss' ? 'dismissed' : 'new' },
    })
    return NextResponse.json({ updated: res.count })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
