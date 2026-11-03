// Tools that change the user's schedule and records the way the user would:
// by calling Inchstone's own API route handlers. Each handler reads the user
// from the Clerk session of the chat request (never from the model), and runs
// its normal validation and side effects: score recalculation, series
// handling, notification re-arming, Google Calendar sync, purse rules.
import prisma from '@/lib/prisma'
import * as tasksApi from '@/app/api/tasks/route'
import * as taskApi from '@/app/api/tasks/[id]/route'
import * as itemsApi from '@/app/api/items/route'
import * as itemApi from '@/app/api/items/[id]/route'
import * as financeApi from '@/app/api/financial/route'
import * as eventsApi from '@/app/api/events/route'
import * as alarmsApi from '@/app/api/alarms/route'
import * as bottleEntriesApi from '@/app/api/bottles/entries/route'
import type { Tool, ToolCtx } from './tools'
import type { ToolSpec } from './llm'

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

/** Call a route handler in-process, exactly as the browser would call the endpoint. */
async function call(handler: unknown, method: string, path: string, body?: unknown, params: Record<string, string> = {}) {
  const req = new Request(`http://inchstone.internal${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const res = await (handler as Handler)(req, { params: Promise.resolve(params) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> }
}

const fail = (r: { status: number; data: Record<string, unknown> }) => ({ error: String(r.data.error || `Request failed (${r.status})`) })

// ── Dates in the user's own clock ──
const DAY = 86_400_000
const dateOnly = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null)
const hhmm = (v: unknown) => {
  const m = typeof v === 'string' ? v.trim().match(/^(\d{1,2}):(\d{2})$/) : null
  return m && +m[1] < 24 && +m[2] < 60 ? [+m[1], +m[2]] as const : null
}
/** "2026-11-03" + "14:30" in the viewer's timezone → ISO instant. */
function at(date: string, time: readonly [number, number], tzOffset: number) {
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, time[0], time[1]) + tzOffset * 60_000).toISOString()
}
const utcDay = (date: string) => new Date(`${date}T00:00:00.000Z`)

/** The day item (layer 6) for a date, created under its week like the Day page does. */
async function dayItemFor(date: string, { userId }: ToolCtx): Promise<string | { error: string }> {
  const start = utcDay(date)
  const existing = await prisma.item.findFirst({
    where: { userId, layer: 6, startDate: { gte: new Date(start.getTime() - DAY / 2), lt: new Date(start.getTime() + DAY) } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, startDate: true },
  })
  if (existing) return existing.id
  const week = await prisma.item.findFirst({
    where: { userId, layer: 5, startDate: { lte: new Date(start.getTime() + DAY - 1) }, endDate: { gte: start } },
    select: { id: true },
  })
  const weekday = start.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  const r = await call(itemsApi.POST, 'POST', '/api/items', {
    layer: 6, parentId: week?.id ?? null, title: weekday, weight: 14.3, startDate: date, endDate: date,
  })
  const item = r.data.item as { id?: string } | undefined
  return r.ok && item?.id ? item.id : { error: 'Could not create the day for that date' }
}

async function ownTask(id: unknown, { userId }: ToolCtx) {
  return typeof id === 'string' ? prisma.task.findFirst({ where: { id, userId } }) : null
}

const REPEATS = ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly']
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(+v) ? +v : undefined)

const spec = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolSpec => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
})
const s = (d: string) => ({ type: 'string', description: d })
const b = (d: string) => ({ type: 'boolean', description: d })
const n = (d: string) => ({ type: 'number', description: d })
const SCOPE = { type: 'string', enum: ['single', 'future', 'all'], description: 'For repeating deeds/habits: just this day (single, default), this and later days (future), or every day (all)' }

export const ACTION_TOOLS: Tool[] = [
  {
    mutates: true,
    spec: spec('add_deed', 'Schedule a deed (task) on a day, like adding it on the Day page. Times are the user\'s local HH:mm.', {
      date: s('Day YYYY-MM-DD'),
      title: s('What to do'),
      start: s('Start time HH:mm (optional)'),
      end: s('End time HH:mm (optional)'),
      points: n('Weight/points, default 10'),
      habit: b('A daily habit that repeats every day from this date'),
      frog: b('The hardest, most important task of the day'),
      important: b('Very important: rings a full alarm before it starts'),
      reminder_minutes: n('With important: minutes before start to ring'),
      repeat: { type: 'string', enum: REPEATS, description: 'Repeat pattern for a recurring deed' },
      repeat_until: s('Last day of the repeat YYYY-MM-DD'),
      priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority' },
    }, ['date', 'title']),
    async run(a, ctx) {
      const date = dateOnly(a.date)
      const title = typeof a.title === 'string' ? a.title.trim().slice(0, 200) : ''
      if (!date || !title) return { result: { error: 'date (YYYY-MM-DD) and title are required' } }
      const goalId = await dayItemFor(date, ctx)
      if (typeof goalId !== 'string') return { result: goalId }
      const st = hhmm(a.start), et = hhmm(a.end)
      const repeat = typeof a.repeat === 'string' && REPEATS.includes(a.repeat) ? a.repeat : null
      const until = dateOnly(a.repeat_until)
      const r = await call(tasksApi.POST, 'POST', '/api/tasks', {
        goalId, title, date,
        startTime: st ? at(date, st, ctx.tzOffset) : null,
        endTime: et ? at(date, et, ctx.tzOffset) : null,
        weight: num(a.points) && num(a.points)! > 0 ? num(a.points) : 10,
        priority: typeof a.priority === 'string' ? a.priority : null,
        isRecurring: !!repeat,
        recurrencePattern: repeat,
        recurrenceEnd: repeat && until ? new Date(`${until}T23:59:59.000Z`).toISOString() : null,
        isFrog: !!a.frog,
        isHabit: !!a.habit,
        isImportant: !!a.important,
        reminderMinutes: a.important ? (num(a.reminder_minutes) ?? 10) : null,
        notifyDeed: !!st,
        endWarnMinutes: st ? 10 : null,
      })
      if (!r.ok) return { result: fail(r) }
      const task = (r.data.task ?? r.data) as { id?: string }
      return { result: { id: task.id, date, title }, summary: `Scheduled "${title}" on ${date}${st ? ` at ${a.start}` : ''}` }
    },
  },
  {
    mutates: true,
    spec: spec('update_deed', 'Change a deed: rename, change times, points, priority, frog/habit/important flags or the reminder. Get task ids from query_my_data (table tasks).', {
      task_id: s('Task id'),
      title: s('New title'),
      start: s('New start HH:mm, or "" to clear'),
      end: s('New end HH:mm, or "" to clear'),
      points: n('New weight/points'),
      priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority' },
      frog: b('Frog flag'),
      important: b('Very important flag'),
      reminder_minutes: n('Reminder minutes before start'),
      scope: SCOPE,
    }, ['task_id']),
    async run(a, ctx) {
      const task = await ownTask(a.task_id, ctx)
      if (!task) return { result: { error: 'Task not found' } }
      const day = task.date.toISOString().slice(0, 10)
      const body: Record<string, unknown> = { scope: a.scope }
      if (typeof a.title === 'string' && a.title.trim()) body.title = a.title.trim().slice(0, 200)
      if (a.start !== undefined) { const t = hhmm(a.start); body.startTime = t ? at(day, t, ctx.tzOffset) : null }
      if (a.end !== undefined) { const t = hhmm(a.end); body.endTime = t ? at(day, t, ctx.tzOffset) : null }
      if (num(a.points) !== undefined) body.weight = num(a.points)
      if (typeof a.priority === 'string') body.priority = a.priority
      if (typeof a.frog === 'boolean') body.isFrog = a.frog
      if (typeof a.important === 'boolean') body.isImportant = a.important
      if (num(a.reminder_minutes) !== undefined) body.reminderMinutes = num(a.reminder_minutes)
      if (Object.keys(body).length === 1) return { result: { error: 'Nothing to change' } }
      const r = await call(taskApi.PUT, 'PUT', `/api/tasks/${task.id}`, body, { id: task.id })
      return r.ok ? { result: { ok: true }, summary: `Updated "${body.title ?? task.title}"` } : { result: fail(r) }
    },
  },
  {
    mutates: true,
    spec: spec('set_deed_done', 'Tick a deed off (done) or untick it, like the checkbox on the Day page.', {
      task_id: s('Task id'),
      done: b('true = done, false = not done'),
    }, ['task_id', 'done']),
    async run(a, ctx) {
      const task = await ownTask(a.task_id, ctx)
      if (!task) return { result: { error: 'Task not found' } }
      const done = !!a.done
      const r = await call(taskApi.PUT, 'PUT', `/api/tasks/${task.id}`, { completed: done, progress: done ? 100 : 0 }, { id: task.id })
      return r.ok ? { result: { ok: true }, summary: `${done ? 'Ticked off' : 'Unticked'} "${task.title}"` } : { result: fail(r) }
    },
  },
  {
    mutates: true,
    spec: spec('move_deed', 'Move a one-off deed to another day (and optionally new times). Repeating deeds cannot be moved; change their times with update_deed instead.', {
      task_id: s('Task id'),
      new_date: s('Target day YYYY-MM-DD'),
      start: s('Start HH:mm on the new day (default: keep the same time)'),
      end: s('End HH:mm on the new day (default: keep the same time)'),
    }, ['task_id', 'new_date']),
    async run(a, ctx) {
      const task = await ownTask(a.task_id, ctx)
      if (!task) return { result: { error: 'Task not found' } }
      if (task.isRecurring || task.isHabit) return { result: { error: 'Repeating deeds and habits cannot be moved to another day' } }
      const date = dateOnly(a.new_date)
      if (!date) return { result: { error: 'new_date must be YYYY-MM-DD' } }
      const goalId = await dayItemFor(date, ctx)
      if (typeof goalId !== 'string') return { result: goalId }
      const keep = (d: Date | null) => {
        if (!d) return null
        const local = new Date(d.getTime() - ctx.tzOffset * 60_000)
        return [local.getUTCHours(), local.getUTCMinutes()] as const
      }
      const st = a.start !== undefined ? hhmm(a.start) : keep(task.startTime)
      const et = a.end !== undefined ? hhmm(a.end) : keep(task.endTime)
      // Same as a person would: add it on the new day, then remove the old one.
      const created = await call(tasksApi.POST, 'POST', '/api/tasks', {
        goalId, title: task.title, date,
        startTime: st ? at(date, st, ctx.tzOffset) : null,
        endTime: et ? at(date, et, ctx.tzOffset) : null,
        weight: task.weight, priority: task.priority, color: task.color, categoryId: task.categoryId,
        estimatedDuration: task.estimatedDuration, isFrog: task.isFrog, isImportant: task.isImportant,
        reminderMinutes: task.reminderMinutes, notifyDeed: task.notifyDeed && !!st, endWarnMinutes: task.endWarnMinutes,
        reflection: task.reflection,
      })
      if (!created.ok) return { result: fail(created) }
      const removed = await call(taskApi.DELETE, 'DELETE', `/api/tasks/${task.id}?scope=single`, undefined, { id: task.id })
      if (!removed.ok) return { result: { error: `Added on ${date} but could not remove the original: ${fail(removed).error}` } }
      return { result: { ok: true, date }, summary: `Moved "${task.title}" to ${date}` }
    },
  },
  {
    mutates: true,
    spec: spec('delete_deed', 'Delete a deed. ONLY call after the user has clearly said yes to deleting it in this conversation; set confirmed=true then.', {
      task_id: s('Task id'),
      scope: SCOPE,
      confirmed: b('The user explicitly confirmed this deletion'),
    }, ['task_id', 'confirmed']),
    async run(a, ctx) {
      if (a.confirmed !== true) return { result: { error: 'Ask the user to confirm the deletion first' } }
      const task = await ownTask(a.task_id, ctx)
      if (!task) return { result: { error: 'Task not found' } }
      const scope = a.scope === 'future' || a.scope === 'all' ? a.scope : 'single'
      const r = await call(taskApi.DELETE, 'DELETE', `/api/tasks/${task.id}?scope=${scope}`, undefined, { id: task.id })
      return r.ok ? { result: { ok: true }, summary: `Deleted "${task.title}"${scope !== 'single' ? ` (${scope})` : ''}` } : { result: fail(r) }
    },
  },
  {
    mutates: true,
    spec: spec('write_day_reflection', 'Save the reflection for a day (the reflection box on the Day page). Typing @Bottle amount in it pours into that challenge bottle. Appends by default.', {
      date: s('Day YYYY-MM-DD'),
      text: s('Reflection text'),
      replace: b('Replace the existing reflection instead of appending'),
    }, ['date', 'text']),
    async run(a, ctx) {
      const date = dateOnly(a.date)
      const text = typeof a.text === 'string' ? a.text.trim().slice(0, 5000) : ''
      if (!date || !text) return { result: { error: 'date and text are required' } }
      const id = await dayItemFor(date, ctx)
      if (typeof id !== 'string') return { result: id }
      const item = await prisma.item.findFirst({ where: { id, userId: ctx.userId }, select: { reflection: true } })
      const next = a.replace || !item?.reflection ? text : `${item.reflection}\n\n${text}`
      const r = await call(itemApi.PUT, 'PUT', `/api/items/${id}`, { reflection: next }, { id })
      return r.ok ? { result: { ok: true }, summary: `Saved your reflection for ${date}` } : { result: fail(r) }
    },
  },
  {
    mutates: true,
    spec: spec('log_money', 'Record income or an expense, like the Finance page. Income always goes to the Main purse; expenses come from the named purse (default Main), need enough balance, and must say which envelope they belong to.', {
      type: { type: 'string', enum: ['income', 'expense'], description: 'income or expense' },
      amount: n('Amount (positive)'),
      category: s('Category, e.g. Food, Transport, Salary'),
      purse: s('Purse name for an expense (default Main)'),
      date: s('Day YYYY-MM-DD (default today)'),
      description: s('What it was'),
      currency: s('Currency code, default NGN'),
      envelope: { type: 'string', enum: ['Need', 'Want', 'Offerings', 'Savings'], description: 'For an expense: Need (essentials), Want (lifestyle), Offerings (giving, tithe) or Savings. Required for expenses; ask the user if unclear.' },
    }, ['type', 'amount', 'category']),
    async run(a, ctx) {
      const amount = num(a.amount)
      if (!amount || amount <= 0) return { result: { error: 'amount must be positive' } }
      const date = dateOnly(a.date)
      const r = await call(financeApi.POST, 'POST', '/api/financial', {
        type: a.type, amount, category: String(a.category || '').slice(0, 80),
        purse: typeof a.purse === 'string' ? a.purse : undefined,
        priority: a.type === 'expense' ? a.envelope : undefined,
        entryDate: date ? at(date, [12, 0], ctx.tzOffset) : new Date().toISOString(),
        description: typeof a.description === 'string' ? a.description.slice(0, 300) : null,
        currency: typeof a.currency === 'string' ? a.currency.toUpperCase().slice(0, 3) : 'NGN',
      })
      return r.ok
        ? { result: { ok: true }, summary: `Logged ${a.type} of ${amount.toLocaleString()} (${a.category})` }
        : { result: fail(r) }
    },
  },
  {
    mutates: true,
    spec: spec('add_event', 'Put an event on the calendar.', {
      title: s('Event title'),
      date: s('Day YYYY-MM-DD'),
      start: s('Start HH:mm'),
      end: s('End HH:mm'),
      type: s('Kind of event, default "event"'),
    }, ['title', 'date', 'start', 'end']),
    async run(a, ctx) {
      const date = dateOnly(a.date), st = hhmm(a.start), et = hhmm(a.end)
      if (!date || !st || !et || typeof a.title !== 'string') return { result: { error: 'title, date, start and end are required' } }
      const r = await call(eventsApi.POST, 'POST', '/api/events', {
        title: a.title.slice(0, 200), startTime: at(date, st, ctx.tzOffset), endTime: at(date, et, ctx.tzOffset), type: a.type || 'event',
      })
      return r.ok ? { result: { ok: true }, summary: `Added "${a.title}" to the calendar on ${date}` } : { result: fail(r) }
    },
  },
  {
    mutates: true,
    spec: spec('set_alarm', 'Create a recurring alarm (rings in the app and as a push notification).', {
      title: s('Alarm label'),
      time: s('Time HH:mm in the user\'s clock'),
      days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: 'Weekdays, 0=Sunday..6=Saturday (default every day)' },
      timezone: s('IANA timezone, e.g. Africa/Lagos'),
    }, ['title', 'time']),
    async run(a, ctx) {
      if (!hhmm(a.time) || typeof a.title !== 'string') return { result: { error: 'title and time HH:mm are required' } }
      const r = await call(alarmsApi.POST, 'POST', '/api/alarms', { title: a.title, time: a.time, days: a.days, tz: a.timezone || ctx.timeZone || 'Africa/Lagos' })
      return r.ok ? { result: { ok: true }, summary: `Alarm "${a.title}" set for ${a.time}` } : { result: fail(r) }
    },
  },
  {
    mutates: true,
    spec: spec('pour_into_bottle', 'Add an amount to a challenge bottle (creates the bottle if the name is new).', {
      bottle: s('Bottle name, e.g. Workout'),
      amount: n('Amount to pour'),
      note: s('What it was for'),
    }, ['bottle', 'amount']),
    async run(a) {
      const amount = num(a.amount)
      if (!amount || typeof a.bottle !== 'string') return { result: { error: 'bottle and a non-zero amount are required' } }
      const r = await call(bottleEntriesApi.POST, 'POST', '/api/bottles/entries', {
        bottleName: a.bottle.trim(), amount, note: typeof a.note === 'string' ? a.note : null, sourceType: 'manual',
      })
      return r.ok ? { result: { ok: true }, summary: `Poured ${amount} into ${a.bottle}` } : { result: fail(r) }
    },
  },
]
