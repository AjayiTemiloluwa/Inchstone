// Read-only access to everything the signed-in user owns (server only).
//
// Isolation: the owner filter comes from the Clerk session (ToolCtx.userId),
// never from the model's arguments — no tool accepts a user id. Every query
// is built here as `where: { AND: [ownerFilter, ...filters] }`, so no
// filter the model sends can widen it. Each table lists the exact columns it
// may return; secrets (OAuth tokens, push keys, widget secret, invite codes,
// file bytes) are never selectable, and tables holding them are not listed.
import prisma from '@/lib/prisma'
import { buildReport } from '@/lib/reports/build'
import { endOfMonth, endOfQuarter, endOfWeek, endOfYear, startOfMonth, startOfQuarter, startOfWeek, startOfYear } from 'date-fns'
import type { Tool, ToolCtx } from './tools'

type Delegate = { findMany: (a: unknown) => Promise<Record<string, unknown>[]>; count: (a: unknown) => Promise<number> }

interface TableSpec {
  model: string
  about: string
  fields: string[]
  /** Column used for from/to date filters and default newest-first order. */
  date: string
  /** Text columns matched by `search`. */
  search: string[]
  /** Owner filter; most tables are { userId }. */
  owner?: (userId: string) => Record<string, unknown>
}

export const TABLES: Record<string, TableSpec> = {
  plan_items: {
    model: 'item',
    about: 'The planning hierarchy. layer: 0 Year, 1 Category, 2 Yearly goal/Why, 3 Quarterly quest, 4 Monthly milestone, 5 Weekly win, 6 Daily deed (a day). parentId links them.',
    fields: ['id', 'layer', 'parentId', 'title', 'description', 'status', 'completed', 'progress', 'category', 'startDate', 'endDate', 'isRecurring', 'recurrencePattern', 'theme', 'focusQuestion', 'anchorScripture', 'reflection', 'updatedAt'],
    date: 'startDate',
    search: ['title', 'description', 'theme', 'reflection'],
  },
  tasks: {
    model: 'task',
    about: 'Deeds/tasks on a day. goalId is the plan item they belong to; isHabit, isFrog (hardest task), priority, times and duration in minutes.',
    fields: ['id', 'goalId', 'title', 'date', 'startTime', 'endTime', 'completed', 'progress', 'priority', 'isFrog', 'isHabit', 'isImportant', 'isRecurring', 'recurrencePattern', 'estimatedDuration', 'actualDuration', 'reflection'],
    date: 'date',
    search: ['title', 'reflection'],
  },
  daily_scores: {
    model: 'dailyScore',
    about: 'One row per day: tasks planned, tasks completed and the day score (0-100).',
    fields: ['date', 'totalTasks', 'completedTasks', 'score'],
    date: 'date',
    search: [],
  },
  reflections: {
    model: 'reflection',
    about: 'Written reflections for a period (timePeriod: day/week/month/quarter/year, periodKey like 2026-10-31).',
    fields: ['id', 'itemId', 'timePeriod', 'periodKey', 'content', 'updatedAt'],
    date: 'updatedAt',
    search: ['content', 'periodKey'],
  },
  reviews: {
    model: 'review',
    about: 'Period reviews: mood and energy (1-5), wins, misses, reflection, tomorrow top 3.',
    fields: ['id', 'periodType', 'periodStart', 'mood', 'energy', 'reflection', 'wins', 'misses', 'tomorrowTop3', 'stats'],
    date: 'periodStart',
    search: ['reflection', 'wins', 'misses'],
  },
  notes: {
    model: 'note',
    about: 'Notes and journal entries (content is HTML).',
    fields: ['id', 'itemId', 'title', 'content', 'date', 'updatedAt'],
    date: 'updatedAt',
    search: ['title', 'content'],
  },
  events: {
    model: 'event',
    about: 'Calendar events with start/end, type, completed and an optional score/comment.',
    fields: ['id', 'title', 'startTime', 'endTime', 'type', 'completed', 'score', 'comment'],
    date: 'startTime',
    search: ['title', 'comment'],
  },
  finance_entries: {
    model: 'financialEntry',
    about: 'Money in and out. type: income | expense | transfer. amount in currency (usually NGN), category, purse (wallet), description.',
    fields: ['id', 'entryDate', 'type', 'amount', 'currency', 'category', 'purse', 'description', 'comments', 'priority'],
    date: 'entryDate',
    search: ['description', 'category', 'comments', 'purse'],
  },
  purses: {
    model: 'purse',
    about: 'Wallets/accounts money is kept in.',
    fields: ['id', 'name', 'icon', 'color'],
    date: 'createdAt',
    search: ['name'],
  },
  budgets: {
    model: 'budget',
    about: 'Monthly budget per section and category (month like 2026-10).',
    fields: ['id', 'section', 'category', 'amount', 'month'],
    date: 'createdAt',
    search: ['section', 'category', 'month'],
  },
  allocations: {
    model: 'sectionAllocation',
    about: 'Money allocated to a budget section for a month, moved from sourcePurse to purse.',
    fields: ['id', 'section', 'amount', 'month', 'sourcePurse', 'purse'],
    date: 'createdAt',
    search: ['section', 'month'],
  },
  trackers: {
    model: 'tracker',
    about: 'Simple daily yes/no trackers.',
    fields: ['id', 'title', 'date', 'completed'],
    date: 'date',
    search: ['title'],
  },
  long_term_plans: {
    model: 'longTermPlan',
    about: 'Long-term plans spanning months or years.',
    fields: ['id', 'title', 'startMonth', 'endMonth', 'anchorNote', 'reviewCadence'],
    date: 'createdAt',
    search: ['title', 'anchorNote'],
  },
  plan_sections: {
    model: 'planSection',
    about: 'Sections inside a long-term plan.',
    fields: ['id', 'planId', 'name', 'description', 'orderIndex'],
    date: 'id',
    search: ['name', 'description'],
  },
  plan_goals: {
    model: 'planGoal',
    about: 'Goals inside a plan section: overall goal, actions, resources, success criteria, dates and status.',
    fields: ['id', 'sectionId', 'overallGoal', 'developmentOpportunity', 'actionsPlanned', 'resourcesAndSupport', 'successCriteria', 'targetDate', 'startDate', 'status', 'archived'],
    date: 'targetDate',
    search: ['overallGoal', 'actionsPlanned', 'successCriteria'],
  },
  plan_milestones: {
    model: 'planMilestone',
    about: 'Milestones under a plan goal.',
    fields: ['id', 'goalId', 'title', 'targetDate', 'status', 'notes'],
    date: 'targetDate',
    search: ['title', 'notes'],
  },
  status_log: {
    model: 'statusLogEntry',
    about: 'History of status changes on plan goals/milestones.',
    fields: ['parentType', 'parentId', 'oldStatus', 'newStatus', 'note', 'loggedAt'],
    date: 'loggedAt',
    search: ['note'],
  },
  review_sessions: {
    model: 'reviewSession',
    about: 'Times a long-term plan was reviewed.',
    fields: ['id', 'planId', 'conductedAt', 'summaryNote'],
    date: 'conductedAt',
    search: ['summaryNote'],
  },
  alarms: {
    model: 'alarm',
    about: 'Recurring alarms: time HH:mm, days 0=Sun..6, enabled, next fire time.',
    fields: ['id', 'title', 'time', 'days', 'tz', 'enabled', 'nextFire'],
    date: 'createdAt',
    search: ['title'],
  },
  challenge_bottles: {
    model: 'challengeBottle',
    about: 'Challenge bottles: named accumulators with a unit, target and attached challenge.',
    fields: ['id', 'name', 'emoji', 'unit', 'target', 'challenge', 'challengeDue'],
    date: 'createdAt',
    search: ['name', 'challenge'],
  },
  bottle_entries: {
    model: 'bottleEntry',
    about: 'Amounts poured into a challenge bottle (bottleId), with the note it came from.',
    fields: ['id', 'bottleId', 'amount', 'note', 'sourceType', 'createdAt'],
    date: 'createdAt',
    search: ['note'],
  },
  partners: {
    model: 'partner',
    about: 'Accountability partners the user added (name, role, status, what they share).',
    fields: ['id', 'name', 'email', 'role', 'status', 'shareProgress', 'shareWhat'],
    date: 'createdAt',
    search: ['name', 'role'],
  },
  partner_messages: {
    model: 'nudge',
    about: 'Messages between the user and partners. fromMe tells direction.',
    fields: ['id', 'partnerId', 'senderId', 'message', 'read', 'createdAt'],
    date: 'createdAt',
    search: ['message'],
    owner: (userId) => ({ OR: [{ senderId: userId }, { receiverId: userId }] }),
  },
  applications: {
    model: 'application',
    about: 'Application Tracker entries (scholarships, jobs, schools, grants, visas).',
    fields: ['id', 'title', 'organization', 'type', 'status', 'priority', 'url', 'location', 'value', 'summary', 'whyApply', 'notes', 'details', 'contacts', 'opensAt', 'deadline', 'decisionDate', 'submittedAt', 'archived'],
    date: 'deadline',
    search: ['title', 'organization', 'summary', 'notes'],
  },
  application_items: {
    model: 'applicationItem',
    about: 'Requirements (kind eligibility), documents and steps of an application (applicationId).',
    fields: ['id', 'applicationId', 'kind', 'label', 'detail', 'status', 'dueDate'],
    date: 'createdAt',
    search: ['label', 'detail'],
  },
  application_files: {
    model: 'applicationFile',
    about: 'Names of files uploaded to an application (contents are not readable here).',
    fields: ['id', 'applicationId', 'name', 'mime', 'size', 'label', 'createdAt'],
    date: 'createdAt',
    search: ['name', 'label'],
  },
}

const ownerOf = (t: TableSpec, userId: string) => (t.owner ? t.owner(userId) : { userId })
const delegate = (t: TableSpec) => (prisma as unknown as Record<string, Delegate>)[t.model]

function parseDay(v: unknown, end: boolean, tzOffset: number): Date | undefined {
  if (typeof v !== 'string') return undefined
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return undefined
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], end ? 23 : 0, end ? 59 : 0, end ? 59 : 0) + tzOffset * 60_000)
}

const plain = (v: unknown): unknown => {
  if (typeof v === 'string') {
    const text = /<\/?[a-z][\s\S]*>/i.test(v) ? v.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : v
    return text.length > 1500 ? text.slice(0, 1500) + '…' : text
  }
  return v
}

async function query(args: Record<string, unknown>, { userId, tzOffset }: ToolCtx) {
  const name = String(args.table || '')
  const t = TABLES[name]
  if (!t) return { error: `Unknown table. Use one of: ${Object.keys(TABLES).join(', ')}` }

  const filters: Record<string, unknown>[] = [ownerOf(t, userId)]
  const from = parseDay(args.from, false, tzOffset)
  const to = parseDay(args.to, true, tzOffset)
  if ((from || to) && t.date !== 'id') filters.push({ [t.date]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } })
  const q = typeof args.search === 'string' ? args.search.trim().slice(0, 100) : ''
  if (q && t.search.length) filters.push({ OR: t.search.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } })) })
  // Equality filters on whitelisted columns only (e.g. {"type":"expense"} or {"layer":6}).
  if (args.where && typeof args.where === 'object') {
    for (const [k, v] of Object.entries(args.where as Record<string, unknown>)) {
      if (t.fields.includes(k) && k !== 'senderId' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null)) filters.push({ [k]: v })
    }
  }

  const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100)
  const select = Object.fromEntries(t.fields.map((f) => [f, true]))
  if (t.model === 'nudge') select.senderId = true
  const where = { AND: filters }
  const order = t.date === 'id' ? undefined : { [t.date]: args.oldest_first ? 'asc' : 'desc' }

  const [rows, total] = await Promise.all([
    delegate(t).findMany({ where, select, take: limit, ...(order ? { orderBy: order } : {}) }),
    delegate(t).count({ where }),
  ])
  return {
    table: name,
    total_matching: total,
    returned: rows.length,
    rows: rows.map((r) => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(r)) {
        if (k === 'senderId') { out.fromMe = v === userId; continue }
        out[k] = plain(v)
      }
      return out
    }),
  }
}

async function overview(_a: Record<string, unknown>, { userId }: ToolCtx) {
  const counts = await Promise.all(
    Object.entries(TABLES).map(async ([name, t]) => [name, await delegate(t).count({ where: ownerOf(t, userId) }).catch(() => 0)] as const),
  )
  return { tables: Object.fromEntries(Object.entries(TABLES).map(([n, t]) => [n, { rows: counts.find((c) => c[0] === n)?.[1] ?? 0, about: t.about }])) }
}

async function financeSummary(a: Record<string, unknown>, { userId, tzOffset }: ToolCtx) {
  const from = parseDay(a.from, false, tzOffset)
  const to = parseDay(a.to, true, tzOffset)
  const where = { AND: [{ userId }, ...(from || to ? [{ entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }] : [])] }
  const rows = await prisma.financialEntry.findMany({ where, select: { type: true, amount: true, currency: true, category: true, purse: true } })
  const sum: Record<string, { income: number; expense: number; transfer: number; byCategory: Record<string, number>; byPurse: Record<string, number> }> = {}
  for (const r of rows) {
    const c = (sum[r.currency] ??= { income: 0, expense: 0, transfer: 0, byCategory: {}, byPurse: {} })
    if (r.type === 'income' || r.type === 'expense' || r.type === 'transfer') c[r.type] += r.amount
    if (r.type === 'expense') {
      c.byCategory[r.category] = (c.byCategory[r.category] ?? 0) + r.amount
      c.byPurse[r.purse] = (c.byPurse[r.purse] ?? 0) + r.amount
    }
  }
  for (const c of Object.values(sum)) {
    c.byCategory = Object.fromEntries(Object.entries(c.byCategory).sort((x, y) => y[1] - x[1]).slice(0, 15).map(([k, v]) => [k, Math.round(v * 100) / 100]))
  }
  return { entries: rows.length, from: a.from ?? null, to: a.to ?? null, byCurrency: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, { ...v, net: Math.round((v.income - v.expense) * 100) / 100 }])) }
}

async function progressSummary(a: Record<string, unknown>, { userId, tzOffset }: ToolCtx) {
  const from = parseDay(a.from, false, tzOffset)
  const to = parseDay(a.to, true, tzOffset)
  const range = from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}
  const [days, tasks] = await Promise.all([
    prisma.dailyScore.findMany({ where: { AND: [{ userId }, range] }, select: { date: true, score: true, totalTasks: true, completedTasks: true }, orderBy: { date: 'asc' } }),
    prisma.task.findMany({ where: { AND: [{ userId }, range] }, select: { completed: true, isHabit: true, isFrog: true } }),
  ])
  const avg = days.length ? Math.round(days.reduce((s, d) => s + d.score, 0) / days.length) : null
  const best = [...days].sort((x, y) => y.score - x.score).slice(0, 3).map((d) => ({ date: d.date, score: Math.round(d.score) }))
  return {
    days_tracked: days.length,
    average_day_score: avg,
    best_days: best,
    tasks: tasks.length,
    tasks_completed: tasks.filter((t) => t.completed).length,
    habits: tasks.filter((t) => t.isHabit).length,
    habits_completed: tasks.filter((t) => t.isHabit && t.completed).length,
    frogs_eaten: tasks.filter((t) => t.isFrog && t.completed).length,
  }
}

const dateArg = (d: string) => ({ type: 'string', description: d })

export const DATA_TOOLS: Tool[] = [
  {
    mutates: false,
    spec: {
      type: 'function',
      function: {
        name: 'my_data_overview',
        description: 'What data the user has: every readable table with its row count and what it holds. Call first when unsure where something lives.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    },
    run: async (a, c) => ({ result: await overview(a, c) }),
  },
  {
    mutates: false,
    spec: {
      type: 'function',
      function: {
        name: 'query_my_data',
        description: 'Read rows from one of the user\'s own tables, newest first. Combine search, a date range and exact-match filters.',
        parameters: {
          type: 'object',
          properties: {
            table: { type: 'string', enum: Object.keys(TABLES), description: 'Which table' },
            search: { type: 'string', description: 'Words to match in the table\'s text columns' },
            from: dateArg('Start date YYYY-MM-DD (inclusive), on the table\'s main date'),
            to: dateArg('End date YYYY-MM-DD (inclusive)'),
            where: { type: 'object', description: 'Exact matches on columns, e.g. {"type":"expense"}, {"layer":6}, {"completed":false}', additionalProperties: true },
            limit: { type: 'integer', description: 'Max rows, 1-100 (default 25)' },
            oldest_first: { type: 'boolean', description: 'Sort oldest first instead of newest first' },
          },
          required: ['table'],
          additionalProperties: false,
        },
      },
    },
    run: async (a, c) => ({ result: await query(a, c) }),
  },
  {
    mutates: false,
    spec: {
      type: 'function',
      function: {
        name: 'finance_summary',
        description: 'Totals of income, expenses, transfers and net per currency, with spending by category and purse, for a date range. Use this instead of adding up rows yourself.',
        parameters: { type: 'object', properties: { from: dateArg('Start YYYY-MM-DD'), to: dateArg('End YYYY-MM-DD') }, additionalProperties: false },
      },
    },
    run: async (a, c) => ({ result: await financeSummary(a, c) }),
  },
  {
    mutates: false,
    spec: {
      type: 'function',
      function: {
        name: 'progress_summary',
        description: 'Day scores and task completion for a date range: average score, best days, tasks/habits done, frogs eaten.',
        parameters: { type: 'object', properties: { from: dateArg('Start YYYY-MM-DD'), to: dateArg('End YYYY-MM-DD') }, additionalProperties: false },
      },
    },
    run: async (a, c) => ({ result: await progressSummary(a, c) }),
  },
]

// ── Reports and account ─────────────────────────────────────────────────────


async function report(a: Record<string, unknown>, { userId, tzOffset }: ToolCtx) {
  const period = String(a.period || 'weekly')
  const at = parseDay(a.date, false, tzOffset) ?? new Date()
  let start: Date, end: Date
  if (period === 'custom') {
    const s = parseDay(a.from, false, tzOffset), e = parseDay(a.to, true, tzOffset)
    if (!s || !e) return { error: 'custom needs from and to (YYYY-MM-DD)' }
    start = s; end = e
  } else {
    const ranges: Record<string, [(d: Date) => Date, (d: Date) => Date]> = {
      weekly: [(d) => startOfWeek(d, { weekStartsOn: 1 }), (d) => endOfWeek(d, { weekStartsOn: 1 })],
      monthly: [startOfMonth, endOfMonth],
      quarterly: [startOfQuarter, endOfQuarter],
      yearly: [startOfYear, endOfYear],
    }
    const r = ranges[period]
    if (!r) return { error: 'period must be weekly, monthly, quarterly, yearly or custom' }
    start = r[0](at); end = r[1](at)
  }
  const rep = await buildReport(userId, period as 'weekly', start, end)
  // Keep it compact for the model: stats, categories, priorities, and per-day scores.
  return {
    period: rep.period,
    stats: rep.stats,
    categories: rep.categories,
    priorities: rep.priorities,
    days: rep.days.filter((d) => d.active).map((d) => ({ date: d.date, score: Math.round(d.score), tasks: d.total, completed: d.completed })),
    open_in_app: '/reports',
  }
}

async function account(_a: Record<string, unknown>, { userId }: ToolCtx) {
  const [profile, google, devices, widget, counts] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { email: true, name: true, createdAt: true } }),
    prisma.userToken.findMany({ where: { userId }, select: { provider: true, syncMode: true, lastSyncedAt: true, expiryDate: true } }),
    prisma.pushSubscription.count({ where: { userId } }),
    prisma.widgetConfig.findUnique({ where: { userId }, select: { rotateSeconds: true, updatedAt: true } }),
    overview({}, { userId, tzOffset: 0 }),
  ])
  return {
    email: profile?.email ?? null,
    name: profile?.name ?? null,
    member_since: profile?.createdAt ?? null,
    connected_calendars: google.map((g) => ({ provider: g.provider, sync: g.syncMode, last_synced: g.lastSyncedAt })),
    notification_devices: devices,
    home_screen_widget: widget ? { set_up: true, rotate_seconds: widget.rotateSeconds } : { set_up: false },
    data: Object.fromEntries(Object.entries(counts.tables).map(([k, v]) => [k, v.rows])),
  }
}

DATA_TOOLS.push(
  {
    mutates: false,
    spec: {
      type: 'function',
      function: {
        name: 'get_report',
        description: 'The user\'s progress report (same as the Reports page): completion, average day score, best/worst day, streaks, frogs, habits, time spent, by category and priority, and daily scores.',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'], description: 'Report length' },
            date: dateArg('Any day inside the period, YYYY-MM-DD (default today)'),
            from: dateArg('custom only: start YYYY-MM-DD'),
            to: dateArg('custom only: end YYYY-MM-DD'),
          },
          required: ['period'],
          additionalProperties: false,
        },
      },
    },
    run: async (a, c) => ({ result: await report(a, c) }),
  },
  {
    mutates: false,
    spec: {
      type: 'function',
      function: {
        name: 'my_account',
        description: 'The signed-in user\'s account: email, name, member since, connected Google Calendar, notification devices, widget, and how much data they have.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    },
    run: async (a, c) => ({ result: await account(a, c) }),
  },
)
