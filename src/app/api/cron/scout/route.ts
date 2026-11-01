import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { runScout, sendDigest } from '@/lib/scout'

/**
 * GET /api/cron/scout — the morning run (Vercel Cron, daily at 05:00 UTC = 06:00 Lagos).
 * Scouts for every user who has opened the scout, longest-waiting first,
 * then emails each one their preview. Requires CRON_SECRET when it is set
 * (Vercel Cron sends it as a Bearer token automatically).
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}` && req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const dayAgo = new Date(Date.now() - 20 * 3_600_000)
  const due = await prisma.scoutProfile.findMany({
    where: { OR: [{ lastRunAt: null }, { lastRunAt: { lt: dayAgo } }] },
    orderBy: { lastRunAt: { sort: 'asc', nulls: 'first' } },
    take: 10,
  })
  const report: { userId: string; added?: number; emailed?: boolean; error?: string }[] = []
  for (const p of due) {
    const left = 55_000 - (Date.now() - started)
    if (left < 20_000) break
    try {
      const r = await runScout(p.userId, Math.min(left - 6_000, 45_000))
      const mail = p.emailDigest ? await sendDigest(p.userId) : null
      report.push({ userId: p.userId, added: r.added, emailed: !!mail?.ok })
    } catch (e) {
      report.push({ userId: p.userId, error: e instanceof Error ? e.message : 'failed' })
    }
  }
  return NextResponse.json({ ran: report.length, waiting: due.length - report.length, report })
}
