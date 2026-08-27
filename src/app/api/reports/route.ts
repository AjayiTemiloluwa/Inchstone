import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import {
    format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    startOfQuarter, endOfQuarter, startOfYear, endOfYear,
} from 'date-fns'
import type { ReportType, ReportDay, ReportCategory, ReportPriority } from '@/lib/reports/types'

export async function GET(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type') as ReportType | null
        const dateStr = searchParams.get('date') || new Date().toISOString()

        let start: Date
        let end: Date

        if (type === 'custom') {
            // Custom arbitrary range from explicit start/end (yyyy-mm-dd).
            const rawStart = searchParams.get('start')
            const rawEnd = searchParams.get('end')
            if (!rawStart || !rawEnd) {
                return NextResponse.json({ error: 'custom type requires start & end dates' }, { status: 400 })
            }
            start = parseISO(rawStart)
            end = parseISO(rawEnd)
        } else {
            const centerDate = parseISO(dateStr)
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
        }

        end.setHours(23, 59, 59, 999)

        const [tasks, notes, categories] = await Promise.all([
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
                where: { userId, layer: 1 },
                select: { id: true, title: true },
            }),
        ])

        // Map category id -> title (category nodes live at layer 1)
        const categoryTitle = new Map<string, string>()
        categories.forEach(c => categoryTitle.set(c.id, c.title))

        // Build daily summary (contiguous calendar days within the period)
        const days = new Map<string, ReportDay>()
        const dayCursor = new Date(start)
        while (dayCursor <= end) {
            const key = format(dayCursor, 'yyyy-MM-dd')
            days.set(key, { date: key, tasks: [], notes: [], score: 0, total: 0, completed: 0, active: false })
            dayCursor.setDate(dayCursor.getDate() + 1)
        }

        // Goal titles live on the raw Prisma rows (entry.tasks is later
        // re-projected into ReportTasks); snapshot them per task id.
        const goalTitles = new Map<string, string | null>()
        tasks.forEach(task => {
            const key = format(new Date(task.date), 'yyyy-MM-dd')
            const entry = days.get(key)
            if (entry) {
                entry.tasks.push(task)
                goalTitles.set(task.id, task.goal?.title ?? null)
            }
        })

        notes.forEach(note => {
            const key = format(new Date(note.createdAt), 'yyyy-MM-dd')
            const entry = days.get(key)
            if (entry) {
                // Project onto the wire-friendly ReportNote shape.
                entry.notes.push({ id: note.id, title: note.title, createdAt: note.createdAt.toISOString() })
            }
        })

        const dayList: ReportDay[] = []
        days.forEach(entry => {
            const weightTotal = entry.tasks.reduce((sum, t) => sum + (t.weight || 0), 0)
            const weightDone = entry.tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.weight || 0), 0)
            entry.score = weightTotal > 0 ? Math.round((weightDone / weightTotal) * 100) : 0
            entry.total = entry.tasks.length
            entry.completed = entry.tasks.filter(t => t.completed).length
            entry.active = entry.tasks.length > 0 || entry.notes.length > 0
            entry.tasks = entry.tasks.map(t => ({
                id: t.id,
                title: t.title,
                weight: t.weight,
                completed: t.completed,
                categoryId: t.categoryId,
                categoryTitle: t.categoryId ? (categoryTitle.get(t.categoryId) ?? null) : null,
                priority: t.priority,
                isFrog: t.isFrog,
                isHabit: t.isHabit,
                estimatedDuration: t.estimatedDuration,
                actualDuration: t.actualDuration,
                goalTitle: goalTitles.get(t.id) ?? null,
            }))
            dayList.push(entry)
        })

        // ── Roll-up stats ────────────────────────────────────────────────
        const activeDays = dayList.filter(d => d.active)
        const weightedTotal = tasks.reduce((s, t) => s + (t.weight || 0), 0)
        const weightedCompleted = tasks.filter(t => t.completed).reduce((s, t) => s + (t.weight || 0), 0)

        let bestDay: ReportDay | null = null
        let worstActive: ReportDay | null = null
        // Plain for…of (not forEach) so TypeScript's control-flow analysis
        // can track the mutations without narrowing to never.
        for (const d of activeDays) {
            if (!bestDay || d.score > bestDay.score) bestDay = d
            if (d.completed > 0 && (!worstActive || d.score < worstActive.score)) worstActive = d
        }

        // Streaks: consecutive calendar days whose completed-weight > 0
        let bestStreak = 0
        let run = 0
        dayList.forEach(d => {
            const dayDone = d.tasks.some(t => t.completed)
            if (dayDone) {
                run += 1
                if (run > bestStreak) bestStreak = run
            } else {
                run = 0
            }
        })
        let currentStreak = 0
        for (let i = dayList.length - 1; i >= 0; i--) {
            if (dayList[i].tasks.some(t => t.completed)) currentStreak++
            else break
        }

        const frogsTotal = tasks.filter(t => t.isFrog).length
        const frogsCompleted = tasks.filter(t => t.isFrog && t.completed).length
        const habitsTotal = tasks.filter(t => t.isHabit).length
        const habitsCompleted = tasks.filter(t => t.isHabit && t.completed).length

        const totalEstimatedMinutes = tasks.reduce((s, t) => s + (t.estimatedDuration || 0), 0)
        const totalActualMinutes = tasks.reduce((s, t) => s + (t.actualDuration || 0), 0)
        const avgTasksPerActiveDay = activeDays.length ? Math.round((tasks.length / activeDays.length) * 10) / 10 : 0
        const avgScore = dayList.length ? Math.round(dayList.reduce((s, d) => s + d.score, 0) / dayList.length) : 0

        // ── Category breakdown ──────────────────────────────────────────
        const catMap = new Map<string, ReportCategory>()
        tasks.forEach(t => {
            const id = t.categoryId ?? 'uncategorized'
            const title = t.categoryId ? (categoryTitle.get(t.categoryId) ?? 'Uncategorized') : 'Uncategorized'
            let cat = catMap.get(id)
            if (!cat) { cat = { id: t.categoryId, title, total: 0, completed: 0 }; catMap.set(id, cat) }
            cat.total++
            if (t.completed) cat.completed++
        })
        const categoriesReport = Array.from(catMap.values()).sort((a, b) => b.total - a.total)

        // ── Priority breakdown ──────────────────────────────────────────
        const prioMap = new Map<string, ReportPriority>()
        tasks.forEach(t => {
            const p = t.priority ?? 'Unassigned'
            let row = prioMap.get(p)
            if (!row) { row = { priority: p, total: 0, completed: 0 }; prioMap.set(p, row) }
            row.total++
            if (t.completed) row.completed++
        })
        const priorities = Array.from(prioMap.values()).sort((a, b) => {
            const ia = a.priority in PRIO_RANK ? PRIO_RANK[a.priority] : -1
            const ib = b.priority in PRIO_RANK ? PRIO_RANK[b.priority] : -1
            if (ia !== -1 && ib !== -1) return ia - ib
            if (ia !== -1) return -1
            if (ib !== -1) return 1
            return 0
        })

        const report = {
            type,
            period: { start: start.toISOString(), end: end.toISOString() },
            days: dayList,
            stats: {
                totalTasks: tasks.length,
                completedTasks: tasks.filter(t => t.completed).length,
                totalNotes: notes.length,
                avgScore,
                weightedCompleted,
                weightedTotal,
                completion: weightedTotal > 0 ? Math.round((weightedCompleted / weightedTotal) * 100) : 0,
                activeDays: activeDays.length,
                bestDay: bestDay ? bestDay.date : null,
                bestDayScore: bestDay ? bestDay.score : 0,
                worstDay: worstActive ? worstActive.date : null,
                worstDayScore: worstActive ? worstActive.score : 0,
                bestStreak,
                currentStreak,
                frogsTotal,
                frogsCompleted,
                habitsTotal,
                habitsCompleted,
                totalEstimatedMinutes,
                totalActualMinutes,
                avgTasksPerActiveDay,
            },
            categories: categoriesReport,
            priorities,
        }

        return NextResponse.json({ report })
    } catch (error) {
        console.error('Failed to generate report', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

const prioRank: Record<string, number> = { high: 0, medium: 1, low: 2, Unassigned: 3 }
const PRIO_RANK = prioRank
