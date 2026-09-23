import { NextResponse } from 'next/server'
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

const TARGET_EMAIL = 'temiloluwaajayi2019@gmail.com'

async function resolveUserId(): Promise<string | null> {
  const { userId } = await auth()
  if (userId) {
    try {
      const me = await currentUser()
      const email = me?.primaryEmailAddress?.emailAddress?.toLowerCase()
      if (email === TARGET_EMAIL) return userId
    } catch { /* fall through to clerk lookup */ }
  }
  try {
    const cc = await clerkClient()
    const list = await cc.users.getUserList({ emailAddress: [TARGET_EMAIL], limit: 1 })
    const found = list?.data?.[0]
    return found?.id ?? null
  } catch (e) {
    console.error('q4fill: clerk lookup failed', e)
    return null
  }
}
export async function GET(req: Request) {
  const secret = process.env.Q4FILL_SECRET
  if (!secret) return NextResponse.json({ error: 'Q4FILL_SECRET not set on server' }, { status: 500 })
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== secret && req.headers.get('x-q4fill-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const uid = await resolveUserId()
  if (!uid) return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
  const years = await prisma.item.findMany({ where: { userId: uid, layer: 0 }, select: { id: true, title: true, startDate: true } })
  const match = years.filter(y => { const m = (y.title || '').match(/\b(19|20)\d{2}\b/); if (m && Number(m[0]) === 2026) return true; if (y.startDate && new Date(y.startDate).getFullYear() === 2026) return true; return false })
  const withCounts: Array<{ id: string; title: string; cats: number; l2: number; l3: number; l4: number }> = []
  for (const y of match) {
    const ids = [y.id]
    const c1 = await prisma.item.findMany({ where: { userId: uid, layer: 1, parentId: y.id }, select: { id: true } })
    const catIds = c1.map(c => c.id)
    const l2 = catIds.length ? await prisma.item.count({ where: { userId: uid, layer: 2, parentId: { in: catIds } } }) : 0
    const l2ids = catIds.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 2, parentId: { in: catIds } }, select: { id: true } })).map(x => x.id) : []
    const l3 = l2ids.length ? await prisma.item.count({ where: { userId: uid, layer: 3, parentId: { in: l2ids } } }) : 0
    const l3ids = l2ids.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 3, parentId: { in: l2ids } }, select: { id: true } })).map(x => x.id) : []
    const l4 = l3ids.length ? await prisma.item.count({ where: { userId: uid, layer: 4, parentId: { in: l3ids } } }) : 0
    void ids
    withCounts.push({ id: y.id, title: y.title, cats: catIds.length, l2, l3, l4 })
  }
  return NextResponse.json({ ok: true, years, match: withCounts })
}


export async function POST(req: Request) {
  try {
    const secret = process.env.Q4FILL_SECRET
    if (!secret) return NextResponse.json({ error: 'Q4FILL_SECRET not set on server' }, { status: 500 })
    const got = req.headers.get('x-q4fill-secret')
    if (got !== secret) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const uid = await resolveUserId()
    if (!uid) return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    const body = await req.json().catch(() => ({} as { mode?: string; yearId?: string }))
    const { CATS, MO, Q } = await import('./data')
    const years = await prisma.item.findMany({ where: { userId: uid, layer: 0 } })
    const y2026 = years.find(y => { const m = (y.title || '').match(/\b(19|20)\d{2}\b/); if (m && Number(m[0]) === 2026) return true; if (y.startDate && new Date(y.startDate).getFullYear() === 2026) return true; return false })
    if (!y2026) return NextResponse.json({ error: 'No 2026 year workspace for target user' }, { status: 404 })
    const yearId: string = (body.yearId as string) || y2026.id
    if (body.mode === 'inspect') {
      const cats = await prisma.item.findMany({ where: { userId: uid, layer: 1, parentId: yearId }, select: { id: true, title: true } })
      return NextResponse.json({ ok: true, yearId, cats })
    }
    const existing = await prisma.item.findMany({ where: { userId: uid, layer: 1, parentId: yearId }, select: { id: true, title: true } })
    const delCatIds: string[] = []
    for (const c of existing) { if (/^(faith|family|fitness|finance|career|learning)$/i.test((c.title || '').trim())) delCatIds.push(c.id) }
    for (const cid of delCatIds) {
      const l2 = (await prisma.item.findMany({ where: { userId: uid, layer: 2, parentId: cid }, select: { id: true } })).map(x => x.id)
      const l3 = l2.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 3, parentId: { in: l2 } }, select: { id: true } })).map(x => x.id) : []
      const l4 = l3.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 4, parentId: { in: l3 } }, select: { id: true } })).map(x => x.id) : []
      const l5 = l4.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 5, parentId: { in: l4 } }, select: { id: true } })).map(x => x.id) : []
      const l6 = l5.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 6, parentId: { in: l5 } }, select: { id: true } })).map(x => x.id) : []
      if (l6.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l6 } } })
      if (l5.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l5 } } })
      if (l4.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l4 } } })
      if (l3.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l3 } } })
      if (l2.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l2 } } })
      await prisma.item.deleteMany({ where: { userId: uid, id: cid } })
    }
    await prisma.item.update({ where: { id: yearId }, data: { theme: 'Q4 2026 ÔÇö Pack', anchorScripture: 'Commit to the Lord whatever you do, and he will establish your plans. ÔÇö Proverbs 16:3', focusQuestion: 'Did my actions today align with the disciplined identity I am building this quarter?' } })
    const names = CATS.map(c => c.name)
    const prior = await prisma.item.findMany({ where: { userId: uid, layer: 1, parentId: yearId }, select: { id: true, title: true } })
    for (const c of prior) {
      if (!names.includes((c.title || '').trim())) continue
      const l2 = (await prisma.item.findMany({ where: { userId: uid, layer: 2, parentId: c.id }, select: { id: true } })).map(x => x.id)
      const l3 = l2.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 3, parentId: { in: l2 } }, select: { id: true } })).map(x => x.id) : []
      const l4 = l3.length ? (await prisma.item.findMany({ where: { userId: uid, layer: 4, parentId: { in: l3 } }, select: { id: true } })).map(x => x.id) : []
      if (l4.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l4 } } })
      if (l3.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l3 } } })
      if (l2.length) await prisma.item.deleteMany({ where: { userId: uid, id: { in: l2 } } })
      await prisma.item.deleteMany({ where: { userId: uid, id: c.id } })
    }
    type Row = { id: string; userId: string; layer: number; parentId: string | null; title: string; description: string | null; weight: number; startDate: Date | null; endDate: Date | null }
    const L1: Row[] = []
    const L2: Row[] = []
    const L3: Row[] = []
    const L4: Row[] = []
    for (const c of CATS) {
      const catId = randomUUID()
      L1.push({ id: catId, userId: uid, layer: 1, parentId: yearId, title: c.name, description: c.smart, weight: c.weight, startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31, 23, 59, 59, 999) })
      const per = Math.round((100 / c.goals.length) * 10) / 10
      for (const g of c.goals) {
        const yId = randomUUID()
        L2.push({ id: yId, userId: uid, layer: 2, parentId: catId, title: g.t, description: g.t, weight: per, startDate: Q.start, endDate: Q.end })
        const qId = randomUUID()
        L3.push({ id: qId, userId: uid, layer: 3, parentId: yId, title: 'Q4 Objective', description: g.t, weight: 100, startDate: Q.start, endDate: Q.end })
        const parts = [g.s, g.o, g.n, g.d]
        MO.forEach((m, i) => {
          L4.push({ id: randomUUID(), userId: uid, layer: 4, parentId: qId, title: m.t, description: parts[i] || g.t, weight: m.w, startDate: m.s, endDate: m.e })
        })
      }
    }
    await prisma.item.createMany({ data: L1 })
    for (let i = 0; i < L2.length; i += 100) await prisma.item.createMany({ data: L2.slice(i, i + 100) })
    for (let i = 0; i < L3.length; i += 100) await prisma.item.createMany({ data: L3.slice(i, i + 100) })
    for (let i = 0; i < L4.length; i += 100) await prisma.item.createMany({ data: L4.slice(i, i + 100) })
    const verify = await prisma.item.findMany({ where: { userId: uid, layer: 1, parentId: yearId }, select: { id: true, title: true } })
    return NextResponse.json({ ok: true, deletedOld: delCatIds.length, created: { cats: L1.length, yearly: L2.length, quarterly: L3.length, monthly: L4.length }, categories: verify })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
