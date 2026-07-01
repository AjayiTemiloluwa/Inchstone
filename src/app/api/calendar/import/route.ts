import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

function parseICSDate(val: string): Date {
    // ICS format: 20260101T120000 or 20260101
    if (val.includes('T')) {
        const dateStr = val.substring(0, 8)
        const timeStr = val.substring(9, 15)
        const year = dateStr.substring(0, 4)
        const month = dateStr.substring(4, 6)
        const day = dateStr.substring(6, 8)
        const hour = timeStr.substring(0, 2)
        const min = timeStr.substring(2, 4)
        const sec = timeStr.substring(4, 6)
        return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`)
    } else {
        const year = val.substring(0, 4)
        const month = val.substring(4, 6)
        const day = val.substring(6, 8)
        return new Date(`${year}-${month}-${day}T00:00:00`)
    }
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const text = await file.text()
        const lines = text.split('\n')

        const events: Array<{ title: string; startTime: Date; endTime: Date }> = []
        let currentEvent: any = {}
        let inEvent = false

        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed === 'BEGIN:VEVENT') {
                currentEvent = {}
                inEvent = true
            } else if (trimmed === 'END:VEVENT') {
                if (currentEvent.summary && currentEvent.dtstart) {
                    events.push({
                        title: currentEvent.summary,
                        startTime: new Date(currentEvent.dtstart),
                        endTime: currentEvent.dtend ? new Date(currentEvent.dtend) : new Date(currentEvent.dtstart),
                    })
                }
                currentEvent = {}
                inEvent = false
            } else if (inEvent) {
                if (trimmed.startsWith('SUMMARY')) {
                    const val = trimmed.substring(trimmed.indexOf(':') + 1).trim()
                    currentEvent.summary = decodeURIComponent(val.replace(/\\,/g, ','))
                } else if (trimmed.startsWith('DTSTART')) {
                    const val = trimmed.substring(trimmed.indexOf(':') + 1).trim()
                    currentEvent.dtstart = parseICSDate(val)
                } else if (trimmed.startsWith('DTEND')) {
                    const val = trimmed.substring(trimmed.indexOf(':') + 1).trim()
                    currentEvent.dtend = parseICSDate(val)
                }
            }
        }

        // Bulk insert events
        let imported = 0
        for (const event of events) {
            try {
                await prisma.event.create({
                    data: {
                        userId,
                        title: event.title,
                        startTime: event.startTime,
                        endTime: event.endTime,
                        type: 'ics_imported',
                    },
                })
                imported++
            } catch (e) {
                console.error('Failed to import event:', event.title, e)
            }
        }

        return NextResponse.json({ success: true, imported, total: events.length })
    } catch (error) {
        console.error('Failed to import calendar', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

