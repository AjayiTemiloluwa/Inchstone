'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useHierarchyStore } from '@/stores/hierarchyStore'
import { format, startOfYear, endOfYear, eachDayOfInterval, parseISO } from 'date-fns'
import { Play, Pause } from 'lucide-react'
import { Scramble } from './motion'

interface DayFrame {
  date: Date
  label: string
  weekday: string
  pct: number
  done: number
  total: number
}

/**
 * YearFilm — plays your whole year like a film.
 * Pure-canvas frames driven by live Inchstone data (daily completion),
 * scrubbable via slider or horizontal drag, with autoplay.
 */
export function YearFilm({ year }: { year: number }) {
  const { getFlatItems, completionMap } = useHierarchyStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  // ── Build frames from the live hierarchy ──
  const frames: DayFrame[] = (() => {
    const start = startOfYear(new Date(year, 0, 1))
    const end = endOfYear(start)
    const all = eachDayOfInterval({ start, end })
    const flat = getFlatItems()
    const byDate = new Map<string, { pct: number; done: number; total: number }>()
    for (const it of flat) {
      if (it.layer !== 6 || !it.startDate) continue
      const d = typeof it.startDate === 'string' ? parseISO(it.startDate) : new Date(it.startDate)
      if (d.getFullYear() !== year) continue
      const key = format(d, 'yyyy-MM-dd')
      const tasks = (it as any).tasks || []
      const total = tasks.length
      const done = tasks.filter((t: any) => t.completed).length
      const pct = completionMap[it.id] ?? (total > 0 ? (done / total) * 100 : 0)
      const prev = byDate.get(key)
      if (!prev || done > prev.done) byDate.set(key, { pct, done, total })
    }
    return all.map(date => {
      const rec = byDate.get(format(date, 'yyyy-MM-dd')) || { pct: 0, done: 0, total: 0 }
      return {
        date,
        label: format(date, 'MMMM d'),
        weekday: format(date, 'EEEE'),
        pct: rec.pct,
        done: rec.done,
        total: rec.total,
      }
    })
  })()

  const totalFrames = Math.max(frames.length, 1)

  // ── Canvas painter ──
  const paint = useCallback((i: number) => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const frame = frames[Math.min(i, frames.length - 1)]
    if (!frame) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = wrap.clientWidth
    const H = 300
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0a0908'
    ctx.fillRect(0, 0, W, H)

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(243,239,230,0.4)'
    ctx.font = '600 11px "JetBrains Mono", monospace'
    ctx.fillText(`${year} · DAY ${i + 1}/${frames.length}`, 20, 30)

    ctx.fillStyle = '#f3efe6'
    ctx.font = '700 44px "Playfair Display", Georgia, serif'
    ctx.fillText(frame.weekday, 18, 92)
    ctx.fillStyle = 'rgba(243,239,230,0.55)'
    ctx.font = '500 16px "JetBrains Mono", monospace'
    ctx.fillText(frame.label.toUpperCase(), 20, 118)

    // Completion ring
    const cx = W - 78
    const cy = 86
    const r = 46
    const accent = frame.pct >= 80 ? '#7fa871' : frame.pct >= 40 ? '#b8935a' : '#cf8a68'
    ctx.lineWidth = 7
    ctx.strokeStyle = 'rgba(243,239,230,0.08)'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    if (frame.pct > 0) {
      ctx.strokeStyle = accent
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (frame.pct / 100) * Math.PI * 2)
      ctx.stroke()
      ctx.lineCap = 'butt'
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f3efe6'
    ctx.font = '700 22px "JetBrains Mono", monospace'
    ctx.fillText(`${Math.round(frame.pct)}%`, cx, cy + 8)

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(243,239,230,0.5)'
    ctx.font = '500 12px "JetBrains Mono", monospace'
    ctx.fillText(
      frame.total > 0 ? `${frame.done}/${frame.total} deeds completed` : 'No deeds planned',
      20,
      152,
    )

    // Year strip — one tick per day, coloured by its own completion
    const stripY = H - 52
    const pad = 20
    const tickW = (W - pad * 2) / frames.length
    for (let d = 0; d < frames.length; d++) {
      const f = frames[d]
      let color = 'rgba(243,239,230,0.10)'
      if (d <= i && f.total > 0) {
        color = f.pct >= 80 ? '#7fa871' : f.pct >= 40 ? '#b8935a' : '#cf8a68'
      }
      ctx.fillStyle = color
      const h = d === i ? 26 : 14
      ctx.fillRect(pad + d * tickW, stripY + (28 - h), Math.max(tickW - (tickW > 3 ? 1 : 0), 1), h)
    }

    ctx.fillStyle = '#f3efe6'
    ctx.fillRect(pad + i * tickW - (tickW > 3 ? 1 : 0), stripY - 6, Math.max(tickW, 2), 40)

    ctx.fillStyle = 'rgba(243,239,230,0.3)'
    ctx.font = '600 10px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('DRAG TO SCRUB', 20, H - 10)
    ctx.textAlign = 'right'
    ctx.fillText('JAN —— DEC', W - 20, H - 10)
  }, [frames, year])

  // Repaint on index / data / resize
  useEffect(() => {
    paint(idx)
    const onResize = () => paint(idx)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [idx, paint])

  // Autoplay
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setIdx(i => {
        if (i >= totalFrames - 1) { setPlaying(false); return i }
        return i + 1
      })
    }, 85)
    return () => window.clearInterval(id)
  }, [playing, totalFrames])

  // Horizontal drag scrub
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let dragging = false
    let startX = 0
    let startIdx = 0

    const down = (e: PointerEvent) => {
      dragging = true
      startX = e.clientX
      startIdx = idx
      canvas.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const next = Math.round(startIdx + (e.clientX - startX) / 6)
      setIdx(Math.max(0, Math.min(totalFrames - 1, next)))
    }
    const up = () => { dragging = false }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [idx, totalFrames])

  const current = frames[Math.min(idx, frames.length - 1)]

  return (
    <div className="spotlight-card rounded-xl border border-white/10 bg-surface-solid overflow-hidden" data-lenis-prevent>
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 pt-4 pb-3 border-b border-white/10">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>✨</span> <Scramble text={`${year} at a Glance`} className="text-parchment" />
        </h2>
        <p className="text-xs text-parchment/40 font-mono">Your {year}, one day at a time</p>
      </div>

      <div ref={wrapRef} className="relative select-none">
        <canvas ref={canvasRef} data-cursor="Drag" className="block w-full cursor-grab active:cursor-grabbing touch-pan-y" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
        <button
          onClick={() => {
            if (!playing && idx >= totalFrames - 1) setIdx(0)
            setPlaying(p => !p)
          }}
          aria-label={playing ? 'Pause' : 'Play'}
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-gold text-ink hover:bg-[#cbaa6f] transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={idx}
          onChange={e => setIdx(Number(e.target.value))}
          aria-label="Scrub through the year"
          className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-gold"
        />
        <span className="font-mono text-[11px] text-parchment/40 whitespace-nowrap tabular-nums">
          {current ? format(current.date, 'MMM d') : '—'}
        </span>
      </div>
    </div>
  )
}