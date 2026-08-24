# Inchstone — v2: Sharper Minimalism + Full Responsive Spec

> **Companion to `DESIGN_PLAN.md`.** This is an upgrade pass on the *Page & Button Redesign Plan* — **not a replacement.** Keep that document open alongside this one. Three things change here:
> 1. **Cuts** — a shorter list of surviving patterns, because v1 still has a few "nice to have" elements that dilute the restraint.
> 2. **A real responsive system** — one set of tokens that scale, plus an explicit **touch vs. pointer interaction model**, so "hover to reveal delete" (which doesn't exist on mobile) gets replaced everywhere by one consistent pattern instead of being special-cased per page.
> 3. **Polish details** — the small, easy-to-skip things that separate "clean" from "this feels expensive."

**Read order:** A (cuts) → B (tokens) → C (interaction model) → D (per-screen desktop/mobile deltas) → E (polish) → F (build order changes).

---

## A. Cut further — fewer things, each doing more

v1 already removed the gamified layer. This trims what's left until every element earns its place twice over.

| Cut | Why |
|---|---|
| **5 concentric rings on the dashboard compass** → **1 ring + the needle** | Five rings at once is a data-viz move, not a calm one. Keep only the *current* layer's ring visible around the needle (e.g. today shows the Weekly Win ring); tap the compass to cycle which layer's ring shows. The rings still exist as a concept, but you see one at a time — quieter, and it turns the compass into something you *interact with*, not just read. |
| **Mono caption under the compass** (`Day 034 · 68% aligned`) → **fold into the compass itself** | Put the day number and % as two small mono numerals inside the compass face (like a watch complication) instead of a separate text line underneath. One object, not an object plus a caption. |
| **Card hairlines everywhere** → **hairlines only where two regions actually need separating** | v1 puts a `1px gold-dim` border on nearly every card. Reserve the border for cards that sit directly against other cards (grids, lists). A card alone on a section of empty ink needs only spacing, not a border — the border is currently doing whitespace's job. |
| **Segmented quiet toggles (timeline/table, period selectors, mood, etc.)** → **one shared `<Segmented>` primitive** | v1 describes this pattern ~6 separate times with slightly different wording. Build it once (see D6), use it everywhere. Consistency here is itself a polish signal. |
| **Purse color palette (6 muted tones)** → **purses default to parchment/gold-dim only; color is opt-in** | Most productivity apps over-color categorization. Default every purse to a neutral initial-in-circle; let a user *choose* to tag one purse gold if it's the one they watch closely. Color becomes meaningful again because it's rare. |
| **"Reflect" ghost link + separate Nudge card on dashboard** → **one quiet strip, not two** | Combine into a single dismissible line under the Deeds list: whichever is more relevant today (a pending nudge, or a reflection prompt) — never both at once. One quiet thing, not a stack of quiet things. |
| **Emoji/icon variety across purses, achievements, categories** | Already flagged for removal in v1 — reinforcing: standardize on Lucide line icons only, 1.5px stroke, no filled icon variants. |

## B. Tokens, v2 — fluid instead of fixed

v1's tokens were single desktop values. Make type and spacing fluid so desktop and mobile are the *same* design scaling smoothly, not two designs.

### B1. Type scale (`clamp()`, viewport-fluid)

| Role | Token | Mobile (375px) | Desktop (1440px) | CSS |
|---|---|---|---|---|
| Display (Playfair) | `--text-display` | 40px | 76px | `clamp(2.5rem, 4vw + 1.5rem, 4.75rem)` |
| H1 (Playfair, page titles) | `--text-h1` | 28px | 40px | `clamp(1.75rem, 1.6vw + 1.4rem, 2.5rem)` |
| Heading (Inter 600) | `--text-heading` | 17px | 20px | `clamp(1.0625rem, 0.3vw + 1rem, 1.25rem)` |
| Body (Inter) | `--text-body` | 14px | 15px | `clamp(0.875rem, 0.1vw + 0.85rem, 0.9375rem)` |
| Caption (Inter, labels) | `--text-caption` | 11px | 12px | `clamp(0.6875rem, 0.05vw + 0.68rem, 0.75rem)` |
| Mono (JetBrains Mono, figures) | `--text-mono` | 12px | 13px | `clamp(0.75rem, 0.05vw + 0.74rem, 0.8125rem)` |

**Rule:** *never* hardcode a px font-size in a component — always one of these six variables. This alone prevents the "looks fine on my laptop, cramped on my phone" problem most AI-built UIs have.

### B2. Spacing — 8pt grid, two densities

- **Base unit `--space-1: 8px`.** All padding/gaps are multiples: 4 (half-step, use sparingly), 8, 16, 24, 32, 48, 64.
- **Desktop density:** card padding `24px` (`--space-3`), section gaps `48–64px`.
- **Mobile density:** card padding `16px` (`--space-2`), section gaps `24–32px`. Don't just shrink desktop spacing uniformly — mobile needs *tighter internal* padding but the *same or looser* gaps between distinct tappable rows (finger-sized separation matters more than desktop's visual rhythm).
- **Touch target floor: 44×44px on any `pointer:coarse` device**, even if the visible icon is 20px — pad the hit area, don't grow the icon.

### B3. Breakpoints (use these exact ones, not ad hoc)

| Name | Width | Applies to |
|---|---|---|
| `xs` | 0–479px | Small phones — single column, bottom nav, sheets full-height |
| `sm` | 480–767px | Large phones — same as xs, slightly more breathing room |
| `md` | 768–1023px | Tablets/small laptop — sidebar becomes collapsible icon rail, 2-col grids appear |
| `lg` | 1024–1439px | Desktop — full sidebar, 3–4 col grids |
| `xl` | 1440px+ | Wide desktop — content stays capped (720–900px per page, see v1 §A3), extra width becomes margin, never extra columns of content |

## C. One interaction model, used everywhere (fixes v1's hover-reveal gap)

v1 repeatedly says "reveal on hover" for delete/edit icons (goal rows, day rows, note cards, purses). That pattern **does not exist on touch.** Rather than patching each page separately, define it once:

**`<RowActions>` shared behavior:**
- **Pointer (mouse) devices** (`hover: hover` media query): secondary actions (edit/delete/⋯) are invisible at rest, fade to `gold-dim` opacity on row hover, 120ms.
- **Touch devices** (`hover: none`): secondary actions are **always present** but rendered as a single quiet `⋯` (kebab) at the row's trailing edge, `gold-dim`, 44×44 hit area — tapping opens the same small action menu v1 describes (Edit / Delete, with the specific cascade copy). No hover state to fake, no long-press gesture to teach (long-press is invisible and undiscoverable — never rely on it as the *only* way to reach an action).
- **Swipe-to-delete is explicitly not used.** It's a common mobile pattern but conflicts with the horizontal swipe already used for day/week navigation (D3) and Inchstone's own ledger tables — one gesture meaning two different things in the same app is a real usability cost. The kebab menu is the single, consistent, discoverable path to destructive actions everywhere, on every input type.

## D. Desktop ↔ Mobile deltas, by screen

Only documenting where mobile is a genuine *reflow*, not just "smaller" — those cases follow B1–B3 automatically and don't need separate callouts.

### D1. Global chrome

| | Desktop (`lg`+) | Mobile (`xs`–`sm`) |
|---|---|---|
| Primary nav | Left sidebar, 240px, always visible (collapsible to 72px icon rail at `md`) | Bottom nav, 5 items, fixed; Sidebar does not exist below `md` |
| Compass (ambient) | Small, topbar right cluster | Small, **centered in the topbar** — on mobile it's the one branded constant since there's no sidebar wordmark visible; tapping it opens the full compass as a bottom sheet rather than navigating away |
| Secondary nav (More: Notes/Partners/Reports/Settings) | Just more sidebar rows | Bottom-sheet "More" panel (v1 B3) — but reorder by actual use frequency, not alphabetically: Notes and Partners above Reports/Settings |
| Page title | Topbar, static text | Often redundant with the screen's own H1 below it — **drop the topbar title on mobile** where the page already opens with a clear heading (Dashboard, Year, Finance); keep it only on drill-down pages where the breadcrumb needs the topbar row to have somewhere to sit |

### D2. Landing

| | Desktop | Mobile |
|---|---|---|
| Compass | 160px, generous vertical space above/below | 96px — still first, still animates first, but the sequence (compass → wordmark → subline → CTA) compresses to ~55% of the desktop timing so it doesn't feel sluggish on a device people expect to move fast on |
| Layout | Centered, generous top/bottom margin (~15vh) | Content vertically centered but margin drops to ~8vh; CTA sits within thumb reach (bottom third of viewport), not vertically centered with everything else |

### D3. Dashboard / Compass hero

| | Desktop | Mobile |
|---|---|---|
| Compass hero size | 280px, sits with equal padding either side of the 720px column | 220px, full-bleed-adjacent (16px side margin only) — it should feel like the biggest thing on the screen, not a card floating in a column |
| Today's Deeds list | Standard rows, `<RowActions>` kebab appears on hover only | Rows get slightly taller (min 56px) for thumb accuracy; `<RowActions>` kebab always visible per Section C |
### D4. Hierarchy drill-down (`LayerView`, shared across goal/quarter/month/week)

| | Desktop | Mobile |
|---|---|---|
| Breadcrumb | Full path visible, mono, all segments shown | Path **truncates to parent + current** (`… / Q1 / Jan`) with the full path available by tapping the leading `…`; a full breadcrumb on a 375px screen wraps and undermines its own calm-and-precise purpose |
| Child layer cards | Grid, 3–4 up depending on layer | Single column, full-width rows instead of cards below `md` — a grid of small cards on mobile forces tiny touch targets; a full-width row list keeps every target ≥44px tall without shrinking text |
| Weight slider | Inline horizontal, label + mono value to the right | Same control, but value sits **above** the slider on its own line rather than beside it — prevents the classic "label wraps and the slider becomes 40px wide" mobile bug |
| Staggered reveal | 60–80ms stagger across all visible children | Cap total stagger at **200ms regardless of child count** (stagger interval shrinks as list grows) — on mobile lists are often longer (single column), so a fixed per-item delay would make a 10-item list take visibly longer to finish than desktop's 4-item grid |

### D5. Day (ledger/timeline)

| | Desktop | Mobile |
|---|---|---|
| Day navigation | `‹ prev / next ›` chevrons beside the date | Chevrons **plus horizontal swipe** on the timeline body itself (left/right = prev/next day) — this is the one swipe gesture in the app (see Section C: it doesn't conflict with anything else because delete never uses swipe) |
| Timeline vs Table toggle | Both available, timeline default | **Timeline only** below `md` — a dense mono table with 4+ columns doesn't work under ~375px without horizontal scroll, which fights the swipe-to-navigate gesture above. Move Table view to a "View as table" link that opens a full-width modal if truly needed, but default and encourage timeline. |
| Hour ruler | Full 24h visible, generous row height | Scrollable, auto-scrolled to the first deed of the day on open (don't make someone scroll past 6 empty morning hours to see their first task) |
| Habit tracker graph | Inline Recharts, full width of column | Same, but default range collapses to `week` (not the desktop default range) and the range selector becomes a horizontally scrollable chip row rather than wrapping to two lines |

### D6. Finance / Transactions

| | Desktop | Mobile |
|---|---|---|
| Ledger summary row | Income / Expenses / Net / Offerings as 4 inline mono figures | Stack as a **2×2 grid**, not a horizontal scroll and not a vertical list of 4 — 2×2 keeps Net (gold) visually paired near Income at a glance without needing 4 full-width rows |
| Transactions table | Full table, all columns | Collapse to a **2-line row card**: line 1 = category (parchment) + mono amount (right-aligned, moss/ember-tinted text), line 2 = mono date + purse name, small. This is still "the ledger," just reflowed — never horizontal-scroll a data table on mobile, it's always a bad experience |
| Filter bar | Inline row of selects | Collapses into a single "Filters" secondary button that opens a bottom sheet with the same fields stacked — keep an active-filter-count badge (mono number) on the button so it's clear filters are applied even when the sheet is closed |

### D7. Shared: modals/sheets

| | Desktop | Mobile |
|---|---|---|
| Dialog | Centered, max-width 480–720px per v1 D3 | **Always a bottom sheet**, not a centered modal — full width, rounded top corners only (12px), drag-handle affordance at top (visual only, tap-to-dismiss + explicit Cancel/× both still present — don't rely on drag-to-dismiss as the only close method) |
| Forms inside | Standard field stacking | Numeric/date/time fields use **native mobile pickers** (`<input type="date">` etc.) rather than custom dropdowns — fighting the OS picker on mobile is a common and avoidable source of janky UX |

---

## E. Polish — the details that make it feel expensive, not just clean

- **Tabular numerals everywhere mono is used**: `font-variant-numeric: tabular-nums`. Every ledger figure, streak count, and countdown should hold its column width as digits change — this single CSS property is disproportionately responsible for a "precise instrument" feeling versus a "text that happens to be numbers" feeling.
- **Cursor discipline**: `cursor: pointer` only on genuinely clickable things; disabled controls get `cursor: not-allowed` *and* the 25%-opacity treatment together, never one without the other.
- **Loading states are typographic, not spinners**, per v1 — extend this: skeleton states (while data loads) are **hairline-outlined blocks in `gold-dim @8%`**, matching the shape of the content that's about to appear, not generic gray shimmer bars. It's a small thing that keeps the loading state from looking like it was bolted on from a different design system.
- **Sound-off haptics on mobile**: a single light haptic tick (`navigator.vibrate(10)` or the Capacitor/PWA equivalent if wrapped) on deed-complete and habit-check only — nowhere else. Overusing haptics cheapens the one moment it should mark: a completed action, the app's core loop.
- **Numbers that count up, not jump**: any figure that changes on load (net worth, alignment %, streak) animates from 0 (or previous value) to the new value over ~500ms using the settle spring, mono, tabular-nums holding the layout steady. This is the one "delight" moment worth keeping from typical productivity-app polish — it reads as precision, not decoration, because it's mono and quiet, not a gold gradient counter.
- **Empty states get a one-line compass-motif glyph**, not a stock illustration — a small, quiet line-drawn compass rose at 40% opacity above the empty-state copy, echoing the signature element instead of introducing a fourth visual language (icon set / illustration set / photo) into an otherwise typographic app.
- **Dark is the only theme, full stop.** v1 kept a light/dark switch in Settings "for completeness." Cut it — a light `parchment`-background version of this identity is a second, harder design problem (does gold still read as precious on cream? does the compass still feel calm?) that doesn't serve the brief. One canonical theme, no toggle, no settings row for it. If light mode is truly required later, treat it as its own design pass, not a checkbox.

---

## F. Build-order changes from v1 Section H

Insert two items into the existing phase plan:

- **Between Phase 0 and Phase 1:** build the fluid type/spacing tokens (B1–B2) and the `<Segmented>` and `<RowActions>` primitives (A, C) *before* re-skinning any page — every later phase consumes these, so building pages first and retrofitting these primitives in later means re-touching every screen twice.
- **End of Phase 1:** verify the sidebar↔bottom-nav breakpoint swap and the compass's mobile bottom-sheet behavior (D1, D3) before moving to Phase 2 — chrome is the one piece every subsequent phase depends on being responsive-correct.





