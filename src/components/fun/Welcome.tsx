'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUser } from '@clerk/nextjs'
import { ArrowRight, BellRing, Check, Sparkles } from 'lucide-react'
import { Draggable, gsap, prefersReducedMotion } from '@/lib/gsap'
import { applyAccent } from '@/lib/accent'
import { PALETTES, applyPalette, readPalette, type PaletteId } from '@/lib/palette'
import { EMBLEMS, setEmblem, useEmblem, type EmblemId } from '@/lib/emblem'
import { isPushSubscribed, subscribeToPush } from '@/lib/pushSubscribe'
import { ThemeSwitch } from '@/components/ui/ThemeToggle'

/**
 * Welcome — the first-login setup, shown once per person on each device.
 *
 *   1 Hello      your name pops in letter by letter; neon shapes you can fling around
 *   2 Mood       pick the colour mood: the app re-colours live behind the card
 *   3 Emblem     pick the icon that stands for you (it lives in your level ring)
 *   4 Alerts     turn on live notifications, so deed timers reach you with the app closed
 *   5 Ready      Level 1 · Spark, and how XP, combos and records work
 *
 * Replay any time from Settings → Appearance (WELCOME_OPEN event).
 */

export const WELCOME_OPEN = 'inchstone:welcome-open'
const doneKey = (userId: string) => `inchstone-welcomed-${userId}`
const STEPS = ['hello', 'mood', 'emblem', 'alerts', 'ready'] as const

export function Welcome() {
  const { user, isLoaded } = useUser()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!isLoaded || !user) return
    let seen = false
    try {
      seen = window.localStorage.getItem(doneKey(user.id)) === '1'
    } catch {
      seen = true // storage blocked: don't trap the user in a loop
    }
    const raf = requestAnimationFrame(() => !seen && setOpen(true))
    const replay = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(WELCOME_OPEN, replay)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener(WELCOME_OPEN, replay)
    }
  }, [isLoaded, user])

  const finish = useCallback(() => {
    if (user) {
      try {
        window.localStorage.setItem(doneKey(user.id), '1')
      } catch {
        /* storage blocked */
      }
    }
    setOpen(false)
  }, [user])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <Stage step={step} setStep={setStep} name={user?.firstName ?? null} onFinish={finish} />,
    document.body,
  )
}

function Stage({ step, setStep, name, onFinish }: { step: number; setStep: (n: number) => void; name: string | null; onFinish: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const reduced = prefersReducedMotion()

  // every step's pieces pop in, springy and staggered
  useLayoutEffect(() => {
    const el = card.current
    if (!el || reduced) return
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { scale: 0.94, rotateX: -8, autoAlpha: 0.4 }, { scale: 1, rotateX: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.6)', transformPerspective: 900 })
      gsap.fromTo('[data-in]', { y: 26, scale: 0.85, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, stagger: 0.07, ease: 'back.out(2)', delay: 0.08 })
      gsap.fromTo('[data-char]', { yPercent: 110, rotate: 14, autoAlpha: 0 }, { yPercent: 0, rotate: 0, autoAlpha: 1, duration: 0.7, stagger: 0.035, ease: 'back.out(2.4)', delay: 0.15 })
    }, el)
    return () => ctx.revert()
  }, [step, reduced])

  const go = (n: number) => {
    const el = card.current
    if (!el || reduced) return setStep(n)
    gsap.to(el, { x: n > step ? -40 : 40, autoAlpha: 0, scale: 0.96, duration: 0.22, ease: 'power2.in', onComplete: () => { gsap.set(el, { x: 0 }); setStep(n) } })
  }
  const next = () => (step < STEPS.length - 1 ? go(step + 1) : onFinish())

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label="Welcome to Inchstone" className="welcome fixed inset-0 z-[9990] grid place-items-center overflow-hidden bg-ink/90 p-4 backdrop-blur-md">
      <Shapes container={root} />
      <div ref={card} className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-gold/25 bg-surface-solid/95 p-6 shadow-2xl sm:p-9">
        <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl" style={{ background: 'rgb(var(--volt-rgb) / 0.16)' }} />

        {/* progress: one pip per step */}
        <div className="relative mb-7 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span key={s} className="h-1.5 rounded-full transition-all duration-500" style={{ width: i === step ? 28 : 8, background: i <= step ? 'rgb(var(--gold-rgb))' : 'rgb(var(--parchment-rgb) / 0.15)' }} />
            ))}
          </div>
          {step < STEPS.length - 1 && (
            <button type="button" onClick={onFinish} className="text-[12px] text-parchment/45 hover:text-parchment/80">
              Skip
            </button>
          )}
        </div>

        <div className="relative min-h-[300px]">
          {step === 0 && <Hello name={name} />}
          {step === 1 && <Mood />}
          {step === 2 && <EmblemStep />}
          {step === 3 && <Alerts />}
          {step === 4 && <Ready />}
        </div>

        <div className="relative mt-7 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className="rounded-xl px-3 py-2.5 text-[13px] text-parchment/55 hover:text-parchment">
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={next} className="welcome-go group flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-[14px] font-semibold text-ink transition-transform active:scale-95">
            {step === 0 ? "Let's go" : step === STEPS.length - 1 ? 'Start my day' : 'Next'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Chars({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap overflow-hidden ${className ?? ''}`} aria-label={text}>
      {text.split('').map((c, i) => (
        <span key={i} data-char aria-hidden="true" className="inline-block" style={{ whiteSpace: 'pre' }}>
          {c}
        </span>
      ))}
    </span>
  )
}

/* ── 1 · Hello ── */
function Hello({ name }: { name: string | null }) {
  return (
    <div>
      <p data-in className="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Welcome to Inchstone</p>
      <h2 className="mt-3 font-display text-[2.6rem] font-black leading-[1.02] text-parchment sm:text-[3.2rem]">
        <Chars text={name ? `Hey ${name},` : 'Hey there,'} />
        <br />
        <Chars text="let's get moving." className="text-gold" />
      </h2>
      <p data-in className="mt-5 max-w-[40ch] text-[15px] leading-relaxed text-parchment/65">
        Inchstone turns big goals into small daily deeds. Finish deeds, earn XP, level up and beat your own records.
      </p>
      <p data-in className="mt-4 flex items-center gap-2 text-[13px] text-parchment/45">
        <Sparkles className="h-4 w-4 text-gold" /> Three quick choices and you&apos;re in. Try flinging the shapes.
      </p>
    </div>
  )
}

/* ── 2 · Mood ── */
function Mood() {
  const [active, setActive] = useState<PaletteId>(() => readPalette())
  const pick = (id: PaletteId, el: HTMLElement) => {
    setActive(id)
    applyAccent({ kind: 'default' })
    applyPalette(id)
    if (!prefersReducedMotion()) gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.4)' })
    navigator.vibrate?.(10)
  }
  return (
    <div>
      <p data-in className="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Step 1 · Your colour mood</p>
      <h2 className="mt-3 font-display text-[2rem] font-black leading-tight text-parchment sm:text-[2.4rem]">
        <Chars text="Pick your vibe." />
      </h2>
      <div role="radiogroup" aria-label="Colour mood" className="mt-5 grid grid-cols-2 gap-3">
        {PALETTES.map((p) => {
          const on = active === p.id
          return (
            <button
              key={p.id}
              data-in
              type="button"
              role="radio"
              aria-checked={on}
              onClick={(e) => pick(p.id, e.currentTarget)}
              className={`relative overflow-hidden rounded-2xl border-2 p-3.5 text-left ${on ? 'border-gold' : 'border-transparent'}`}
              style={{ background: p.swatch[0], boxShadow: on ? `0 0 26px ${p.swatch[1]}66` : undefined }}
            >
              <span className="flex h-10 items-end gap-1.5" aria-hidden="true">
                {p.swatch.slice(1).map((c, i) => (
                  <span key={c} className="w-full rounded-full" style={{ background: c, height: `${[100, 70, 45][i]}%`, boxShadow: p.id === 'classic' ? undefined : `0 0 12px ${c}aa` }} />
                ))}
              </span>
              <span className="mt-2.5 flex items-center justify-between">
                <span className="text-[14px] font-bold" style={{ color: p.id === 'classic' ? '#f3efe6' : p.swatch[1] }}>{p.name}</span>
                {on && <Check className="h-4 w-4" style={{ color: p.swatch[1] }} strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>
      <div data-in className="mt-4 flex items-center justify-between rounded-xl border border-gold/15 px-4 py-2.5">
        <span className="text-[13px] text-parchment/65">Dark or light</span>
        <ThemeSwitch />
      </div>
    </div>
  )
}

/* ── 3 · Emblem ── */
function EmblemStep() {
  const current = useEmblem()
  const big = useRef<HTMLSpanElement>(null)
  const pick = (id: EmblemId) => {
    setEmblem(id)
    navigator.vibrate?.(10)
    if (big.current && !prefersReducedMotion()) {
      gsap.fromTo(big.current, { scale: 0.3, rotate: -120 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1.1, 0.45)' })
    }
  }
  const Big = current.Icon
  return (
    <div>
      <p data-in className="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Step 2 · Your emblem</p>
      <div className="mt-3 flex items-center gap-4">
        <span data-in className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ background: 'conic-gradient(rgb(var(--gold-rgb)) 0 20%, rgb(var(--parchment-rgb) / 0.12) 20% 100%)' }}>
          <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-surface-solid">
            <span ref={big} className="inline-grid">
              <Big className="h-7 w-7 text-gold" strokeWidth={2} />
            </span>
          </span>
        </span>
        <h2 className="font-display text-[1.9rem] font-black leading-tight text-parchment sm:text-[2.2rem]">
          <Chars text="Pick your mark." />
        </h2>
      </div>
      <p data-in className="mt-2 text-[13px] text-parchment/55">It sits in your level ring and leads your level-ups.</p>
      <div role="radiogroup" aria-label="Emblem" className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-8">
        {EMBLEMS.map(({ id, label, Icon }) => {
          const on = current.id === id
          return (
            <button
              key={id}
              data-in
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              title={label}
              onClick={() => pick(id)}
              className={`grid aspect-square place-items-center rounded-xl border transition-colors ${on ? 'border-gold bg-gold text-ink shadow-[0_0_18px_rgb(var(--gold-rgb)/0.5)]' : 'border-gold/15 text-parchment/70 hover:border-gold/50 hover:text-gold'}`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── 4 · Alerts ── */
function Alerts() {
  const [state, setState] = useState<'idle' | 'working' | 'on' | 'blocked'>('idle')
  const bell = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    isPushSubscribed().then((on) => on && setState('on'))
    if (bell.current && !prefersReducedMotion()) {
      const t = gsap.to(bell.current, { rotate: 16, duration: 0.12, yoyo: true, repeat: 7, ease: 'sine.inOut', repeatDelay: 0, delay: 0.6 })
      return () => {
        t.kill()
      }
    }
  }, [])
  const enable = async () => {
    setState('working')
    try {
      setState((await subscribeToPush()) ? 'on' : 'blocked')
    } catch {
      setState('blocked')
    }
  }
  return (
    <div>
      <p data-in className="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Step 3 · Live alerts</p>
      <div className="mt-3 flex items-start gap-4">
        <span ref={bell} data-in className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
          <BellRing className="h-7 w-7" />
        </span>
        <h2 className="font-display text-[1.9rem] font-black leading-tight text-parchment sm:text-[2.2rem]">
          <Chars text="Never miss a beat." />
        </h2>
      </div>
      <ul className="mt-5 space-y-2.5 text-[14px] text-parchment/70">
        <li data-in>⏳ A heads-up before each deed starts</li>
        <li data-in>▶ A live card while it runs, with Done and +15 min buttons</li>
        <li data-in>✓ A cheer when it finishes, even with the app closed</li>
      </ul>
      <div data-in className="mt-6">
        {state === 'on' ? (
          <p className="flex items-center gap-2 rounded-xl bg-moss/15 px-4 py-3 text-[14px] font-semibold text-moss">
            <Check className="h-5 w-5" strokeWidth={3} /> Live alerts are on for this device.
          </p>
        ) : state === 'blocked' ? (
          <p className="rounded-xl bg-ember/15 px-4 py-3 text-[13px] text-parchment/80">
            Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then turn them on in Settings.
          </p>
        ) : (
          <button type="button" onClick={enable} disabled={state === 'working'} className="w-full rounded-xl border-2 border-gold px-4 py-3 text-[14px] font-semibold text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-60">
            {state === 'working' ? 'Turning on…' : 'Turn on live alerts'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── 5 · Ready ── */
function Ready() {
  const { Icon } = useEmblem()
  const ring = useRef<SVGCircleElement>(null)
  useEffect(() => {
    import('@/components/ui/Confetti').then((m) => m.fireConfetti()).catch(() => {})
    navigator.vibrate?.([30, 50, 30])
    if (ring.current && !prefersReducedMotion()) gsap.fromTo(ring.current, { strokeDashoffset: 264 }, { strokeDashoffset: 250, duration: 1.4, ease: 'elastic.out(1, 0.5)', delay: 0.4 })
  }, [])
  return (
    <div className="text-center">
      <div data-in className="relative mx-auto grid h-28 w-28 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--parchment-rgb) / 0.12)" strokeWidth="7" />
          <circle ref={ring} cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--gold-rgb))" strokeWidth="7" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="250" />
        </svg>
        <Icon className="h-11 w-11 text-gold" strokeWidth={2} />
        <span className="absolute -bottom-1 right-1 rounded-full bg-gold px-2 py-0.5 font-mono text-[11px] font-bold text-ink">Lv 1</span>
      </div>
      <h2 className="mt-5 font-display text-[2.2rem] font-black leading-tight text-parchment">
        <Chars text="You're a Spark." />
      </h2>
      <div className="mx-auto mt-5 grid max-w-[380px] grid-cols-3 gap-2 text-left">
        {[
          ['+10 XP', 'for every deed you finish'],
          ['Combos', 'deeds back to back'],
          ['Records', 'beat your best day'],
        ].map(([k, v]) => (
          <div key={k} data-in className="rounded-xl border border-gold/15 p-3">
            <p className="font-display text-[15px] font-bold text-gold">{k}</p>
            <p className="mt-1 text-[11px] leading-snug text-parchment/55">{v}</p>
          </div>
        ))}
      </div>
      <p data-in className="mt-5 text-[13px] text-parchment/50">Your level ring sits in the top bar. Tap it any time for the scoreboard.</p>
    </div>
  )
}

/* ── the flingable neon shapes behind the card ── */
function Shapes({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host || prefersReducedMotion()) return
    const shapes = [...host.querySelectorAll<HTMLElement>('[data-shape]')]
    const floats = shapes.map((s, i) =>
      gsap.to(s, { y: '+=24', rotate: i % 2 ? 25 : -25, duration: 2.6 + i * 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
    )
    const drags = Draggable.create(shapes, {
      type: 'x,y',
      bounds: container.current ?? undefined,
      inertia: true,
      onPress() {
        floats.forEach((f) => f.pause())
        gsap.to(this.target, { scale: 1.2, duration: 0.2 })
      },
      onRelease() {
        gsap.to(this.target, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
      },
    })
    gsap.fromTo(shapes, { scale: 0 }, { scale: 1, duration: 0.9, stagger: 0.08, ease: 'elastic.out(1, 0.5)', delay: 0.2 })
    return () => {
      floats.forEach((f) => f.kill())
      drags.forEach((d) => d.kill())
    }
  }, [container])

  const items: { cls: string; style: React.CSSProperties }[] = [
    { cls: 'h-20 w-20 rounded-full', style: { left: '8%', top: '12%', background: 'rgb(var(--gold-rgb))' } },
    { cls: 'h-14 w-28 rounded-full', style: { right: '9%', top: '10%', background: 'rgb(var(--volt-rgb))' } },
    { cls: 'h-16 w-16 rounded-2xl rotate-12', style: { left: '12%', bottom: '14%', background: 'rgb(var(--ember-rgb))' } },
    { cls: 'h-24 w-24 rounded-full border-[10px]', style: { right: '7%', bottom: '12%', borderColor: 'rgb(var(--moss-rgb))' } },
    { cls: 'h-10 w-10 rounded-full', style: { left: '46%', top: '5%', background: 'rgb(var(--gold-glow-rgb))' } },
  ]
  return (
    <div ref={ref} className="absolute inset-0" aria-hidden="true">
      {items.map((it, i) => (
        <span key={i} data-shape className={`absolute cursor-grab touch-none opacity-80 shadow-[0_0_40px_currentColor] active:cursor-grabbing ${it.cls}`} style={it.style} />
      ))}
    </div>
  )
}
