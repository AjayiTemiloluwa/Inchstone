import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

// GET /api/habits/overview?date=YYYY-MM-DD
//
// Habit *definitions* view for a single day. Every habit the user owns is
// returned with:
//   scheduled  — does an instance exist on that day?
//   nextDue    — the first instance after that day (null when none remain)
//   lastDue    — the most recent instance before that day (null when none)
// so the day tracker can list off-day habits (weekly/monthly/… patterns)
// without inventing placeholder rows.
export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
        }

        // Same local-day window the day page uses for its task fetch.
        const dayStart = new Date(dateStr)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)

        const rows = await prisma.task.findMany({
            where: { userId, isHabit: true },
            select: {
                title: true,
                date: true,
                recurrencePattern: true,
                recurrenceEnd: true,
                categoryId: true,
            },
            orderBy: { date: 'asc' },
        })

        const byTitle = new Map<string, {
            dates: string[]
            scheduled: boolean
            pattern: string
            recurrenceEnd: Date | null
        }>()

        for (const row of rows) {
            const iso = row.date.toISOString().slice(0, 10)
            let entry = byTitle.get(row.title)
            if (!entry) {
                entry = {
                    dates: [],
                    scheduled: false,
                    pattern: row.recurrencePattern || 'daily',
                    recurrenceEnd: row.recurrenceEnd,
                }
                byTitle.set(row.title, entry)
            }
            entry.dates.push(iso)
            if (!entry.scheduled) {
                const inWindow = row.date >= dayStart && row.date < dayEnd
                entry.scheduled = inWindow || iso === dateStr
            }
        }

        const habits = [...byTitle.entries()].map(([title, entry]) => ({
            title,
            pattern: entry.pattern,
            scheduled: entry.scheduled,
            nextDue: entry.dates.find(d => d > dateStr) ?? null,
            lastDue: [...entry.dates].reverse().find(d => d < dateStr) ?? null,
            totalInstances: entry.dates.length,
            recurrenceEnd: entry.recurrenceEnd ? entry.recurrenceEnd.toISOString().slice(0, 10) : null,
        }))

        // Nearest first, then alphabetical — deterministic ordering for the UI.
        habits.sort((a, b) =>
            (a.nextDue ?? '9999-99-99').localeCompare(b.nextDue ?? '9999-99-99') ||
            a.title.localeCompare(b.title)
        )

        return NextResponse.json({ habits })
    } catch (error) {
        console.error('Failed to fetch habit overview', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}