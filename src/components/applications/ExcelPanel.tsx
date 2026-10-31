'use client'

import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { Badge, Button, Panel, Section, cx } from '@/components/ds'
import { useToast } from '@/components/ui/ToastProvider'

interface PreviewRow {
  row: number
  title: string
  organization: string | null
  deadline: string | null
  items: number
  action: 'create' | 'update' | 'skip'
  errors: string[]
}

/**
 * Excel round trip for the tracker: download the template (empty or filled
 * with every application), fill it, upload it back. Uploads are previewed
 * first, so nothing is saved until the person confirms.
 */
export function ExcelPanel({ onImported }: { onImported: () => void }) {
  const { showToast } = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [busy, setBusy] = useState(false)

  const download = (filled: boolean) => {
    const tz = new Date().getTimezoneOffset()
    window.location.href = `/api/applications/template?tz=${tz}${filled ? '&filled=1' : ''}`
  }

  const send = async (f: File, dryRun: boolean) => {
    const fd = new FormData()
    fd.append('file', f)
    fd.append('tz', String(new Date().getTimezoneOffset()))
    if (dryRun) fd.append('dryRun', '1')
    const res = await fetch('/api/applications/import', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'The file could not be imported')
    return data
  }

  const choose = async (f: File) => {
    setBusy(true)
    try {
      const data = await send(f, true)
      setFile(f)
      setPreview(data.preview)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!file) return
    setBusy(true)
    try {
      const r = await send(file, false)
      const parts = [r.created && `${r.created} added`, r.updated && `${r.updated} updated`, r.skipped && `${r.skipped} skipped`].filter(Boolean)
      showToast(`Imported: ${parts.join(', ') || 'nothing to change'}`, 'success')
      setFile(null)
      setPreview(null)
      onImported()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed. Check your connection.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const counts = preview && {
    create: preview.filter((p) => p.action === 'create').length,
    update: preview.filter((p) => p.action === 'update').length,
    skip: preview.filter((p) => p.action === 'skip').length,
  }

  return (
    <Section title="Excel" description="Fill many applications at once: download the template, fill it in Excel, then upload it here. Re-uploading updates matching names instead of duplicating them.">
      <input ref={input} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) choose(f) }} />

      {!preview ? (
        <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-gold" strokeWidth={1.4} aria-hidden="true" />
            <p className="text-sm text-parchment/70">Excel (.xlsx) or CSV, up to 500 rows.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Download} onClick={() => download(false)}>Template</Button>
            <Button variant="ghost" icon={Download} onClick={() => download(true)}>Export mine</Button>
            <Button variant="primary" icon={Upload} disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Reading…' : 'Upload filled sheet'}
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel className="space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-heading text-parchment">{file?.name}</p>
              <p className="text-caption text-parchment/55">
                {counts!.create} new · {counts!.update} updated · {counts!.skip} with problems (skipped)
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" icon={X} onClick={() => { setPreview(null); setFile(null) }}>Cancel</Button>
              <Button variant="primary" disabled={busy || counts!.create + counts!.update === 0} onClick={apply}>
                {busy ? 'Importing…' : `Import ${counts!.create + counts!.update}`}
              </Button>
            </div>
          </div>
          <ul className="max-h-[50vh] divide-y divide-gold/10 overflow-y-auto rounded-lg border border-gold/15" data-lenis-prevent>
            {preview.map((p) => (
              <li key={p.row} className="flex items-start gap-3 px-3 py-2.5">
                <span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-parchment/35">#{p.row}</span>
                <div className="min-w-0 flex-1">
                  <p className={cx('truncate text-sm', p.action === 'skip' ? 'text-parchment/50' : 'text-parchment')}>
                    {p.title || 'No name'}{p.organization ? <span className="text-parchment/45"> · {p.organization}</span> : null}
                  </p>
                  <p className="text-caption text-parchment/45">
                    {p.deadline ? `Due ${new Date(p.deadline).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'No deadline'}
                    {p.items ? ` · ${p.items} checklist item${p.items === 1 ? '' : 's'}` : ''}
                  </p>
                  {p.errors.map((e) => <p key={e} className="text-caption text-ember">{e}</p>)}
                </div>
                <Badge tone={p.action === 'create' ? 'moss' : p.action === 'update' ? 'gold' : 'ember'}>
                  {p.action === 'create' ? 'New' : p.action === 'update' ? 'Update' : 'Skip'}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </Section>
  )
}
