import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
    parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    startOfQuarter, endOfQuarter, startOfYear, endOfYear,
} from 'date-fns'
import type { ReportType } from '@/lib/reports/types'
import { buildReport } from '@/lib/reports/build'

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

        const report = await buildReport(userId, type as ReportType, start, end)
        return NextResponse.json({ report })
    } catch (error) {
        console.error('Failed to generate report', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

