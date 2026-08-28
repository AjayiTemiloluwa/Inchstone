import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

/*
 * POST /api/years  { year }
 * Creates a fresh year workspace (layer-0 year + the standard category
 * skeleton). If that year already exists it is returned instead, so the UI can
 * safely "move to 2027" and (if needed) scaffold it on demand.
 */
const DEFAULT_CATEGORIES = [
  { name: 'Faith', weight: 5 },
  { name: 'Family', weight: 10 },
  { name: 'Fitness', weight: 20 },
  { name: 'Finance', weight: 15 },
  { name: 'Career', weight: 35 },
  { name: 'Learning', weight: 15 },
]

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { year } = await req.json()
    const y = Number(year)
    if (!Number.isInteger(y) || y < 1970 || y > 2100) {
      return NextResponse.json({ error: 'Please provide a valid year (e.g. 2027).' }, { status: 400 })
    }

    const start = new Date(y, 0, 1)
    const end = new Date(y, 11, 31, 23, 59, 59, 999)

    // Already exists? Return it so the UI can just switch to it.
    // Matches BOTH plain year workspaces (startDate year) and renamed ones
    // like "2026 Identity" that carry the year in their title with no dates —
    // missing the title case is exactly how duplicate 2026 workspaces were born.
    const existingYears = await prisma.item.findMany({ where: { userId, layer: 0 } })
    const existing = existingYears.find(i => {
      const sd = new Date(i.startDate || 0)
      if (!Number.isNaN(sd.getTime()) && i.startDate && sd.getFullYear() === y) return true
      const m = (i.title || '').match(/\b(1[89]\d{2}|20\d{2})\b/)
      return m ? Number(m[1]) === y : false
    })
    if (existing) {
      return NextResponse.json({ success: true, item: existing, created: false })
    }

    const safeTitle = String(y)
    const yearItem = await prisma.item.create({
      data: {
        userId,
        layer: 0,
        title: safeTitle,
        description: `A blank ${y} — make it yours.`,
        weight: 1,
        startDate: start,
        endDate: end,
      },
    })

    if (DEFAULT_CATEGORIES.length > 0) {
      await prisma.item.createMany({
        data: DEFAULT_CATEGORIES.map(c => ({
          userId,
          layer: 1,
          parentId: yearItem.id,
          title: c.name,
          weight: c.weight,
          startDate: start,
          endDate: end,
        })),
      })
    }

    return NextResponse.json({ success: true, item: yearItem, created: true })
  } catch (error) {
    console.error('Failed to create year', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}