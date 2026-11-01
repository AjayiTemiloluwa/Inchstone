import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { runScout, sendDigest } from '@/lib/scout'
import { digestDue } from '@/lib/digest'

/**
 * GET /api/cron/scout — pinged hourly (GitHub Actions, .github/workflows/opportunity-scout.yml;
 * Vercel's daily cron is a backup).
 *
 * Each ping: first, users whose digest hour it is in their own timezone get a
 * fresh scout (unless one ran in the last 6 hours) and then their email.
 * Then, with time left, anyone not scouted for 20 hours gets their daily run.
 * Repeated pings are harmless: every step checks its own last-run stamp, so
 * the endpoint needs no secret (CRON_SECRET is honoured if one is set).
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const HOUR = 3_600_000

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}` && req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const left = () => 55_000 - (Date.now() - started)
  const now = new Date()
  const profiles = await prisma.scoutProfile.findMany({ orderBy: { lastRunAt: { sort: 'asc', nulls: 'first' } } })
  const report: { userId: string; scouted?: number; emailed?: boolean; error?: string }[] = []

  // 1. Digests due this hour.
  for (const p of profiles.filter((x) => digestDue(x, now))) {
    if (left() < 15_000) break
    const row: (typeof report)[number] = { userId: p.userId }
    try {
      if (!p.lastRunAt || now.getTime() - p.lastRunAt.getTime() > 6 * HOUR) row.scouted = (await runScout(p.userId, Math.min(left() - 8_000, 40_000))).added
      row.emailed = (await sendDigest(p.userId)).ok
    } catch (e) { row.error = e instanceof Error ? e.message : 'failed' }
    // Stamp even when nothing was sent, so the hour is not retried.
    await prisma.scoutProfile.update({ where: { id: p.id }, data: { digestSentAt: now } })
    report.push(row)
  }

  // 2. Daily scouting for everyone else.
  for (const p of profiles) {
    if (left() < 20_000) break
    if (report.some((r) => r.userId === p.userId)) continue
    if (p.lastRunAt && now.getTime() - p.lastRunAt.getTime() < 20 * HOUR) continue
    try { report.push({ userId: p.userId, scouted: (await runScout(p.userId, Math.min(left() - 6_000, 40_000))).added }) }
    catch (e) { report.push({ userId: p.userId, error: e instanceof Error ? e.message : 'failed' }) }
  }
  return NextResponse.json({ ran: report.length, report })
}
