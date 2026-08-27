# Inchstone — Living-App Systems Style Guide

> Companion to `DESIGN_PLAN.md` / `DESIGN_PLAN_v2.md`. Documents the shared
> "living app" systems (time band, season, voice bank) so future contributors
> extend the same systems instead of hardcoding a new one-off string or band.

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