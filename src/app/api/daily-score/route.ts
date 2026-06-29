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

        const date = new Date(dateStr)
        date.setHours(0, 0, 0, 0)
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

        // Get or create daily score
        let dailyScore = await prisma.dailyScore.findUnique({
            where: { userId_date: { userId, date } },
        })

        if (!dailyScore) {
            dailyScore = await prisma.dailyScore.create({
                data: {
                    userId,
                    date,
                    totalTasks,
                    completedTasks,
                    score,
                },
            })
        } else {
            dailyScore = await prisma.dailyScore.update({
                where: { userId_date: { userId, date } },
                data: { totalTasks, completedTasks, score },
            })
        }

        return NextResponse.json({
            tasks: tasks.map(t => ({
                id: t.id,
                deedId: t.deedId,
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