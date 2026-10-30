import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { recalculateItemProgress } from '@/lib/score'
import { pushTaskToGoogle, deleteTaskFromGoogle } from '@/lib/googleCalendar'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id: taskId } = await params
        const body = await req.json()
        const { title, weight, progress, completed, scheduledTime, startTime, endTime, categoryId, estimatedDuration, priority, goalId, color, reflection, isFrog, isHabit, isRecurring, recurrencePattern, isImportant, reminderMinutes, notifyDeed, endWarnMinutes } = body

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        // Capture original values before any changes
        const originalTitle = task.title
        const originalGoalId = task.goalId

        const updateData: Prisma.TaskUpdateInput = {}
        if (title !== undefined) updateData.title = title
        if (weight !== undefined) updateData.weight = weight
        if (progress !== undefined) updateData.progress = progress
        if (completed !== undefined) updateData.completed = completed
        if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime ? new Date(scheduledTime) : null
        if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null
        if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null
        if (categoryId !== undefined) updateData.categoryId = categoryId
        if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration
        if (priority !== undefined) updateData.priority = priority
        if (goalId !== undefined) updateData.goal = { connect: { id: goalId } }
        if (reflection !== undefined) updateData.reflection = reflection
        if (isFrog !== undefined) updateData.isFrog = isFrog
        if (isHabit !== undefined) updateData.isHabit = isHabit
        if (isImportant !== undefined) updateData.isImportant = isImportant
        if (reminderMinutes !== undefined) updateData.reminderMinutes = reminderMinutes
        if (notifyDeed !== undefined) updateData.notifyDeed = notifyDeed
        if (endWarnMinutes !== undefined) updateData.endWarnMinutes = endWarnMinutes
        // Re-arm notifications whenever the schedule or reminder changed —
        // clearing the stamps lets the countdown / reminder / start / ending /
        // finish notifications fire again against the new times.
        if (
            startTime !== undefined ||
            endTime !== undefined ||
            reminderMinutes !== undefined ||
            isImportant !== undefined ||
            notifyDeed !== undefined ||
            endWarnMinutes !== undefined
        ) {
            updateData.reminderNotifiedAt = null
            updateData.startNotifiedAt = null
            updateData.countdownNotifiedAt = null
            updateData.finishNotifiedAt = null
            updateData.endingNotifiedAt = null
        }
        if (color !== undefined) updateData.color = color
        if (isRecurring !== undefined) updateData.isRecurring = isRecurring
        if (recurrencePattern !== undefined) updateData.recurrencePattern = recurrencePattern

        await prisma.task.update({
            where: { id: taskId },
            data: updateData,
        })

        // ── Series edits ────────────────────────────────────────────────────
        // `scope` says how far a change on a repeating deed/habit reaches:
        //   single → only the edited occurrence (default; nothing else moves)
        //   future → this occurrence and every later one
        //   all    → every occurrence, past and future
        // Per-day state (completed, progress, reflection) is never copied, and
        // existing siblings are updated in place — never deleted and rebuilt —
        // so one edit can no longer reset the rest of the series.
        const scope: 'single' | 'future' | 'all' =
            body.scope === 'future' || body.scope === 'all' ? body.scope : 'single'
        const wasSeries = task.isRecurring || task.isHabit
        const finalIsRecurring = isRecurring !== undefined ? isRecurring : task.isRecurring
        const finalRecurrencePattern = recurrencePattern !== undefined ? recurrencePattern : task.recurrencePattern
        const becameRecurring = !task.isRecurring && !!finalIsRecurring && !!finalRecurrencePattern
        const patternChanged = task.isRecurring && !!finalIsRecurring && recurrencePattern !== undefined && recurrencePattern !== task.recurrencePattern
        const stoppedRecurring = task.isRecurring && isRecurring === false

        const seriesWhere: Prisma.TaskWhereInput = {
            userId,
            title: originalTitle,
            goalId: originalGoalId,
            isHabit: task.isHabit,
            id: { not: taskId },
        }
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const tomorrow = new Date(startOfToday)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // 1. Copy the edited fields onto the other occurrences in scope.
        if (wasSeries && scope !== 'single') {
            const rangeWhere: Prisma.TaskWhereInput =
                scope === 'future' ? { ...seriesWhere, date: { gt: task.date } } : seriesWhere
            const siblings = await prisma.task.findMany({ where: rangeWhere })
            const timeChanged = startTime !== undefined || endTime !== undefined
            const shared: Prisma.TaskUpdateInput = {}
            if (title !== undefined) shared.title = title
            if (weight !== undefined) shared.weight = weight
            if (color !== undefined) shared.color = color
            if (isFrog !== undefined) shared.isFrog = isFrog
            if (isHabit !== undefined) shared.isHabit = isHabit
            if (isImportant !== undefined) shared.isImportant = isImportant
            if (reminderMinutes !== undefined) shared.reminderMinutes = reminderMinutes
            if (notifyDeed !== undefined) shared.notifyDeed = notifyDeed
            if (endWarnMinutes !== undefined) shared.endWarnMinutes = endWarnMinutes
            if (recurrencePattern !== undefined) shared.recurrencePattern = recurrencePattern
            if (isRecurring !== undefined) shared.isRecurring = isRecurring
            if (categoryId !== undefined) shared.categoryId = categoryId

            // Keep each sibling's own day; carry only the time-of-day change.
            const startOffset = timeChanged && startTime ? new Date(startTime).getTime() - task.date.getTime() : null
            const endOffset = timeChanged && endTime ? new Date(endTime).getTime() - task.date.getTime() : null
            const clearStart = startTime !== undefined && !startTime
            const clearEnd = endTime !== undefined && !endTime

            await prisma.$transaction(
                siblings.map(s => {
                    const data: Prisma.TaskUpdateInput = { ...shared }
                    if (startOffset !== null) data.startTime = new Date(s.date.getTime() + startOffset)
                    if (endOffset !== null) data.endTime = new Date(s.date.getTime() + endOffset)
                    if (clearStart) data.startTime = null
                    if (clearEnd) data.endTime = null
                    if (timeChanged || reminderMinutes !== undefined || isImportant !== undefined || notifyDeed !== undefined || endWarnMinutes !== undefined) {
                        data.reminderNotifiedAt = null
                        data.startNotifiedAt = null
                        data.countdownNotifiedAt = null
                        data.finishNotifiedAt = null
                        data.endingNotifiedAt = null
                    }
                    return prisma.task.update({ where: { id: s.id }, data })
                }),
            )
        }

        // 2. A schedule change (new repeat, new pattern, or repeat turned off)
        //    reshapes the days AHEAD only: untouched future copies are swapped
        //    for the new pattern, completed ones and the past stay as they are.
        const reshape = becameRecurring || ((patternChanged || stoppedRecurring) && scope !== 'single')
        if (reshape) {
            const from = new Date(Math.max(tomorrow.getTime(), task.date.getTime() + 86_400_000))
            await prisma.task.deleteMany({
                where: { ...seriesWhere, completed: false, date: { gte: from } },
            })

            if (finalIsRecurring && finalRecurrencePattern) {
                const keptDates = new Set(
                    (await prisma.task.findMany({ where: { ...seriesWhere, date: { gte: from } }, select: { date: true } }))
                        .map(r => r.date.getTime()),
                )
                const fresh = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
                const effectiveEndDate = fresh.recurrenceEnd || new Date(Date.UTC(new Date().getFullYear(), 11, 31, 23, 59, 59, 999))
                const taskDate = fresh.date
                const startOff = fresh.startTime ? fresh.startTime.getTime() - taskDate.getTime() : null
                const endOff = fresh.endTime ? fresh.endTime.getTime() - taskDate.getTime() : null
                const instances: Prisma.TaskCreateManyInput[] = []
                const currentDate = new Date(taskDate)
                currentDate.setUTCDate(currentDate.getUTCDate() + 1)

                while (currentDate <= effectiveEndDate) {
                    const day = currentDate.getUTCDay()
                    let shouldCreate = false
                    switch (finalRecurrencePattern) {
                        case 'daily': shouldCreate = true; break
                        case 'weekly': shouldCreate = day === taskDate.getUTCDay(); break
                        case 'biweekly': shouldCreate = day === taskDate.getUTCDay() && Math.floor((currentDate.getTime() - taskDate.getTime()) / (7 * 86_400_000)) % 2 === 0; break
                        case 'monthly': shouldCreate = currentDate.getUTCDate() === taskDate.getUTCDate(); break
                        case 'yearly': shouldCreate = currentDate.getUTCMonth() === taskDate.getUTCMonth() && currentDate.getUTCDate() === taskDate.getUTCDate(); break
                        case 'weekdays': shouldCreate = day >= 1 && day <= 5; break
                    }
                    if (shouldCreate && currentDate >= from && !keptDates.has(currentDate.getTime())) {
                        instances.push({
                            userId,
                            goalId: fresh.goalId,
                            categoryId: fresh.categoryId,
                            title: fresh.title,
                            weight: fresh.weight,
                            progress: 0,
                            completed: false,
                            date: new Date(currentDate),
                            startTime: startOff !== null ? new Date(currentDate.getTime() + startOff) : null,
                            endTime: endOff !== null ? new Date(currentDate.getTime() + endOff) : null,
                            color: fresh.color,
                            isRecurring: true,
                            recurrencePattern: finalRecurrencePattern,
                            recurrenceEnd: effectiveEndDate,
                            isFrog: fresh.isFrog,
                            isHabit: fresh.isHabit,
                            isImportant: fresh.isImportant,
                            reminderMinutes: fresh.reminderMinutes,
                            notifyDeed: fresh.notifyDeed,
                            endWarnMinutes: fresh.endWarnMinutes,
                        })
                    }
                    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
                }
                if (instances.length > 0) await prisma.task.createMany({ data: instances })
            }
        }

        // Two-way Google Calendar sync — re-push the updated deed (also
        // removes the Google event if the schedule was cleared). No-op
        // unless connected in two-way mode; never throws.
        const freshTask = await prisma.task.findUnique({ where: { id: taskId } })
        if (freshTask) await pushTaskToGoogle(userId, freshTask)

        // Recalculate goal score
        const finalGoalId = goalId !== undefined ? goalId : task.goalId
        await recalculateItemProgress(finalGoalId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

/**
 * How much of a recurring series a delete should take out.
 *   single → only the clicked occurrence
 *   future → the clicked occurrence and every later one
 *   all    → every occurrence that ever existed (past + future)
 */
type DeleteScope = 'single' | 'future' | 'all'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id: taskId } = await params
        const { searchParams } = new URL(req.url)
        const scopeParam = searchParams.get('scope')
        const deleteAll = searchParams.get('deleteAll') === 'true'

        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
        })
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        const goalId = task.goalId

        // Only a series can be deleted in bulk — a one-shot deed always goes
        // on its own, whatever scope the caller asked for.
        const isSeries = task.isRecurring || task.isHabit
        const scope: DeleteScope =
            !isSeries ? 'single'
                : scopeParam === 'all' || scopeParam === 'future' || scopeParam === 'single'
                    ? (scopeParam as DeleteScope)
                    : 'single'

        // Instances of one series are keyed by title + owning goal + habit
        // flag — the same identity PUT regeneration and the Google series
        // lookup use.
        const seriesWhere: Prisma.TaskWhereInput = {
            userId,
            title: task.title,
            goalId: task.goalId,
            isHabit: task.isHabit,
        }

        // Boundary = the clicked occurrence's own stored date. Every instance
        // of a series is generated from one starting date with identical
        // time-of-day handling, so `date >= boundary` selects exactly this
        // occurrence and the later ones — without any timezone guesswork.
        const cutFrom = new Date(task.date)
        let truncatedFrom: Date | null = null

        if (!scopeParam && deleteAll && task.isHabit) {
            // Legacy habit-menu flag (kept for older callers): everything from
            // today onwards, so past completions stay for the habit graph.
            const now = new Date()
            now.setHours(0, 0, 0, 0)
            await prisma.task.deleteMany({ where: { ...seriesWhere, date: { gte: now } } })
        } else if (scope === 'all') {
            // Whole series — history included.
            await prisma.task.deleteMany({ where: seriesWhere })
        } else if (scope === 'future') {
            // This occurrence and everything after it.
            await prisma.task.deleteMany({ where: { ...seriesWhere, date: { gte: cutFrom } } })

            // Cap the survivors' recurrence so a later edit can't regenerate
            // the occurrences we just removed.
            const survivors = await prisma.task.updateMany({
                where: { ...seriesWhere, date: { lt: cutFrom } },
                data: { recurrenceEnd: new Date(cutFrom.getTime() - 1) },
            })
            // Nothing left before the cut → the whole series is gone; tell
            // Google to drop the master event rather than clamp its RRULE.
            truncatedFrom = survivors.count > 0 ? cutFrom : null
        } else {
            // Just the clicked occurrence.
            await prisma.task.delete({ where: { id: taskId } })
        }

        // Two-way Google Calendar sync — remove (or clamp) the pushed event.
        // No-op if the deed was never pushed; never throws.
        const deleteGoogleSeries = scope === 'all' || (scope === 'future' && !truncatedFrom)
        await deleteTaskFromGoogle(userId, task, {
            deleteAll: deleteGoogleSeries,
            truncateFrom: truncatedFrom,
        })

        // Recalculate goal score
        await recalculateItemProgress(goalId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete task', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
