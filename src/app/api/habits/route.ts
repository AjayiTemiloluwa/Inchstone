import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const range = searchParams.get('range') || 'year'
        const dateStr = searchParams.get('date')

        const where: any = { userId, isHabit: true }

        if (dateStr) {
            const date = new Date(dateStr)
            date.setHours(0, 0, 0, 0)
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)
            where.date = { gte: date, lt: nextDay }
        } else if (range === 'year') {
            const now = new Date()
            const yearStart = new Date(now.getFullYear(), 0, 1)
            const yearEnd = new Date(now.getFullYear() + 1, 0, 1)
            where.date = { gte: yearStart, lt: yearEnd }
        } else if (range === 'today') {
            const now = new Date()
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const dayEnd = new Date(dayStart)
            dayEnd.setDate(dayEnd.getDate() + 1)
            where.date = { gte: dayStart, lt: dayEnd }
        }

        const habits = await prisma.task.findMany({
            where,
            orderBy: [{ title: 'asc' }, { date: 'asc' }],
        })

        // Get unique habit titles for management
        const uniqueTitles = [...new Set(habits.map(h => h.title))].map(title => {
            const instances = habits.filter(h => h.title === title)
            const total = instances.length
            const completed = instances.filter(h => h.completed).length
            const latest = instances[instances.length - 1]
            return { title, total, completed, latestDate: latest?.date }
        })

        return NextResponse.json({ habits, uniqueTitles })
    } catch (error) {
        console.error('Failed to fetch habits', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const title = searchParams.get('title')

        if (!title) {
            return NextResponse.json({ error: 'title is required' }, { status: 400 })
        }

        // Delete all future habit instances (keep past ones for graph data)
        const now = new Date()
        now.setHours(0, 0, 0, 0)

        const result = await prisma.task.deleteMany({
            where: {
                userId,
                isHabit: true,
                title,
                date: { gte: now }
            }
        })

        return NextResponse.json({ success: true, deleted: result.count })
    } catch (error) {
        console.error('Failed to delete habits', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { title, recurrenceEnd } = body

        if (!title) {
            return NextResponse.json({ error: 'title is required' }, { status: 400 })
        }

        // Find a daily goal to attach habits to
        const anyDailyGoal = await prisma.item.findFirst({
            where: { userId, layer: 6 },
            orderBy: { startDate: 'desc' }
        })
        if (!anyDailyGoal) {
            return NextResponse.json({ error: 'No daily goal found. Seed the framework first.' }, { status: 400 })
        }
        const goalId = anyDailyGoal.id

        // Create habit instances for the rest of the year
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const endDate = recurrenceEnd ? new Date(recurrenceEnd) : new Date(new Date().getFullYear(), 11, 31)

        // Create today's instance
        const todayInstance = await prisma.task.create({
            data: {
                userId,
                goalId,
                title,
                weight: 1,
                progress: 0,
                completed: false,
                date: today,
                isRecurring: true,
                recurrencePattern: 'daily',
                recurrenceEnd: endDate,
                isHabit: true,
            }
        })

        // Create future instances in batches using createMany for efficiency
        let currentDate = new Date(today)
        currentDate.setDate(currentDate.getDate() + 1)
        let batch: any[] = []
        let totalCreated = 1

        while (currentDate <= endDate) {
            batch.push({
                userId,
                goalId,
                title,
                weight: 1,
                progress: 0,
                completed: false,
                date: new Date(currentDate),
                isRecurring: true,
                recurrencePattern: 'daily',
                recurrenceEnd: endDate,
                isHabit: true,
            })
            totalCreated++

            // Execute in batches of 100 using createMany
            if (batch.length >= 100) {
                await prisma.task.createMany({ data: batch })
                batch = []
            }
            currentDate.setDate(currentDate.getDate() + 1)
        }

        if (batch.length > 0) {
            await prisma.task.createMany({ data: batch })
        }

        return NextResponse.json({ success: true, habit: todayInstance, totalCreated })
    } catch (error) {
        console.error('Failed to create habit', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}