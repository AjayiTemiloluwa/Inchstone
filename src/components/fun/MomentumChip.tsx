'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Flame, Trophy, TrendingUp, X } from 'lucide-react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { DEED_DONE, installDeedEvents, type DeedDoneDetail } from '@/lib/deedEvents'
import { useEmblem } from '@/lib/emblem'
import { XP_PER_DEED, levelOf, levelProgress, titleOf, type MomentumStats } from '@/lib/momentum'

/**
 * MomentumChip — the game layer's home in the top bar.
 *
 *  · Your emblem inside a ring that fills with XP toward the next level.
 *  · Finish a deed anywhere → "+10 XP" pops from where you tapped and flies
 *    into the ring, which kicks and refills.
 *  · Deeds back to back (within 2 minutes) build a combo: ×2, ×3…
 *  · Crossing a level → a full-screen LEVEL UP moment with your new title.
 *  · Beating your best day → a "New record" banner, once per day.
 *  · Tap the chip for the scoreboard: level, XP to go, today vs yesterday vs
 *    your record.
 */

const COMBO_WINDOW_MS = 120_000

const localDay = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function MomentumChip() {
  const { Icon: EmblemIcon } = useEmblem()
  const [stats, setStats] = useState<MomentumStats | null>(null)
  const [open, setOpen] = useState(false)
  const [combo, setCombo] = useState(0)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const chipRef = useRef<HTMLButtonElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const lastDone = useRef(0)
  const statsRef = useRef<MomentumStats | null>(null)
  const gradId = useId()
  useEffect(() => {
    statsRef.current = stats
  }, [stats])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/momentum?today=${localDay()}`, { cache: 'no-store' })
      if (res.ok) setStats((await res.json()) as MomentumStats)
    } catch {
      /* offline — keep what we have */
    }
  }, [])

  useEffect(() => {
    installDeedEvents()
    // first load is deferred a frame so it never competes with the page's own data
    const raf = requestAnimationFrame(() => void load())
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  // ── a deed was finished somewhere in the app ──
  useEffect(() => {
    const onDone = (e: Event) => {
      const { x, y } = (e as CustomEvent<DeedDoneDetail>).detail
      const prev = statsRef.current
      if (!prev) return
      const next = { ...prev, total: prev.total + 1, today: prev.today + 1 }
      setStats(next)

      const now = Date.now()
      const nextCombo = now - lastDone.current < COMBO_WINDOW_MS ? combo + 1 : 1
      lastDone.current = now
      setCombo(nextCombo)

      flyXp(x, y, chipRef.current, nextCombo)
      navigator.vibrate?.(nextCombo > 1 ? [18, 40, 18] : 18)

      const before = levelOf(prev.total * XP_PER_DEED)
      const after = levelOf(next.total * XP_PER_DEED)
      if (after > before) window.setTimeout(() => setLevelUp(after), 700)
      else if (prev.bestDay > 0 && next.today === prev.bestDay + 1) {
        let shown = false
        try {
          shown = window.localStorage.getItem(`inchstone-record-${localDay()}`) === '1'
          window.localStorage.setItem(`inchstone-record-${localDay()}`, '1')
        } catch {
          /* storage blocked */
        }
        if (!shown) window.setTimeout(() => recordBanner(next.today), 700)
      }
    }
    window.addEventListener(DEED_DONE, onDone)
    return () => window.removeEventListener(DEED_DONE, onDone)
  }, [combo])

  // the combo cools off after the window
  useEffect(() => {
    if (combo < 1) return
    const id = window.setTimeout(() => setCombo(0), COMBO_WINDOW_MS)
    return () => window.clearTimeout(id)
  }, [combo])

  const xp = (stats?.total ?? 0) * XP_PER_DEED
  const lp = levelProgress(xp)
  const R = 14
  const C = 2 * Math.PI * R

  // ring fills smoothly whenever XP changes
  useEffect(() => {
    const ring = ringRef.current
    if (!ring || !stats) return
    const offset = C * (1 - lp.progress)
    if (prefersReducedMotion()) ring.style.strokeDashoffset = String(offset)
    else gsap.to(ring, { strokeDashoffset: offset, duration: 1.1, ease: 'elastic.out(1, 0.6)', delay: 0.45 })
  }, [lp.progress, stats, C])

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Momentum: level ${lp.level}, ${lp.title}. ${lp.toNext} XP to the next level.`}
        aria-expanded={open}
        className="momentum-chip relative flex h-9 shrink-0 items-center gap-2 rounded-full px-1 pr-1 transition-colors hover:bg-parchment/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:pr-3"
      >
        <span className="relative grid h-9 w-9 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgb(var(--gold-rgb))" />
                <stop offset="100%" stopColor="rgb(var(--volt-rgb))" />
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r={R} fill="none" stroke="rgb(var(--parchment-rgb) / 0.1)" strokeWidth="3" />
            <circle
              ref={ringRef}
              cx="18"
              cy="18"
              r={R}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C}
            />
          </svg>
          <EmblemIcon className="momentum-emblem relative h-4 w-4 text-gold" strokeWidth={2} aria-hidden="true" />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 font-mono text-[9px] font-bold leading-none text-ink">
            {lp.level}
          </span>
        </span>
        <span className="hidden flex-col items-start leading-none sm:flex">
          <span className="text-[12px] font-semibold text-parchment">{lp.title}</span>
          <span className="mt-1 font-mono text-[10px] text-parchment/50">{lp.toNext} XP to go</span>
        </span>
        {combo > 1 && (
          <span key={combo} className="combo-badge absolute -top-2 left-6 rounded-full bg-ember px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink">
            ×{combo}
          </span>
        )}
      </button>

      {open && stats && <Scoreboard stats={stats} xp={xp} combo={combo} onClose={() => setOpen(false)} anchor={chipRef} />}
      {levelUp != null && <LevelUp level={levelUp} onDone={() => setLevelUp(null)} />}
    </>
  )
}

/* ── the scoreboard popover ─────────────────────────────────────────── */

function Scoreboard({ stats, xp, combo, onClose, anchor }: { stats: MomentumStats; xp: number; combo: number; onClose: () => void; anchor: React.RefObject<HTMLButtonElement | null> }) {
  const ref = useRef<HTMLDivElement>(null)
  const lp = levelProgress(xp)
  const vsYesterday = stats.today - stats.yesterday
  const toRecord = Math.max(0, stats.bestDay + 1 - stats.today)

  useEffect(() => {
    const el = ref.current
    if (el && !prefersReducedMotion()) {
      gsap.fromTo(el, { autoAlpha: 0, y: -10, scale: 0.92, transformOrigin: '90% 0%' }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)' })
      gsap.fromTo(el.querySelectorAll('[data-pop]'), { autoAlpha: 0, y: 12, scale: 0.8 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: 'back.out(2)', delay: 0.1 })
      gsap.fromTo(el.querySelector('[data-xpbar]'), { scaleX: 0 }, { scaleX: lp.progress, duration: 1, ease: 'elastic.out(1, 0.7)', delay: 0.2, transformOrigin: '0% 50%' })
    }
    const away = (e: PointerEvent) => {
      if (!el?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [anchor, onClose, lp.progress])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Your momentum"
      className="fixed right-3 top-14 z-[60] w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-gold/25 bg-surface-solid p-5 shadow-2xl"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-parchment/50">Level {lp.level}</p>
          <p className="mt-1 font-display text-[1.75rem] font-bold leading-none text-gold">{lp.title}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-parchment/50 hover:bg-parchment/[0.06] hover:text-parchment">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-parchment/10">
          <div data-xpbar className="h-full w-full rounded-full" style={{ transform: `scaleX(${lp.progress})`, transformOrigin: '0% 50%', background: 'linear-gradient(90deg, rgb(var(--gold-rgb)), rgb(var(--volt-rgb)))' }} />
        </div>
        <p className="mt-2 flex justify-between font-mono text-[11px] text-parchment/55">
          <span className="tabular-nums">{xp.toLocaleString()} XP</span>
          <span>{lp.toNext} XP → {lp.nextTitle === lp.title ? `Level ${lp.level + 1}` : lp.nextTitle}</span>
        </p>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2">
        <Tile icon={<Flame className="h-4 w-4" />} label="Today" value={stats.today} tone="gold" />
        <Tile icon={<TrendingUp className="h-4 w-4" />} label="Yesterday" value={stats.yesterday} />
        <Tile icon={<Trophy className="h-4 w-4" />} label="Record" value={stats.bestDay} />
      </div>

      <p data-pop className="relative mt-4 rounded-xl bg-gold/10 px-3 py-2.5 text-[13px] leading-snug text-parchment/85">
        {stats.today === 0
          ? 'Finish your first deed today to get the fire going.'
          : toRecord === 0
            ? `New record! ${stats.today} deeds today. Every one from here raises the bar.`
            : vsYesterday > 0
              ? `${vsYesterday} ahead of yesterday. ${toRecord} more for a new record.`
              : `${toRecord} more to set a new record${vsYesterday < 0 ? `, ${-vsYesterday} to match yesterday` : ''}.`}
        {combo > 1 && <span className="ml-1 font-semibold text-ember">Combo ×{combo}!</span>}
      </p>
    </div>
  )
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'gold' }) {
  return (
    <div data-pop className="rounded-xl border border-gold/15 p-2.5 text-center">
      <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full ${tone ? 'bg-gold/15 text-gold' : 'bg-parchment/[0.06] text-parchment/60'}`}>{icon}</span>
      <p className="mt-1.5 font-display text-xl font-bold leading-none tabular-nums text-parchment">{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-parchment/45">{label}</p>
    </div>
  )
}

/* ── LEVEL UP ───────────────────────────────────────────────────────── */

function LevelUp({ level, onDone }: { level: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { Icon } = useEmblem()
  const title = titleOf(level)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    navigator.vibrate?.([40, 60, 40, 60, 120])
    import('@/components/ui/Confetti').then((m) => m.fireConfetti()).catch(() => {})
    if (prefersReducedMotion()) {
      const id = window.setTimeout(onDone, 2600)
      return () => window.clearTimeout(id)
    }
    const tl = gsap.timeline({ onComplete: onDone })
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 })
      .fromTo(el.querySelector('[data-burst]'), { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.6)' }, 0)
      .fromTo(el.querySelector('[data-emblem]'), { scale: 0, rotate: -200 }, { scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, 0.1)
      .fromTo(el.querySelectorAll('[data-rays] span'), { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.02, ease: 'power3.out' }, 0.15)
      .fromTo(el.querySelectorAll('[data-char]'), { yPercent: 120, rotate: 12, autoAlpha: 0 }, { yPercent: 0, rotate: 0, autoAlpha: 1, duration: 0.6, stagger: 0.04, ease: 'back.out(2.2)' }, 0.3)
      .fromTo(el.querySelector('[data-title]'), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, 0.7)
      .to(el.querySelector('[data-rays]'), { rotate: 60, duration: 2.6, ease: 'none' }, 0)
      .to(el, { autoAlpha: 0, duration: 0.4, delay: 1.4 })
    return () => {
      tl.kill()
    }
  }, [onDone])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div ref={ref} role="status" aria-live="assertive" onClick={onDone} className="fixed inset-0 z-[9998] grid place-items-center bg-ink/80 backdrop-blur-sm">
      <div className="relative grid place-items-center">
        <div data-rays aria-hidden="true" className="absolute h-[22rem] w-[22rem]">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-0 h-1/2 w-1 origin-bottom rounded-full"
              style={{ transform: `translateX(-50%) rotate(${i * 22.5}deg)`, background: `linear-gradient(to top, transparent, rgb(var(--${i % 2 ? 'volt' : 'gold'}-rgb) / 0.7))` }}
            />
          ))}
        </div>
        <div data-burst className="relative grid h-40 w-40 place-items-center rounded-full" style={{ background: 'radial-gradient(circle, rgb(var(--gold-rgb) / 0.35), transparent 70%)' }}>
          <span data-emblem className="grid h-24 w-24 place-items-center rounded-full bg-gold text-ink shadow-[0_0_60px_rgb(var(--gold-rgb)/0.6)]">
            <Icon className="h-12 w-12" strokeWidth={2} />
          </span>
        </div>
        <p className="relative mt-6 flex overflow-hidden font-display text-5xl font-black tracking-tight text-parchment sm:text-6xl" aria-label={`Level up! Level ${level}`}>
          {'LEVEL UP'.split('').map((c, i) => (
            <span key={i} data-char className="inline-block" style={{ whiteSpace: 'pre' }}>
              {c}
            </span>
          ))}
        </p>
        <p data-title className="relative mt-3 font-mono text-sm uppercase tracking-[0.3em] text-gold">
          Level {level} · {title}
        </p>
      </div>
    </div>,
    document.body,
  )
}

/* ── the flying "+10 XP" ────────────────────────────────────────────── */

function flyXp(x: number, y: number, target: HTMLElement | null, combo: number) {
  if (prefersReducedMotion()) return
  const tag = document.createElement('div')
  tag.setAttribute('aria-hidden', 'true')
  tag.className = 'xp-pop'
  tag.textContent = combo > 1 ? `+${XP_PER_DEED} XP ×${combo}` : `+${XP_PER_DEED} XP`
  Object.assign(tag.style, { left: `${x}px`, top: `${y}px` })
  document.body.appendChild(tag)

  // a ring of sparks where you tapped
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span')
    s.className = 'xp-spark'
    Object.assign(s.style, { left: `${x}px`, top: `${y}px` })
    document.body.appendChild(s)
    const a = (i / 10) * Math.PI * 2
    gsap.to(s, { x: Math.cos(a) * 46, y: Math.sin(a) * 46, scale: 0, duration: 0.6, ease: 'power3.out', onComplete: () => s.remove() })
  }

  const t = target?.getBoundingClientRect()
  const tx = t ? t.left + 18 - x : 0
  const ty = t ? t.top + 18 - y : -120
  gsap
    .timeline({ onComplete: () => tag.remove() })
    .fromTo(tag, { xPercent: -50, yPercent: -50, scale: 0.4, autoAlpha: 0 }, { scale: 1.25, autoAlpha: 1, y: -34, duration: 0.35, ease: 'back.out(3)' })
    .to(tag, { scale: 1, duration: 0.15 })
    .to(tag, { x: tx, y: ty, scale: 0.35, autoAlpha: 0.2, duration: 0.6, ease: 'power3.in' })
    .add(() => {
      if (target) gsap.fromTo(target, { scale: 1.28 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' })
    })
}

function recordBanner(count: number) {
  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.className = 'record-banner'
  el.innerHTML = `<strong>New record day!</strong><span>${count} deeds. You just beat your best.</span>`
  document.body.appendChild(el)
  import('@/components/ui/Confetti').then((m) => m.fireConfetti(window.innerWidth / 2, 90)).catch(() => {})
  if (prefersReducedMotion()) {
    window.setTimeout(() => el.remove(), 3500)
    return
  }
  gsap
    .timeline({ onComplete: () => el.remove() })
    .fromTo(el, { xPercent: -50, y: -80, scale: 0.8, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(2)' })
    .to(el, { y: -80, autoAlpha: 0, duration: 0.4, delay: 2.6, ease: 'power2.in' })
}
