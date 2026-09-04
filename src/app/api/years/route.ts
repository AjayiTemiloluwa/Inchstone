import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { findYearItem, seedYearFramework } from '@/lib/framework'

/*
 * POST /api/years  { year }
 * Creates a COMPLETE year workspace for `year` — the layer-0 year, the
 * category skeleton, and the full goal hierarchy beneath every category.
 * If that year already exists it is returned instead, so the UI can safely
 * "move to 2027" and scaffold it on demand. The current year's framework is
 * provisioned automatically for new users (GET /api/items); any other year
 * gets the same full structure the moment it is opened here.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { year } = await req.json()
    const y = Number(year)
    if (!Number.isInteger(y) || y < 1970 || y > 2100) {
      return NextResponse.json({ error: 'Please provide a valid year (e.g. 2027).' }, { status: 400 })
    }

    // Already exists? Return it so the UI can just switch to it.
    const existing = await findYearItem(userId, y)
    if (existing) {
      return NextResponse.json({ success: true, item: existing, created: false })
    }

    const item = await seedYearFramework(userId, y)
    return NextResponse.json({ success: true, item, created: true })
  } catch (error) {
    console.error('Failed to create year', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}