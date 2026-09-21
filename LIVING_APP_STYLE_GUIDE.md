# Inchstone — Living-App Systems Style Guide

> Companion to `DESIGN_PLAN_v2.md` (the live spec — the obsolete v1 plan was
> removed). Documents the shared "living app" systems (time band, season, voice
> bank, work clock) so future contributors extend the same systems instead of
> hardcoding a new one-off string, band or instrument.

## 1. Time of day  (`src/components/effects/atmosphere.tsx`)

Single source of truth for "what time is it", shared by the ambient
background, the loaders, and every voice line.

| Band  | Hours    |
|-------|----------|
| dawn  | 05–07    |
| morning | 07–11  |
| noon  | 11–14    |
| afternoon | 14–17 |
| dusk  | 17–20    |
| night | 20–05    |

The engine is clock-based (no suncalc dependency). Band boundaries are fixed
hours; the ambient *sky gradient* is interpolated continuously so there are no
hard cuts.

**Rule:** never duplicate time logic. Read `useAmbient().timeOfDay` instead of
computing hours yourself.

## 2. Season model (climate-aware) — `src/lib/ambient/season-config.ts`

The season model is NOT hardcoded to a hemisphere — it's a configurable
`SeasonConfig`. The default is the Lagos / Southern Nigeria **wet-dry**
climate:

| Season | Months (0-based) | Notes                              |
|--------|------------------|-------------------------------------|
| wet    | 3–8 (Apr–Sep)     | heavier rain, cooler blue-green tint |
| dry    | 11–1 (Dec–Feb)    | **harmattan** — adds hazey layer     |
| (default) | all other months | dry, no haze                        |

`Season = 'dry' | 'wet'`. Overlays:
- Wet → `ambient-layer` cooler tint + higher rain-drift priority.
- Dry harmattan (`isHazy`) → `ambient-haze` faint warm veil.
- Weather `haze`/`storm` overlay states are also mapped (see below).

**Adding a new climate:** create a different `SeasonConfig` object (e.g.
four-season for temperate regions); no logic changes.

## 3. Weather overlay states — `atmosphere.tsx` `weatherFromCode`

Open-Meteo / WMO codes map to a small fixed set:

| Weather | Codes                       |
|---------|------------------------------|
| clear   | 0–1                         |
| clouds  | 2–3                         |
| haze    | 5–7, 45, 48 (harmattan/dust) |
| rain    | 51–67, 80–82               |
| snow    | 71–77, 85–86               |
| storm   | 95–99 (thunderstorm)        |

Rendering: `.ambient-rain-stripe` (rain), `.ambient-flash` (storm lightning),
`.ambient-haze` (haze), `.ambient-cloud` (clouds). All under `prefers-reduced-motion`
are animation-disabled.

## 4. Voice bank — `src/lib/voice/copy-bank.ts`

The loader lines, empty states, confirmations, toasts, celebrations and
nudges all pull time-aware, no-repeat copy from one bank.

**Key naming convention** (see `VoiceKey` in `src/lib/voice/types.ts`):

- `loading.<domain>` — per route/domain (calendar, day, week, month, quarter,
  year, goal, finance, notes, partners, reports, plans, reviews, settings,
  dashboard, year-quarter, year-quarter-month, year-quarter-month-week).
- `empty.<surface>` — empty states.
- `confirm.<action>` — destructive / cascade confirmations.
- `toast.<event>` — success / info snackbars.
- `celebrate.<moment>` — milestone / perfect-day wins.
- `nudge.<situation>` — partner nudges and streak steering.

**Slot shape:** each key maps to `Partial<Record<TimeOfDay, string[]>> & { any?: string[] }`.
Prefer band-specific lines where tone matters (e.g. `loading.calendar.night`);
fall back to `any` everywhere else.

**Contract:** a single key should never show the exact same line twice in a row
within a session (module-level last-shown map + `sessionStorage`).

**Adding a line:** add to `copy-bank.ts` only. No logic changes needed.

## 5. Accessibility contract (hard requirement)

- `prefers-reduced-motion: reduce` disables all motion: sprite/loader, ambient
  particle animations (stars/rain/cloud/haze/storm), scroll-text reveals, and
  the float/parallax layers — content still renders fully, immediately.
- Never attach `data-parallax` (or reveal-delay) to anything interactive.
- The ambient + voice layers degrade gracefully: if geolocation or weather
  fails / is denied, the app silently falls back to time + season only — no
  error toast, no blocked render.

## 6. The work clock — `src/components/ui/WorkClock.tsx`

The signature instrument (it replaced the v2 compass). Same object on the
screen, live read in the middle:

| Part | Meaning |
|------|---------|
| Ring around the dial | work done in the current period (`progress`, 0–100) |
| Hour hand (gold) | local hour |
| Minute hand (parchment) | local minute (tracks the seconds) |
| Second hand (gold-dim, short tail) | local second — the tick that makes it *live* |
| Chapter ring | 12 hour indices, cardinals a little longer |
| `dayLabel` · `primary` · `ringLabel` | the mono complications the compass carried (day-of-year, the one gold number, the period name) |

- **One component, every size:** 22px chrome mark (topbar / collapsed sidebar),
  40px empty-state glyph, 56px quiet inset, 148/200px dashboard hero. Geometry
  is proportional to `size`; below 44px the dial drops the complications and the
  12-index chapter ring. `showTime` prints the live `HH:mm` beside the face.
- **"Now" comes from `useCountdown`** — never a private `setInterval`. The ticker
  is asked to keep ticking under `prefers-reduced-motion`
  (`{ respectReducedMotion: false }`) because a frozen clock would show a wrong
  time; the global reduced-motion rule flattens the hand-settle transitions
  instead.
- **Hydration:** the hands rest at 12:00 in the server snapshot and settle to the
  real time one paint later (the `useSyncExternalStore` mounted pattern), so SSR
  and the first client paint agree — no mismatch, no render cascade.
- **Every surface uses it:** marketing nav + demo card + footer, dashboard hero,
  topbar, collapsed sidebar, empty states. The favicon (`src/app/icon.svg`)
  mirrors the dial, so it is the only static (non-live) clock in the app.
- Empty states use the work clock at ~40px, `progress={0}`, dimmed — do not
  introduce a second icon/motif language for them.
