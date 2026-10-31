import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ITEM_KEY, parseWorkbook, type SheetRow } from '@/lib/applicationSheet'
import { DEFAULT_ITEM_STATUS, MAX_FILE_BYTES, starterItemsFor, type ItemKind } from '@/lib/applications'

// POST /api/applications/import  (multipart: file, tz, dryRun?)
//   dryRun=1 → a preview: each row, whether it creates or updates, and any errors
//   otherwise → applies every valid row. A row whose name matches an existing
//   application updates it (blank cells leave fields alone, new list items are
//   added); any other row creates a new application.

export const runtime = 'nodejs'

const FIELDS = ['organization', 'type', 'status', 'priority', 'deadline', 'opensAt', 'decisionDate', 'location', 'value', 'url', 'summary', 'whyApply', 'notes'] as const
const MAX: Record<string, number> = { title: 160, organization: 160, location: 160, value: 160, url: 500, summary: 5000, whyApply: 5000, notes: 20000 }

function fieldData(d: SheetRow) {
  const out: Record<string, unknown> = {}
  for (const k of FIELDS) {
    const v = d[k]
    if (v === undefined) continue
    out[k] = typeof v === 'string' ? v.slice(0, MAX[k] ?? 500) : v
  }
  return out
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'The file could not be read. It must be under 4 MB.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'Choose a file to import' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'The file must be 4 MB or smaller' }, { status: 413 })
  if (!/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ error: 'Upload an Excel file (.xlsx) or a .csv' }, { status: 400 })

  const tz = Number(form.get('tz')) || 0
  const dryRun = form.get('dryRun') === '1'

  let rows
  try {
    rows = await parseWorkbook(Buffer.from(await file.arrayBuffer()), file.name, tz)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The file could not be read' }, { status: 400 })
  }
  if (!rows.length) return NextResponse.json({ error: 'No applications found in the file. Fill rows under the header row.' }, { status: 400 })

  const existing = await prisma.application.findMany({
    where: { userId },
    select: { id: true, title: true, archived: true, items: { select: { kind: true, label: true } } },
  })
  const byTitle = new Map(existing.map((a) => [a.title.trim().toLowerCase(), a]))

  // A name repeated inside the file: later rows update what earlier rows made.
  const seen = new Set<string>()
  const preview = rows.map((r) => {
    const key = r.data.title?.trim().toLowerCase() ?? ''
    const action = r.errors.length ? 'skip' : byTitle.has(key) || seen.has(key) ? 'update' : 'create'
    if (key) seen.add(key)
    return {
      row: r.row,
      title: r.data.title ?? '',
      organization: r.data.organization ?? null,
      deadline: r.data.deadline ?? null,
      items: (r.data.requirements?.length ?? 0) + (r.data.documents?.length ?? 0) + (r.data.steps?.length ?? 0),
      action,
      errors: r.errors,
    }
  })

  if (dryRun) {
    return NextResponse.json({
      preview,
      summary: {
        create: preview.filter((p) => p.action === 'create').length,
        update: preview.filter((p) => p.action === 'update').length,
        skip: preview.filter((p) => p.action === 'skip').length,
      },
    })
  }

  let created = 0
  let updated = 0
  for (const r of rows) {
    if (r.errors.length || !r.data.title) continue
    const title = r.data.title.slice(0, 160)
    const key = title.trim().toLowerCase()
    const listed: { kind: ItemKind; label: string }[] = (['requirements', 'documents', 'steps'] as const).flatMap((k) =>
      (r.data[k] ?? []).map((label) => ({ kind: ITEM_KEY[k], label: label.slice(0, 300) })),
    )

    const match = byTitle.get(key)
    if (match) {
      await prisma.application.update({
        where: { id: match.id },
        data: {
          ...fieldData(r.data),
          ...(match.archived ? { archived: false } : {}),
          ...(r.data.deadline ? { remindersSent: '' } : {}),
        },
      })
      const have = new Set(match.items.map((i) => `${i.kind}:${i.label.trim().toLowerCase()}`))
      const fresh = listed.filter((i) => !have.has(`${i.kind}:${i.label.trim().toLowerCase()}`))
      if (fresh.length) {
        await prisma.applicationItem.createMany({
          data: fresh.map((i, n) => ({ applicationId: match.id, userId, kind: i.kind, label: i.label, status: DEFAULT_ITEM_STATUS[i.kind], order: match.items.length + n })),
        })
        fresh.forEach((i) => match.items.push(i))
      }
      updated++
    } else {
      const app = await prisma.application.create({
        data: { userId, title, ...fieldData(r.data) },
        select: { id: true, title: true, archived: true, type: true },
      })
      const items = listed.length ? listed : starterItemsFor(app.type)
      await prisma.applicationItem.createMany({
        data: items.map((i, n) => ({ applicationId: app.id, userId, kind: i.kind, label: i.label, status: DEFAULT_ITEM_STATUS[i.kind], order: n })),
      })
      byTitle.set(key, { id: app.id, title: app.title, archived: false, items: [...items] })
      created++
    }
  }

  return NextResponse.json({ created, updated, skipped: preview.filter((p) => p.action === 'skip').length })
}
