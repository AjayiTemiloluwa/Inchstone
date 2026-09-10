import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { Compass } from '@/components/ui/Compass'
import { ArrowRight, BellRing, CalendarCheck, Check, Layers, Repeat, Star, Target } from 'lucide-react'

export const metadata = {
  title: 'Inchstone — Small steps, compounded daily',
  description: 'Turn your yearly vision into daily deeds. Plan today, build habits, review progress.',
}

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#habits', label: 'Habits' },
  { href: '#how', label: 'How it works' },
]

const FEATS = [
  { icon: Target, t: 'Yearly vision, kept visible', b: 'Set the direction once. Every quarter, month, week, and day inherits it.' },
  { icon: CalendarCheck, t: 'Day plans that fit life', b: 'A 24-hour timeline with weights for what matters — and one frog first.' },
  { icon: Repeat, t: 'Habits that stick', b: 'Daily, weekly, or weekday repeats — with streaks and per-habit trends.' },
  { icon: BellRing, t: 'Alarms that nudge', b: 'Deeds ring before they start, count down, and warn before time runs out.' },
  { icon: Star, t: 'Reviews & reports', b: 'Short day, week, and month reviews with scores that show compounding.' },
  { icon: Layers, t: 'Always aligned', b: 'Every deed links back up the chain, from Day all the way to Year.' },
]

const FLOW = ['Year', 'Quarter', 'Month', 'Week', 'Day']

const FLOW_DESC = 'One vision, carried down every layer.'

const STEPS = [
  { n: '01', t: 'Set the direction', b: 'Write what this year is about — theme, focus question, goals.' },
  { n: '02', t: 'Break it down', b: 'The year cascades into quarters, months, weeks, and today.' },
  { n: '03', t: 'Win the day', b: 'Open today, do the work, check in. Small wins compound.' },
]

const DEMO = [
  { t: 'Morning prayer & Word', s: '12-day streak', done: true },
  { t: 'Deep work block (code / research / MSc)', s: '8-day streak', done: true },
  { t: 'Evening review and plan for tomorrow morning', s: '5-day streak', done: false },
]

export default async function Home() {
  const { userId } = await auth()

  if (userId) redirect('/dashboard')

  const shell = 'mx-auto w-full max-w-6xl px-5 sm:px-8'

  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      {/* ── Sticky nav ── */}
      <header className="sticky top-0 z-40 border-b hairline-bottom bg-paper/90 backdrop-blur-md">
        <div className={`${shell} flex h-16 items-center justify-between gap-4`}>
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Inchstone home">
            <Compass alignment={100} ringProgress={100} size={30} />
            <span className="font-display text-lg font-bold tracking-tight text-parchment">Inchstone</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {NAV.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-ink/60 transition hover:text-gold">{l.label}</a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 text-sm font-semibold text-ink/70 transition hover:text-gold sm:min-h-10">Sign in</Link>
            <Link href="/sign-up" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gold px-4 text-sm font-semibold text-ink transition hover:bg-gold-dim sm:min-h-10 sm:px-5">Get started<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className={`${shell} pb-14 pt-12 sm:pb-20 sm:pt-16 lg:pt-20`}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border hairline bg-gold/[0.07] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-gold"><Layers className="h-3.5 w-3.5" aria-hidden="true" />Year-to-day planning</p>
            <h1 className="mt-6 font-display text-[2.6rem] font-bold leading-[1.06] tracking-tight text-balance text-parchment sm:text-6xl">Small steps,<br />compounded daily.</h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink/65 sm:text-lg">One calm place for your yearly vision, daily deeds, habits, and reviews — so small actions compound into real transformation.</p>
            <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
              <Link href="/sign-up" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-gold px-7 text-base font-semibold text-ink transition hover:bg-gold-dim sm:flex-none">Start free<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link href="/sign-in" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border hairline px-7 text-base font-semibold transition hover:border-gold/50 hover:text-gold sm:flex-none">Sign in</Link>
            </div>
            <p className="mt-5 text-sm text-ink/45">Free to start - No credit card - Phone + desktop</p>
          </div>
        </section>
        <section className={`${shell} pb-14 sm:pb-20`}>
          <div className="mx-auto max-w-3xl">
            <div className="overflow-hidden rounded-2xl border hairline bg-surface-solid">
              <div className="flex items-center justify-between gap-3 border-b hairline-bottom bg-black/[0.04] px-5 py-3.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/50">Today</p>
                <p className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-gold">2 of 3 done</p>
              </div>
              <div className="flex items-center justify-center px-5 py-6">
                <Compass alignment={72} ringProgress={72} primary="72" ringLabel="ALIGNED" dayLabel="DAY 252" size={168} />
              </div>
              <div className="space-y-2 border-t hairline-top bg-black/[0.04] px-5 py-4">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-paper px-3 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-moss bg-moss text-ink" aria-hidden="true"><Check className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1 break-words text-sm leading-snug text-ink/45 line-through">Morning prayer and Word</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-paper px-3 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-moss bg-moss text-ink" aria-hidden="true"><Check className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1 break-words text-sm leading-snug text-ink/45 line-through">Hardest task first</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-paper px-3 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-white/20" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">Deep work block</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="border-y hairline-top border-b hairline-bottom bg-surface">
          <div className={`${shell} py-10 sm:py-12`}>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.26em] text-ink/40">{FLOW_DESC}</p>
            <div className="mt-5 flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center sm:flex-wrap sm:overflow-visible">
              {FLOW.map((layer, i) => (
                <span key={layer} className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${i === FLOW.length - 1 ? 'border-gold/50 bg-gold text-ink' : 'border-gold/30 bg-gold/10 text-gold'}`}>{layer}</span>
                  {i < FLOW.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-ink/25" aria-hidden="true" />}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className={`${shell} scroll-mt-20 py-14 sm:py-20`}>
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Features</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-parchment sm:text-4xl">Everything you need to stay the course</h2>
            <p className="mt-3 leading-relaxed text-ink/60">Planning, doing, and reviewing live in one calm place.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATS.map((f) => (
              <article key={f.t} className="min-w-0 rounded-xl border hairline bg-surface-solid p-5 transition hover:border-gold/40 sm:p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold/25 bg-gold/10"><f.icon className="h-5 w-5 text-gold" aria-hidden="true" /></span>
                <h3 className="mt-4 font-display text-lg font-bold leading-snug text-parchment">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{f.b}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="habits" className="border-t hairline-top bg-surface">
          <div className={`${shell} grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-14`}>
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Habit tracker</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-parchment sm:text-4xl">Habits you can read on your phone</h2>
              <p className="mt-4 leading-relaxed text-ink/60">Full titles wrap instead of being cut off, with streaks and trends.</p>
              <Link href="/sign-up" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gold px-7 font-semibold text-ink transition hover:bg-gold-dim">Try it free<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            <div className="w-full min-w-0 rounded-2xl border border-gold/30 bg-paper p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display font-bold text-parchment">Habit Tracker</h3>
                <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-gold">2/3 today</span>
              </div>
              <div className="space-y-1.5">
                {DEMO.map((h) => (
                  <div key={h.t} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/[0.04] px-3 py-2.5">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border ${h.done ? 'border-moss bg-moss text-ink' : 'border-ink/20'}`} aria-hidden="true">{h.done && <Check className="h-3.5 w-3.5" />}</span>
                    <span className={`min-w-0 flex-1 break-words text-sm leading-snug ${h.done ? 'text-ink/45 line-through' : 'font-medium text-parchment'}`}>{h.t}</span>
                    <span className="hidden shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 font-mono text-[10px] text-ink/50 min-[420px]:block">{h.s}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">Long names wrap — nothing cut off</p>
            </div>
          </div>
        </section>

        <section id="how" className={`${shell} scroll-mt-20 py-14 sm:py-20`}>
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-parchment sm:text-4xl">From vision to today in three steps</h2>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="min-w-0 rounded-xl border hairline bg-surface-solid p-5 sm:p-6">
                <p className="font-mono text-sm font-bold tabular-nums text-gold">{s.n}</p>
                <h3 className="mt-3 font-display text-xl font-bold text-parchment">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{s.b}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className={`${shell} pb-14 sm:pb-20`}>
          <div className="rounded-2xl border border-gold/30 bg-gold/10 px-6 py-10 text-center sm:py-14">
            <h2 className="mx-auto max-w-xl font-display text-2xl font-bold text-parchment sm:text-3xl">Your future self is built one day at a time.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/60">Start tonight. Open today, add one deed and one habit, check in.</p>
            <div className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Link href="/sign-up" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gold px-8 font-semibold text-ink transition hover:bg-gold-dim">Start free<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link href="/sign-in" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gold/40 px-8 font-semibold text-parchment transition hover:border-gold hover:text-gold">Sign in</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t hairline-top">
        <div className={`${shell} flex flex-col items-center justify-between gap-4 py-8 sm:flex-row`}>
          <div className="flex items-center gap-2.5"><Compass alignment={100} ringProgress={100} size={24} /><span className="font-display font-bold text-parchment">Inchstone</span></div>
          <div className="flex items-center gap-6 text-sm text-ink/55">
            <a href="#how" className="transition hover:text-gold">How it works</a>
            <a href="/privacy" className="transition hover:text-gold">Privacy</a>
          </div>
          <p className="font-mono text-[11px] text-ink/40">© {new Date().getFullYear()} Inchstone</p>
        </div>
      </footer>
    </div>
  )
}
