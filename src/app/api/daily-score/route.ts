import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const dateStr = searchParams.get('date')

        if (!dateStr) {
            return NextResponse.json({ error: 'date is required' }, { status: 400 })
        }

        // Date-only strings (yyyy-MM-dd) are calendar days — parse them as exact
        // UTC midnights, matching how day-anchored records are stored. Running
        // setHours(0,0,0,0) on them shifts the window by the server's timezone
        // and can miss the day's tasks entirely on non-UTC servers.
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        const date = new Date(isDateOnly ? `${dateStr}T00:00:00.000Z` : dateStr)
        if (!isDateOnly) date.setHours(0, 0, 0, 0)
        const nextDay = new Date(date)
        nextDay.setDate(nextDay.getDate() + 1)

        // Get tasks for the day from Task model
        const tasks = await prisma.task.findMany({
            where: {
                userId,
                date: { gte: date, lt: nextDay },
            },
            orderBy: { scheduledTime: 'asc' },
        })

        // Get deeds for the day with their tasks
        const deeds = await prisma.item.findMany({
            where: {
                userId,
                layer: 5,
                startDate: { gte: date, lt: nextDay },
            },
            include: {
                tasks: {
                    where: { date: { gte: date, lt: nextDay } },
                },
            },
        })

        // Calculate weighted daily score
        let totalWeightedScore = 0
        let totalWeight = 0
        for (const deed of deeds) {
            const deedTasks = deed.tasks || []
            if (deedTasks.length > 0) {
                const taskTotalWeight = deedTasks.reduce((s, t) => s + t.weight, 0)
                const taskWeightedScore = deedTasks.reduce((s, t) => s + (t.progress * t.weight), 0)
                const deedScore = taskTotalWeight > 0 ? (taskWeightedScore / taskTotalWeight) : 0
                totalWeightedScore += deedScore * (deed.weight || 1)
                totalWeight += deed.weight || 1
            } else {
                totalWeightedScore += (deed.progress || 0) * (deed.weight || 1)
                totalWeight += deed.weight || 1
            }
        }

        const score = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight)) : 0
        const totalTasks = tasks.length
        const completedTasks = tasks.filter(t => t.completed).length

        // Upsert daily score to avoid race conditions (return value unused —
        // the response below is built from the freshly computed totals)
        await prisma.dailyScore.upsert({
            where: { userId_date: { userId, date } },
            create: {
                userId,
                date,
                totalTasks,
                completedTasks,
                score,
            },
            update: {
                totalTasks,
                completedTasks,
                score,
            },
        })

        return NextResponse.json({
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                weight: t.weight,
                progress: t.progress,
                scheduledTime: t.scheduledTime?.toISOString() || null,
                completed: t.completed,
            })),
            deeds: deeds.map(d => ({
                id: d.id,
                title: d.title,
                weight: d.weight,
                progress: d.progress,
                completed: d.completed,
                tasks: d.tasks,
            })),
            dailyScore: {
                totalTasks,
                completedTasks,
                score,
            },
        })
    } catch (error) {
        console.error('Failed to fetch daily score', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
