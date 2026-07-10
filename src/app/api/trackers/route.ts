import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')
        const range = searchParams.get('range') // "week" | "month" | "year"

        if (dateStr) {
            const date = new Date(dateStr)
            date.setHours(0, 0, 0, 0)
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)

            const trackers = await prisma.tracker.findMany({
                where: { userId, date: { gte: date, lt: nextDay } },
                orderBy: { createdAt: 'asc' },
            })
            return NextResponse.json({ trackers })
        }

        if (range) {
            const now = new Date()
            let start: Date
            if (range === 'week') {
                start = new Date(now)
                start.setDate(start.getDate() - 7)
            } else if (range === 'month') {
                start = new Date(now)
                start.setMonth(start.getMonth() - 1)
            } else {
                start = new Date(now)
                start.setFullYear(start.getFullYear() - 1)
            }
            start.setHours(0, 0, 0, 0)

            const trackers = await prisma.tracker.findMany({
                where: { userId, date: { gte: start, lte: now } },
                orderBy: { date: 'asc' },
            })
            return NextResponse.json({ trackers })
        }

        const trackers = await prisma.tracker.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 100,
        })
        return NextResponse.json({ trackers })
    } catch (error) {
        console.error('Failed to fetch trackers', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { title, date } = body

        if (!title || !date) {
            return NextResponse.json({ error: 'title and date are required' }, { status: 400 })
        }

        const trackerDate = new Date(date)
        trackerDate.setHours(0, 0, 0, 0)

        const tracker = await prisma.tracker.create({
            data: {
                userId,
                title,
                date: trackerDate,
                completed: false,
            },
        })

        return NextResponse.json({ success: true, tracker })
    } catch (error) {
        console.error('Failed to create tracker', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
