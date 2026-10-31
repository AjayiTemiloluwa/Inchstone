// Excel round trip for the Application Tracker (server only).
//   buildWorkbook()  the template people download, optionally pre-filled
//   parseWorkbook()  reads a filled template (.xlsx or .csv) back into rows
// Columns are matched by header text, so reordering or deleting columns is fine.
import ExcelJS from 'exceljs'
import { Readable } from 'stream'
import { APPLICATION_STATUSES, APPLICATION_TYPES, PRIORITIES, type ItemKind } from './applications'

export interface SheetRow {
  title?: string
  organization?: string
  type?: string
  status?: string
  priority?: string
  deadline?: Date
  opensAt?: Date
  decisionDate?: Date
  location?: string
  value?: string
  url?: string
  summary?: string
  whyApply?: string
  notes?: string
  requirements?: string[]
  documents?: string[]
  steps?: string[]
}

type Col = { key: keyof SheetRow; header: string; width: number; aliases?: string[]; kind?: 'date' | 'list' | 'choice' }

export const COLUMNS: Col[] = [
  { key: 'title', header: 'Name *', width: 34, aliases: ['name', 'title', 'application'] },
  { key: 'organization', header: 'Organisation', width: 26, aliases: ['organization', 'company', 'institution', 'school'] },
  { key: 'type', header: 'Type', width: 20, kind: 'choice' },
  { key: 'status', header: 'Status', width: 20, kind: 'choice', aliases: ['stage'] },
  { key: 'priority', header: 'Priority', width: 12, kind: 'choice' },
  { key: 'deadline', header: 'Deadline (date & time)', width: 22, kind: 'date', aliases: ['deadline', 'due', 'due date', 'closing date'] },
  { key: 'opensAt', header: 'Opens', width: 16, kind: 'date', aliases: ['opening date', 'open date'] },
  { key: 'decisionDate', header: 'Decision expected', width: 18, kind: 'date', aliases: ['decision', 'decision date', 'results'] },
  { key: 'location', header: 'Location', width: 20 },
  { key: 'value', header: 'What it is worth', width: 24, aliases: ['value', 'worth', 'amount', 'salary', 'funding'] },
  { key: 'url', header: 'Application link', width: 32, aliases: ['link', 'url', 'portal', 'website'] },
  { key: 'summary', header: 'What it is about', width: 40, aliases: ['summary', 'about', 'description'] },
  { key: 'whyApply', header: 'Why I am applying', width: 36, aliases: ['why', 'motivation'] },
  { key: 'requirements', header: 'Requirements (one per line)', width: 40, kind: 'list', aliases: ['requirements', 'eligibility', 'criteria'] },
  { key: 'documents', header: 'Documents needed (one per line)', width: 36, kind: 'list', aliases: ['documents', 'documents needed', 'needs'] },
  { key: 'steps', header: 'Steps (one per line)', width: 36, kind: 'list', aliases: ['steps', 'progress', 'tasks'] },
  { key: 'notes', header: 'Notes', width: 36 },
]

export const ITEM_KEY: Record<'requirements' | 'documents' | 'steps', ItemKind> = {
  requirements: 'eligibility',
  documents: 'document',
  steps: 'step',
}

const CHOICES: Partial<Record<keyof SheetRow, readonly { value: string; label: string }[]>> = {
  type: APPLICATION_TYPES,
  status: APPLICATION_STATUSES,
  priority: PRIORITIES,
}

const norm = (s: string) => s.toLowerCase().replace(/\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// ── Build ────────────────────────────────────────────────────────────────────

export interface ExportApp extends Omit<SheetRow, 'deadline' | 'opensAt' | 'decisionDate'> {
  deadline?: Date | null
  opensAt?: Date | null
  decisionDate?: Date | null
}

/** `tzOffset` is the viewer's getTimezoneOffset(), so dates show in their own clock. */
export async function buildWorkbook(apps: ExportApp[] = [], tzOffset = 0): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inchstone'
  wb.created = new Date()

  const ws = wb.addWorksheet('Applications', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }))

  const head = ws.getRow(1)
  head.height = 30
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF0A0908' }, name: 'Calibri', size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8935A' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF7A5F35' } } }
  })

  const toWall = (d: Date | null | undefined) => (d ? new Date(d.getTime() - tzOffset * 60_000) : null)
  const label = (key: keyof SheetRow, v?: string) => CHOICES[key]?.find((c) => c.value === v)?.label ?? v

  for (const a of apps) {
    ws.addRow({
      ...a,
      type: label('type', a.type),
      status: label('status', a.status),
      priority: label('priority', a.priority),
      deadline: toWall(a.deadline),
      opensAt: toWall(a.opensAt),
      decisionDate: toWall(a.decisionDate),
      requirements: a.requirements?.join('\n'),
      documents: a.documents?.join('\n'),
      steps: a.steps?.join('\n'),
    })
  }

  const lastRow = Math.max(apps.length + 1, 300)
  // Range validations exist at runtime but are missing from the ExcelJS typings.
  const validations = (ws as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } }).dataValidations
  COLUMNS.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    const letter = col.letter
    if (c.kind === 'date') col.numFmt = c.key === 'deadline' ? 'dd mmm yyyy hh:mm' : 'dd mmm yyyy'
    if (c.kind === 'list' || ['summary', 'whyApply', 'notes'].includes(c.key)) col.alignment = { wrapText: true, vertical: 'top' }
    const choices = CHOICES[c.key]
    if (choices) {
      validations.add(`${letter}2:${letter}${lastRow}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`"${choices.map((x) => x.label).join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Pick from the list',
        error: `Choose one of: ${choices.map((x) => x.label).join(', ')}`,
      })
    }
    if (c.kind === 'date') {
      validations.add(`${letter}2:${letter}${lastRow}`, {
        type: 'date',
        operator: 'greaterThan',
        allowBlank: true,
        formulae: [new Date(2000, 0, 1)],
        showErrorMessage: true,
        errorTitle: 'Enter a date',
        error: 'Type a date like 15/01/2027 14:00',
      })
    }
  })

  // ── How-to sheet ──
  const help = wb.addWorksheet('How to fill this')
  help.columns = [{ width: 30 }, { width: 90 }]
  const lines: [string, string][] = [
    ['Application Tracker template', ''],
    ['', ''],
    ['How it works', 'Fill one row per application on the "Applications" sheet, save, then upload the file on the Application Tracker page.'],
    ['Required', 'Only "Name" is required. Leave anything you do not know blank.'],
    ['Updating', 'If a row has the same name as an application already in the tracker, that application is updated instead of duplicated. New requirements, documents and steps are added; existing ones are kept.'],
    ['Dates', 'Use the date cells, or type 15/01/2027 or 15/01/2027 14:00 (day first). A deadline with no time is set to 23:59 that day.'],
    ['Lists', 'In Requirements, Documents and Steps put one item per line (Alt+Enter in Excel) or separate them with semicolons.'],
    ['Checklist', 'A row with no Requirements, Documents or Steps gets the starter checklist for its type.'],
    ['Reminders', 'Imported applications get the default deadline alarms: 1 week, 3 days, 1 day and 3 hours before.'],
    ['', ''],
    ['Type options', APPLICATION_TYPES.map((t) => t.label).join(', ')],
    ['Status options', APPLICATION_STATUSES.map((t) => t.label).join(', ')],
    ['Priority options', PRIORITIES.map((t) => t.label).join(', ')],
    ['', ''],
    ['Example row', 'Chevening Scholarship 2027 | UK Foreign Office | Scholarship | Preparing | High | 04/11/2026 12:00 | ... | Requirements: "Bachelor\'s degree; 2 years work experience"'],
  ]
  lines.forEach(([a, b], i) => {
    const r = help.addRow([a, b])
    r.alignment = { wrapText: true, vertical: 'top' }
    if (i === 0) r.font = { bold: true, size: 14, color: { argb: 'FF7A5F35' } }
    else r.getCell(1).font = { bold: true }
  })

  return Buffer.from(await wb.xlsx.writeBuffer())
}

// ── Parse ────────────────────────────────────────────────────────────────────

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('')
    if ('text' in v) return String((v as { text: unknown }).text ?? '')
    if ('result' in v) return cellText((v as { result: ExcelJS.CellValue }).result)
    return ''
  }
  return String(v)
}

/** Wall-clock parts → a real instant, given the uploader's timezone offset. */
function wall(y: number, mo: number, d: number, h: number, mi: number, tzOffset: number) {
  return new Date(Date.UTC(y, mo, d, h, mi) + tzOffset * 60_000)
}

function parseDateCell(v: ExcelJS.CellValue, tzOffset: number, endOfDay: boolean): Date | undefined | 'bad' {
  if (v == null || v === '') return undefined
  let y: number, mo: number, d: number, h = 0, mi = 0, hasTime = false
  if (v instanceof Date) {
    // Excel dates carry no zone; ExcelJS hands them over as UTC wall time.
    y = v.getUTCFullYear(); mo = v.getUTCMonth(); d = v.getUTCDate(); h = v.getUTCHours(); mi = v.getUTCMinutes()
    hasTime = h !== 0 || mi !== 0
  } else if (typeof v === 'number') {
    const dt = new Date(Math.round((v - 25569) * 86400000))
    y = dt.getUTCFullYear(); mo = dt.getUTCMonth(); d = dt.getUTCDate(); h = dt.getUTCHours(); mi = dt.getUTCMinutes()
    hasTime = h !== 0 || mi !== 0
  } else {
    const t = cellText(v).trim()
    if (!t) return undefined
    let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})\s*(am|pm)?)?$/i)
    if (m) {
      d = +m[1]; mo = +m[2] - 1; y = +m[3] < 100 ? 2000 + +m[3] : +m[3]
      if (m[4]) { h = +m[4] % 12 + (m[6]?.toLowerCase() === 'pm' ? 12 : m[6] ? 0 : Math.floor(+m[4] / 12) * 12); mi = +m[5]; hasTime = true }
    } else if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/))) {
      y = +m[1]; mo = +m[2] - 1; d = +m[3]
      if (m[4]) { h = +m[4]; mi = +m[5]; hasTime = true }
    } else {
      const p = new Date(t)
      if (isNaN(p.getTime())) return 'bad'
      y = p.getFullYear(); mo = p.getMonth(); d = p.getDate(); h = p.getHours(); mi = p.getMinutes()
      hasTime = h !== 0 || mi !== 0
    }
  }
  if (!hasTime && endOfDay) { h = 23; mi = 59 }
  const out = wall(y, mo, d, h, mi, tzOffset)
  return isNaN(out.getTime()) || mo < 0 || mo > 11 || d < 1 || d > 31 ? 'bad' : out
}

function matchChoice(key: keyof SheetRow, raw: string): string | undefined | 'bad' {
  const t = norm(raw)
  if (!t) return undefined
  const list = CHOICES[key]!
  const hit = list.find((c) => norm(c.value) === t || norm(c.label) === t) ??
    list.find((c) => norm(c.label).split(' ').includes(t) || norm(c.label).startsWith(t))
  return hit ? hit.value : 'bad'
}

export interface ParsedRow {
  row: number
  data: SheetRow
  errors: string[]
}

export async function parseWorkbook(buf: Buffer, filename: string, tzOffset: number): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook()
  if (/\.csv$/i.test(filename)) await wb.csv.read(Readable.from(buf))
  else await wb.xlsx.load(buf as unknown as ArrayBuffer)

  const ws = wb.getWorksheet('Applications') ?? wb.worksheets[0]
  if (!ws) return []

  // Map header text → column.
  const colFor = new Map<number, Col>()
  ws.getRow(1).eachCell((cell, colNumber) => {
    const h = norm(cellText(cell.value))
    const c = COLUMNS.find((c) => norm(c.header) === h || norm(c.key) === h || c.aliases?.some((a) => norm(a) === h))
    if (c) colFor.set(colNumber, c)
  })
  if (![...colFor.values()].some((c) => c.key === 'title')) {
    throw new Error('No "Name" column found. Use the downloaded template, or make sure the first row has a "Name" header.')
  }

  const out: ParsedRow[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || out.length >= 500) return
    const data: SheetRow = {}
    const errors: string[] = []
    let any = false
    colFor.forEach((c, colNumber) => {
      const v = row.getCell(colNumber).value
      const text = cellText(v).trim()
      if (text || v instanceof Date || typeof v === 'number') any = true
      if (c.kind === 'date') {
        const d = parseDateCell(v, tzOffset, c.key === 'deadline')
        if (d === 'bad') errors.push(`${c.header}: "${text}" is not a date`)
        else if (d) (data[c.key] as Date) = d
      } else if (c.kind === 'choice') {
        const m = matchChoice(c.key, text)
        if (m === 'bad') errors.push(`${c.header}: "${text}" is not an option`)
        else if (m) (data[c.key] as string) = m
      } else if (c.kind === 'list') {
        const items = text.split(/\r?\n|;/).map((s) => s.replace(/^(?:[-•*]\s*|\d+[.)]\s+)/, '').trim()).filter(Boolean)
        if (items.length) (data[c.key] as string[]) = items.slice(0, 50)
      } else if (text) {
        (data[c.key] as string) = text
      }
    })
    if (!any) return // blank row
    if (!data.title) errors.push('Name is required')
    out.push({ row: rowNumber, data, errors })
  })
  return out
}
