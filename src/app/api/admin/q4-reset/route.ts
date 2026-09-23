import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { Q4_META, buildQ4Rows } from '@/lib/q4-2026-pack'

const TARGET_EMAIL = 'temiloluwaajayi2019@gmail.com'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
    if (email !== TARGET_EMAIL) {
      return NextResponse.json({ error: 'Forbidden: route locked to ' + TARGET_EMAIL }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    if (body.key !== process.env.Q4_RESET_KEY && body.email !== TARGET_EMAIL) {
      return NextResponse.json({ error: 'Missing or invalid reset key + email confirmation' }, { status: 403 })
    }

    const years = await prisma.item.findMany({ where: { userId, layer: 0 } })
    const y2026 = years.find((y: { title: string; startDate: Date | null }) => {
      if (y.startDate && new Date(y.startDate).getFullYear() === 2026) return true
      return /\b2026\b/.test(y.title || '')
    })
    if (!y2026) return NextResponse.json({ error: 'No 2026 year workspace found for this user' }, { status: 404 })

    const cats = await prisma.item.findMany({ where: { userId, layer: 1, parentId: y2026.id } })
    const deletedCats = cats.length
    for (const c of cats) {
      await prisma.item.delete({ where: { id: c.id } }).catch(async () => {
        await prisma.item.deleteMany({ where: { userId, parentId: c.id } })
        await prisma.item.delete({ where: { id: c.id } })
      })
    }

    await prisma.item.update({
      where: { id: y2026.id },
      data: {
        title: '2026 — Q4 Productivity Pack (Sep 22 - Dec 31)',
        description: 'Temiloluwa Ajayi Productivity Pack. Q4 2026 One-Page Quarter Goal System — September 22 to December 31, 2026 (101 days).',
        theme: Q4_META.theme,
        anchorScripture: Q4_META.anchorScripture,
        focusQuestion: Q4_META.focusQuestion,
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 11, 31, 23, 59, 59, 999),
      },
    })

    const rows = buildQ4Rows(userId, y2026.id)
    for (let i = 0; i < rows.length; i += 50) {
      await prisma.item.createMany({ data: rows.slice(i, i + 50) })
    }

    const verifyCats = await prisma.item.findMany({ where: { userId, layer: 1, parentId: y2026.id }, select: { id: true, title: true } })
    const verifyQ = await prisma.item.count({ where: { userId, layer: 3 } })
    const verifyM = await prisma.item.count({ where: { userId, layer: 4 } })
    return NextResponse.json({ success: true, yearId: y2026.id, deletedCats, categories: verifyCats, q3count: verifyQ, monthCount: verifyM })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('Q4 reset failed', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}