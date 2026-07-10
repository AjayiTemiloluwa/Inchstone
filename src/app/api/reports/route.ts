import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type') // 'weekly' | 'monthly' | 'quarterly' | 'yearly'
        const dateStr = searchParams.get('date') || new Date().toISOString()

        const centerDate = parseISO(dateStr)
        let start: Date
        let end: Date

        switch (type) {
            case 'weekly':
                start = startOfWeek(centerDate, { weekStartsOn: 1 })
                end = endOfWeek(centerDate, { weekStartsOn: 1 })
                break
            case 'monthly':
                start = startOfMonth(centerDate)
                end = endOfMonth(centerDate)
                break
            case 'quarterly':
                start = startOfQuarter(centerDate)
                end = endOfQuarter(centerDate)
                break
            case 'yearly':
                start = startOfYear(centerDate)
                end = endOfYear(centerDate)
                break
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
        }

        end.setHours(23, 59, 59, 999)

        const [tasks, notes, items] = await Promise.all([
            prisma.task.findMany({
                where: { userId, date: { gte: start, lte: end } },
                orderBy: { date: 'asc' },
                include: { goal: true },
            }),
            prisma.note.findMany({
                where: { userId, createdAt: { gte: start, lte: end } },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.item.findMany({
                where: { userId, layer: { gte: 2, lte: 6 } },
                include: { tasks: true },
            }),
        ])

        // Build daily summary
        const days = new Map<string, { date: string; tasks: any[]; notes: any[]; score: number }>()
        const dayCursor = new Date(start)
        while (dayCursor <= end) {
            const key = format(dayCursor, 'yyyy-MM-dd')
            days.set(key, { date: key, tasks: [], notes: [], score: 0 })
            dayCursor.setDate(dayCursor.getDate() + 1)
        }

        tasks.forEach(task => {
            const key = format(new Date(task.date), 'yyyy-MM-dd')
            const entry = days.get(key)
            if (entry) entry.tasks.push(task)
        })

        notes.forEach(note => {
            const key = format(new Date(note.createdAt), 'yyyy-MM-dd')
            const entry = days.get(key)
            if (entry) entry.notes.push(note)
        })

        days.forEach(entry => {
            const total = entry.tasks.reduce((sum, t) => sum + (t.weight || 0), 0)
            const completed = entry.tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.weight || 0), 0)
            entry.score = total > 0 ? Math.round((completed / total) * 100) : 0
        })

        const report = {
            type,
            period: { start: start.toISOString(), end: end.toISOString() },
            days: Array.from(days.values()),
            stats: {
                totalTasks: tasks.length,
                completedTasks: tasks.filter(t => t.completed).length,
                totalNotes: notes.length,
                avgScore: days.size ? Math.round(Array.from(days.values()).reduce((s, d) => s + d.score, 0) / days.size) : 0,
            },
        }

        return NextResponse.json({ report })
    } catch (error) {
        console.error('Failed to generate report', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
