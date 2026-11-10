import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { recalculateItemProgress } from '@/lib/score'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const range = searchParams.get('range') || 'year'
        const dateStr = searchParams.get('date')
        const start = searchParams.get('start')
        const end = searchParams.get('end')

        const where: any = { userId, isHabit: true }

        if (dateStr) {
            const date = new Date(dateStr)
            date.setHours(0, 0, 0, 0)
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)
            where.date = { gte: date, lt: nextDay }
        } else if (start && end) {
            const startDate = new Date(start)
            startDate.setHours(0, 0, 0, 0)
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: startDate, lte: endDate }
        } else if (range === 'year') {
            const now = new Date()
            const yearStart = new Date(now.getFullYear(), 0, 1)
            const yearEnd = new Date(now.getFullYear() + 1, 0, 1)
            where.date = { gte: yearStart, lt: yearEnd }
        } else if (range === 'week') {
            const now = new Date()
            const weekStart = new Date(now)
            weekStart.setDate(weekStart.getDate() - weekStart.getDay())
            weekStart.setHours(0, 0, 0, 0)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 7)
            where.date = { gte: weekStart, lt: weekEnd }
        } else if (range === 'month') {
            const now = new Date()
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
            where.date = { gte: monthStart, lt: monthEnd }
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
        const todayUtc = new Date()
        todayUtc.setUTCHours(0, 0, 0, 0)
        const uniqueTitles = [...new Set(habits.map(h => h.title))].map(title => {
            const instances = habits.filter(h => h.title === title)
            const total = instances.length
            const completed = instances.filter(h => h.completed).length
            const latest = instances[instances.length - 1]
            // Days still to come: 0 means the habit was stopped and only its history is left.
            const upcoming = instances.filter(h => h.date! >= todayUtc).length
            return { title, total, completed, upcoming, latestDate: latest?.date }
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
        const deleteAll = searchParams.get('deleteAll') === 'true'

        if (!title) {
            return NextResponse.json({ error: 'title is required' }, { status: 400 })
        }

        const series = { userId, isHabit: true, title }
        // Habit days are stored at UTC midnight (see POST), so "today" is UTC midnight too.
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)

        const goalIds = (await prisma.task.findMany({ where: series, select: { goalId: true }, distinct: ['goalId'] })).map(t => t.goalId)
        if (goalIds.length === 0) {
            return NextResponse.json({ error: 'That habit no longer exists' }, { status: 404 })
        }

        let deleted: number
        let kept = 0
        if (deleteAll) {
            // Every day, past and future.
            deleted = (await prisma.task.deleteMany({ where: series })).count
        } else {
            // Today onwards only; earlier days stay for the habit graph. Cap the
            // survivors so a later edit cannot regenerate the removed days.
            deleted = (await prisma.task.deleteMany({ where: { ...series, date: { gte: today } } })).count
            kept = (await prisma.task.updateMany({ where: { ...series, date: { lt: today } }, data: { recurrenceEnd: new Date(today.getTime() - 1) } })).count
        }

        // Goal scores follow the removed days; a failure here must not undo the delete.
        for (const goalId of goalIds) {
            await recalculateItemProgress(goalId).catch(e => console.error('Habit deleted, but the goal score could not be recalculated', e))
        }

        return NextResponse.json({ success: true, deleted, kept })
    } catch (error) {
        console.error('Failed to delete habits', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { oldTitle, newTitle } = body
        if (!oldTitle || !newTitle) {
            return NextResponse.json({ error: 'oldTitle and newTitle are required' }, { status: 400 })
        }
        if (oldTitle === newTitle) {
            return NextResponse.json({ success: true, renamed: 0 })
        }

        // Rename every instance (past + future) of this habit so history and stats follow.
        const result = await prisma.task.updateMany({
            where: { userId, isHabit: true, title: oldTitle },
            data: { title: newTitle }
        })

        return NextResponse.json({ success: true, renamed: result.count })
    } catch (error) {
        console.error('Failed to rename habit', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { title, recurrenceEnd, recurrencePattern } = body
        const pattern = recurrencePattern || 'daily'

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
        today.setUTCHours(0, 0, 0, 0)
        const endDate = recurrenceEnd ? new Date(recurrenceEnd) : new Date(Date.UTC(new Date().getFullYear(), 11, 31, 23, 59, 59, 999))

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
                recurrencePattern: pattern,
                recurrenceEnd: endDate,
                isHabit: true,
            }
        })

        // Create future instances in batches using createMany for efficiency
        let currentDate = new Date(today)
        currentDate.setUTCDate(currentDate.getUTCDate() + 1)
        let batch: any[] = []
        let totalCreated = 1

        while (currentDate <= endDate) {
            let shouldCreate = false
            const day = currentDate.getUTCDay()

            switch (pattern) {
                case 'daily':
                    shouldCreate = true
                    break
                case 'weekly':
                    shouldCreate = day === today.getUTCDay()
                    break
                case 'biweekly':
                    shouldCreate = day === today.getUTCDay() && Math.floor((currentDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0
                    break
                case 'monthly':
                    shouldCreate = currentDate.getUTCDate() === today.getUTCDate()
                    break
                case 'yearly':
                    shouldCreate = currentDate.getUTCMonth() === today.getUTCMonth() && currentDate.getUTCDate() === today.getUTCDate()
                    break
                case 'weekdays':
                    shouldCreate = day >= 1 && day <= 5
                    break
                default:
                    shouldCreate = false
            }

            if (shouldCreate) {
                batch.push({
                    userId,
                    goalId,
                    title,
                    weight: 1,
                    progress: 0,
                    completed: false,
                    date: new Date(currentDate),
                    isRecurring: true,
                    recurrencePattern: pattern,
                    recurrenceEnd: endDate,
                    isHabit: true,
                })
                totalCreated++

                // Execute in batches of 100 using createMany
                if (batch.length >= 100) {
                    await prisma.task.createMany({ data: batch })
                    batch = []
                }
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1)
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
