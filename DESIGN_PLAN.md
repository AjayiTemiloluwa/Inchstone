# Inchstone — Page & Button Redesign Plan

**Document purpose.** This is the working plan for redesigning the Inchstone app against the *Minimalist UI Redesign Brief*. It walks the entire app — every route, every page, every button, every state — and prescribes exactly how each element should look, behave, and move in the disciplined near-black-and-gold identity. It is deliberately exhaustive: a developer (or an AI agent) can implement screen-by-screen without making judgment calls about styling.

**How to read it.**
- **Section A** — design foundation (tokens, type, shape, motion).
- **Section B** — global chrome (sidebar, topbar, bottom nav) shared by all dashboard pages.
- **Section C** — page-by-page / button-by-button spec. Each page has *Goal*, *Layout*, and detail for every interactive element: label, type, color role, typography, radius, hover/active, focus, motion, and empty/error/disabled/reduced-motion states.
- **Section D** — shared patterns (cards, tables, modals, forms, toasts, confirms, empty & error copy).
- **Section E** — component migration map (today → tomorrow).
- **Section F** — motion rules & the compass instrument.
- **Section G** — accessibility & quality floor.
- **Section H** — phased implementation order.

---

## A. Design Foundation

### A1. Color tokens (the ONLY six — never invent a seventh)

| Token | Hex | Role | Usage guardrail |
|---|---|---|---|
| `--ink` | `#0A0908` | Warm near-black background | App canvas, dark surfaces, non-card fills |
| `--parchment` | `#F3EFE6` | Primary text on dark; light surfaces | Body/nav copy, modal + card light surfaces |
| `--gold` | `#B8935A` | THE single accent (muted brass) | Compass mark, active states, the one important number per screen, thin underline under active hierarchy layer |
| `--gold-dim` | `#8A6D42` | Gold at rest / secondary | Inactive tabs, subtle icons, card hairlines (at 20%) |
| `--ember` | `#7A3B2E` | Deep brick | Warnings / overdue / destructive only |
| `--moss` | `#4A5D45` | Muted green | Completed / rollup-achieved states |

Global rules:
- **One gold per screen.** Two golds = neither reads as important. The *single most important number* gets gold; everything else is parchment or gold-dim.
- **Parchment, not gold, for small text** (gold fails small-text contrast on ink). Gold only as large/display figures (≥ ~18px bold) or fills/borders on UI elements.
- **No decorative gold**: no gold badges, pill chips, or gold icon fills on every card. Gold is earned by meaning.
- Cards: `1px solid gold-dim @ 20%` hairline on ink. **No drop shadows, no gradients.** (Strip `box-shadow`, `linear-gradient`, `glass`, `glow-sm`, `gamified-bg`/orb utilities — inventory in Section E.)
- Dark mode is the **singular canonical theme.** Retire `--bg/--fg`, `surface`, `mist`, `sage`, `coral`, `glass-*`, `paper` in favor of the six tokens; `ink` = background, `parchment` = text.

### A2. Typography (3 roles — enforce, don't expand)

- **Playfair Display** — *only*: app wordmark, page-level H1s, and the **Why statement** (the one sentence that reads as "written," ~720px line-width, like a letter). Never buttons, labels, nav, or figures.
- **Inter** — everything else: body, nav, buttons, labels, forms. Replace `Geist`/`Lora` in `src/app/layout.tsx` with Playfair Display + Inter (+ JetBrains Mono below).
- **JetBrains Mono** — every figure: currency, dates, streak counts, progress %, timestamps, "Day 34 of 365", breadcrumb paths. All numbers everywhere sit in mono.

### A3. Shape, spacing, surfaces

- Radius: **6–8px**, consistent (`rounded-md`/`rounded`). Remove `rounded-2xl/3xl` cards and `rounded-full` pill buttons (true circle only for compass + avatar).
- Cards: hairline 1px `gold-dim @ 20%` on `ink`, radius 8px, no shadow, generous padding.
- Single-column on mobile; max ~720px content for text-heavy pages (the Why page reads like a letter); wider grids only for hierarchy/dashboard, with generous whitespace.

### A4. Motion principle — "compounding / settling"

Every animation expresses *small actions accumulating* or *a needle settling on true north*. No bouncy/playful, no cards popping in, no slide-from-the-right template motion. Two sanctioned families:
1. **Settle** — a spring where a value *resolves* into place (`type:"spring", stiffness:120, damping:14` class). Used for the compass needle, number counters, anything that "lands" on a final value.
2. **Compound/reveal** — staggered reveal of hierarchy layers at **60–80ms stagger** when a goal tree expands or a page's layers fade in — reads as *layers stacking*, not confetti.

- **`prefers-reduced-motion`** honored everywhere: springs → instant, staggers → single opacity-only fade, no continuous animation.
- Add **`motion` (motion.dev)** as the animation runtime (currently not a dependency). Recharts handles habit/trend charts; dnd-kit handles drag; Tiptap stays for rich notes; shadcn/ui stays as the invisible base primitive.

### A5. The compass instrument (signature element)

Replace the generic `ProgressRing`, "stats grid", and separate progress bars as the app's primary orientation device:
- At rest it sits in the **topbar corner**: a small compass rose (`gold`/`gold-dim`), needle orientation = **alignment** of today's Deeds to the active Quarterly Quest (% of today's deeds tagged to an active Quest).
- On the **dashboard** it expands into the hero: **5 concentric rings** — outer = Why, innermost = Daily Deeds — a completed rollup at a layer **lights that ring in gold** (rolls up to gold-dim at rest). The needle's spring-settle expresses "today is, or isn't, aligned with the Why."
- Everywhere else it displaces redundant progress widgets: a card's single most important % shows as a small compass-needle-in-a-ring (see Section E).

## B. Global Chrome

### B1. Sidebar (desktop ≥ `lg` — `src/components/ui/Sidebar.tsx`)

**Current:** glass-strong panel, collapsible, `text-ink/50` links, active = `glass-gold text-gold glow-sm`, gold left-bar, icon hover scale, footer version text.

**Redesigned:**
- **Surface:** `ink` panel, `1px` `gold-dim @ 20%` right hairline. No glass, no glow. Width 240px (collapsed 72px). Remove the on-canvas collapse chevron toggle → collapse becomes a Settings preference (or keep a quiet control restyled as a plain gold-dim icon button).
- **Wordmark:** "Inchstone" in **Playfair Display** 18px, parchment (never gradient text — remove the gold-gradient clip).
- **Nav links** (Dashboard, Finance, Calendar, Year View, Partners, Notes, Reports, Settings):
  - Inter 14px / 500; inactive `parchment/55%`.
  - **Active:** parchment text; the *compass needle icon* in gold; and a single **`2px` gold underline** under the current section — not a left bar, not a gold pill, not a glow. Inactive icons `gold-dim`.
  - Hover: text → parchment/85%; no icon scale-bounce (swap `group-hover:scale-110` for a color shift).
  - Focus: visible `2px gold` outline ring (Section G).
- **Footer:** remove the "v1.0 · Built with purpose" pill styling → plain `11px` mono `parchment/35%` string, or drop.

### B2. Topbar (all dashboard pages — `src/components/ui/Topbar.tsx`)

**Current:** glass-strong bar, mobile hamburger, auto page title, push manager, Clerk user button with gold ring.

**Redesigned:**
- **Surface:** `ink`, `1px` `gold-dim @20%` bottom hairline, height 56px. Left = mobile hamburger (icon `gold-dim`, active → `parchment`, 40×40 hit area, radius 6px).
- **Page title (left/center):** Inter 14px / 600, `parchment/80%`. On hierarchy drill-downs this becomes the **mono breadcrumb** (B4).
- **Right cluster:** small **compass instrument** (gold-dim/gold) → hairline divider → Clerk `UserButton` (avatar circle, `1px gold-dim` ring; drop the soft gold glow ring).
- **Notifications:** keep a quiet `gold-dim` bell icon, mono count badge only when unread nudges exist; badge = `ember` dot (warning), never gold. (Full manager lives on Settings.)

### B3. Bottom nav (mobile — `src/components/ui/BottomNav.tsx`)

**Current:** fixed glass bar + gold gradient hairline; Home/Finance/Calendar/Year/More; active gold dot+underline; scale press animations; More sheet.

**Redesigned:**
- **Surface:** `ink`, `1px` `gold-dim @20%` top hairline; remove gradient hairline + glow.
- **Items** (Home, Finance, Calendar, Year, More): Inter 10–11px / 600; inactive `parchment/45%`; **active** = compass needle glyph in gold + small gold dot (drop animated ping/underline scale). Press feedback = opacity only (no icon scale-90/105).
- **"More" sheet** (Notes, Partners, Reports, Settings): bottom sheet on `ink`, radius 12px top corners only, `1px gold-dim` hairline; rows `parchment` text + `gold-dim` icons; active row = parchment text + gold needle glyph (no gold pill/filled tile). Badges `coral` → `ember`, only for real counts (never decorative 0s).

### B4. Hierarchy breadcrumb (all drill-down pages)

Shared mono breadcrumb on hierarchy pages — **JetBrains Mono 11–12px, `parchment/60%`**, `/` separators in `gold-dim/50`:
`Why / <Category> / <Yearly> / Q1 / Jan / Week 3 / Thu`
- Leaf (current) segment = `parchment` + thin gold underline.
- **Dimming rule (§5, Hierarchy view):** only the active layer is full opacity; ancestors `parchment/45%`; future layers collapsed to a mono "…".
## C. Page-by-Page & Button-by-Button Spec

> **Button anatomy shared app-wide (read once):**
> - **Primary action** = `parchment` text on `gold` fill, radius 8px, Inter 14–15px / 600; hover = `gold` → `#cbaa6f` (slightly lighter brass), no shadow; active = no scale bounce (subtle opacity). Disabled = `gold-dim/40` fill, `parchment/40%`. Focus `2px gold` ring offset 2px.
> - **Secondary action** = `1px gold-dim` hairline, transparent fill, `parchment` text; hover = hairline → `gold`, text → parchment/90%; no shadow.
> - **Quiet/ghost** = no border, Icon-only buttons: `gold-dim` icon, 40×40 hit area, hover `parchment/70%`, radius 6px.
> - **Danger** = `1px ember/50` hairline or `ember/12` fill, `ember`-tinted text (use `#b96a4f`-ish readable ember, pass AA); hover slightly lighter; *only* for destructive/overdue.
> - **Numeric figures** are always JetBrains Mono. Headline/labels never gold unless it's the single important number.
> - Motion: primary confirms / needle settles / layer reveals per Section A4; all reduced-motion → instant.
> - Every icon-button gets `aria-label`; every row/button has a visible keyboard focus ring.

---

### C1. Landing (`/` — `src/app/page.tsx`)

**Goal:** spare, statement-grade. Compass finds north, then the wordmark + one line + one CTA.

**Layout (single column, centered, ~720px):**
1. **Compass instrument** (~120px) animates in first — needle spring-settles to north (`gold`), rings `gold-dim`. This is the *only* thing animating on load. Reduced-motion → static compass, no needle sweep.
2. **Wordmark** "Inchstone" — Playfair Display 72px+ desktop / 44px mobile, parchment.
3. **Subline** — Inter 18–20px, `parchment/70%`: *"Small, consistent actions compound into significant transformation. Your daily deeds should flow from your yearly vision."*
4. **One CTA.**

| Button | Type | Spec |
|---|---|---|
| **Start Your Journey** | Primary (gold) | See shared anatomy. Radius 8px, px-8 py-4. Never gradient ("from-gold to-…" removed) and no `shadow-lg`. On click → `/sign-up`. Reduced-motion: instant. |

Sequence: compass (spring) → head/fade 120ms → subline 240ms → CTA 360ms. All opacity/fade; no slide-ins. Only the needle uses the spring.

---

### C2. Sign in / Sign up (`src/app/sign-in`, `src/app/sign-up`)

**Goal:** quiet, on-ink, Clerk primitives restyled into the token set (Clerk appearance `variables`/`elements` remapped).

**Layout:** centered card (radius 8px, `ink` card on `ink` bg with `gold-dim@20%` hairline, or `parchment`-surface variant only if product insists on a light "letter" card — default stays dark); Playfair wordmark above.

**Buttons:** map Clerk's primary button to the Primary anatomy; its text/links to `parchment`/`gold-dim`; inputs to Section D form fields; error text in readable `ember`. Add a quiet "Back" ghost link to `/`.

---

### C3. Dashboard (`/(dashboard)/dashboard/page.tsx`) — the hero

**Goal:** the compass-with-rings as hero, then today's Deeds as a short list. Remove the gamified backdrop (orbs/grid), the stat-card grid, the level badge, XP/flame decorations, and the achievements strip — they fight the restraint and duplicate the compass.

**Layout (max ~720px column, generous whitespace):**

1. **Compass hero (new)** — expanded 5-ring compass (Why → Daily Deeds). At rest the needle points to today's Why-alignment; completed rollups light their ring gold. No separate % for every layer shown at once — the ring state carries it. Below it one line in mono: `Day 034 · 68% aligned` (`parchment/60%`, the gold number is the alignment % — the *one* gold figure).
2. **Today's Deeds** — short list (max ~6 visible). Each row: a **checkbox** (see Deed row, C9) with the gold-fill settle animation, Inter `parchment` title, mono time/weight right-aligned. Completed row = title struck through in `parchment/45%`, ring/check `moss`.
3. **"View all" (Year)** — ghost link, gold-dim arrow, links `/year`. (One link is enough; the four quick-action buttons Goals/Finance/Partners/Analysis are redundant with the nav — remove.)
4. **Optional quiet row** — the most recent **Nudge** from a partner (one card, see C12/Section D), and a single "Reflect" ghost opening Reviews. *Do not rebuild the stat grid or achievements.*

**Every button on Dashboard (post-redesign):**
| Button | Type | Spec |
|---|---|---|
| Compass (hero) | Ghost/full-click | Opens the Year/hierarchy view on tap/click. Hover: hairline `gold` ring. Reduced-motion: no needle sweep. |
| Deed checkbox | Toggle | 24px square, radius 6px, `gold-dim` hairline; on check → fill `gold` with a 200ms settle, no bounce. Completed = `moss` check on `ink`. Reduced-motion: instant fill. |
| View all (Year) | Ghost | `parchment/70%` text + gold-dim arrow; hover text → parchment. |
| Open Nudge card | Ghost | See C12. |
| Reflect → Reviews | Ghost | parchment/70% + gold-dim icon. |

> **Remove:** `Begin Your Quest`/`🎮` seeding button (replace with an explicit empty-state "Build your Why" CTA, C3a), gamified orb/grid bg, XP/level header, streak flame, stat cards, achievements rows, quick-action buttons — all redundant under the compass model.

### C4. Year View (`/year` — the Why + Categories + Quarters + Habits page)

**Goal (brief §5, Hierarchy view):** the Why is the letter; the year is its table of contents. Drill-down, not a flat tree. Only the active layer full opacity; layers above dimmed context; **breadcrumb** replaces the flat header.

**Layout (single column, ~720px body):**
1. **Breadcrumb** (B4): `Why / 2026` — leaf `2026` with gold underline.
2. **The Why — card that reads like a letter.** Playfair Display title 36–44px, `parchment`; a supporting prompt line in Inter, `parchment/60%`. The Why's own **edit affordance** (quiet pencil ghost) opens an inline Playfair editor — never a form-looking field.
3. **Categories row** (Sections/areas): one row of quiet cards (radius 8, hairline), `gold-dim` icon, Inter 14px, hover hairline→gold. Each card is the **drill target** into `goal/[id]` fallbacks or the year-category grouping — one click goes *into* that category's Yearly goals.
4. **Quarters** — a 4-up grid (2-up mobile). Each is a **drill card** → `/year/Q1` etc.: Playfair-free label (Inter 600 caps), mono date range, small compass-ring %, hairline card. Locked/future quarter state = `parchment/30%` content (not `opacity-50 + not-allowed` chrome).
5. **Habits** (moved below Quarters; still on this page per current IA): compact rows — mono title, mono `<done>/<total>` right-aligned, thin hairline progress bar (`moss` at ≥80%, `gold` 40–79%, `ember` <40% — three states is the allowance for status color).

**Every button on Year View:**
| Button | Type | Spec |
|---|---|---|
| Why — pencil | Ghost | `gold-dim` pencil 32px, hover parchment. Opens inline Playfair editor; auto-save w/ subtle mono "saved" note. A quiet action for the most valuable object on the page. |
| Add Yearly Goal / Category (+ ) | Secondary | Hairline `gold-dim`; label in Inter 13px `parchment`; opens inline single-line input (not a modal). Confirm = Enter, escape = cancel. |
| Category card | Drill | Hover: hairline→gold, title→parchment. Keyboard enter opens. |
| Weight lock/unlock (per yearly goal) | Icon toggle | `Lock`/`Unlock` in gold-dim; locked = `gold` (state), unlocked = gold-dim. No bounce. |
| Score mode (auto/manual) | Segmented inline | Two quiet text labels `auto`/`manual` (mono caps?), active = `parchment` + gold underline (no pill). |
| Delete goal | Danger icon | `ember` trash 32px, revealed on hover; confirm via Section D dialog — copy names what will be deleted ("also deletes its quarters, months, weeks, and days"), not "Are you sure?". |
| Quarter card | Drill | As above; future quarters show `parchment/30%` and cursor "not allowed" only if the product rules them locked — otherwise allow journey-planning. |
| Add Habit | Secondary | Above the habits list; opens inline input + mono frequency select. Enter confirms. |
| Habit delete ⋯ menu | Quiet | Opens a small menu: **Delete future instances only** / **Delete completely (incl. past)** / **Cancel**. Danger label in `ember`, no red-500 generic. |
| Download / import | Ghost | Gold-dim icon buttons; keep but quiet; `Database` (seed) hidden behind Settings (see C16) — it's a power tool, not a page button. |

### C5. Hierarchy drill-down pattern — `goal/[id]`, `quarter/[id]`, `month/[id]`, `week/[id]`, `year/[quarter|month|week]`

**Goal (brief §5):** a drill-down with a mono breadcrumb, active layer at full opacity, ancestors dimmed. Same bones at every layer — so build **one shared `<LayerView layer={…}>` component** and re-skin; don't hand-edit four near-identical pages. Each layer page shows:

1. **Breadcrumb** (B4) — leaf = current layer, gold-underlined.
2. **Layer heading** — Playfair H1 (title) only for the Why/Year; for a *goal* the heading is the goal's name, Inter 600 ~20px, `parchment` (Playfair reserved for page H1s and the Why). Mono subtitle shows the layer's role + date window.
3. **Single alignment figure** — small compass-instrument + its one gold number (e.g. Quarter = `62%`), `gold` = *the one important number*; supporting mono labels `parchment/55%`.
4. **Children layer cards** — drill targets into the next layer down. Hairline card, mono weight, small compass-ring. **Staggered reveal 60–80ms** when the set expands.
5. **Reflection card** — always present for that layer: textarea (auto-save, mono "auto-saves" note). Reading-as-letter spacing. This replaces the floating "reflection popup" modals.
6. **Rows show the dimming rule:** ancestor segments `parchment/45%`; completed child = `moss` ring/title; overdue = `ember` date; rest = `parchment`.

**Buttons common to every layer:**
| Button | Type | Spec |
|---|---|---|
| Add child (+ Cascading) | Secondary inline | Opens single-line inline input; Enter confirms, Esc cancels; auto-assigns sensible default weight; no modal. |
| Child card | Drill | hairline→gold on hover; enter opens next layer. |
| Weight slider | Range (native, styled) | Thin 2–3px track `gold-dim/30`, thumb = 16px `gold` circle, radius none needed. Mono live value on the right. Reduced-motion: no thumb spring. |
| Lock / Unlock | Icon toggle | gold-dim ↔ gold (state). |
| Score mode auto/manual | Quiet segmented | `auto`/`manual` mono; active = parchment + gold underline. |
| Score slider (manual) | Range | Same styling; only in manual mode. |
| Delete | Danger icon | Revealed on hover; Section D confirm with specific copy about cascading deletes. |
| Reflection textarea | Form | Section D field; parchment text, hairline focus. |

**Layer-specific notes:**
- **goal/[id]** (a Yearly goal): children = Quarters (3–4). Heading = yearly goal title. Breadcrumb `Why / <Category> / <Goal>`.
- **quarter/[id]** (label routes `/year/Q1`): children = Months (3). Heading = e.g. "Q1 — Jan–Mar" (Inter 600 caps, mono window). Also renders the three month cards grouped.
- **month/[id]** (`/year/Q1/Jan`): children = Weeks. **Auto-creation** of weeks is fine, but do it on first open with a mono toast ("Created 4 weeks"), not silently.
- **week/[id]** (`/year/Q1/Jan/Week 3`): children = Day cards (7). Each Day card → `/day/<date>`. Breadcrumb ends at the day name.
### C6. Day (`/day/[date]`) — the Daily Deeds screen

**Goal:** the day is where compounding actually happens. It should feel like a *ledger + timeline*, precise and calm. This is also where the check interaction "feels weighty" (brief §5).

**Layout (single ~720px column):**
1. **Breadcrumb** ends at the day: `Why / <Cat> / <Goal> / Q1 / Jan / W3 / Thu` (leaf gold-underlined).
2. **Day header:** date displayed as Playfair H1 *only* volume could justify, but keep restraint — **Inter 600 ~20px for the weekday, mono for `Mar 12, 2026 · Day 071`** (`parchment/60%`), right-aligned single gold figure = **day alignment %** (compass-needle-in-ring, small).
3. **Day navigation:** quiet **‹ prev / next ›** gold-dim chevrons flanking an unlabeled date; tap chevrons moves a day; the date itself opens a mini month jumper (C7).
4. **Deeds timeline** (default) or **table** — quiet toggle, `timeline` / `table`, active = parchment + gold underline (no pill). Default `timeline`.
   - **Timeline:** time ruler in **mono** hour ticks `parchment/30%`; deeds as glass-free rows on hairline grid. A deed row = **checkbox** (24px, radius 6, gold-dim hairline → gold fill settle on complete), Inter title, mono time `HH:mm–HH:mm`, right-aligned mono weight. Completed = struck-through `parchment/45%` + `moss` check. Overdue (past & incomplete) = `ember` time.
   - **Table:** the same rows in a hairline table — columns: check, deed, time (mono), weight (mono right), edit, delete.
   - **Click empty hour** (timeline only): opens the inline "Add deed at HH:00" row — same inline pattern; no floating form.
5. **Frog / hardest task** — one quiet emphasized row (gold name? No — the frog's *single importance* may borrow gold only for its row check; label stays parchment). Drop the `bg-gold`-heavy treatment.
6. **Habit Tracker** — compact card, hairline gold at rest (habit = recurring deeds): **add habit** inline input + mono frequency `<select>` (daily/weekly/weekdays/biweekly/monthly/yearly), **Add** secondary. Per-habit row: small checkbox (moss when done today), mono streak `<n>d`, quiet **⋯ menu** (Delete future / Delete all). **Graph block:** Recharts line, mono axes, quiet range buttons `week|month|quarter|year|all|custom` (active = gold underline, rest `gold-dim`), `custom` reveals a date-range picker (Section D field). Drop `bg-gold/10 glow` header and the giant watermark icon.
7. **Day notes** — "Add note" secondary → RichNoteModal (Tiptap). Note chips list with mono date + gold-dim link "open".

**Every button on Day:**
| Button | Type | Spec |
|---|---|---|
| ‹ prev / next › | Quiet | gold-dim chevron 40×40; hover parchment. No slide transition (fade/push per A4). |
| Date (jump month) | Ghost | Opens mini month grid popover (see C7); mono date text. |
| timeline / table | Quiet segmented | active = parchment + gold underline. |
| Deed checkbox | Toggle | 24px, gold-dim hairline → gold fill (200ms settle, no bounce); completed → `moss`. Reduced-motion: instant. |
| Add Deed (empty hour / +) | Secondary | Inline single-line + time inputs; Enter saves, Esc cancels. Confirm → mono toast "Deed added · 10%". |
| Edit deed | Ghost | gold-dim pencil; opens a compact editor (title, start/end, weight, category, recurrence, frog flag, note) — as a **sheet/dialog** (Section D), not a complex multi-panel modal. |
| Delete deed | Danger icon | ember trash; Section D confirm with cascade copy. |
| Frog toggle | Icon | `Star`-type icon gold-dim ↔ gold when active. |
| Set recurrence | Checkbox + select | Section D form; label parchment. |
| Add habit | Secondary | Inline; Enter confirm. |
| Habit repeat select | Select | Section D field; mono options. |
| Habit check | Toggle | moss on complete; quiet. |
| Habit ⋯ menu | Quiet | future-only / all / cancel (ember danger). |
| Graph range | Quiet segmented | gold underline active; `custom` toggles picker. |
| Add note | Secondary | Opens RichNoteModal. |
| Open note | Ghost | gold-dim link. |

### C7. Calendar (`/calendar`)

**Goal:** a precise monthly ledger of Deeds + Google events. The deed chips use the three status colors; nothing animated for its own sake.

**Layout:** breadcrumb-less; **month header** with **‹ / ›** gold-dim chevrons, **month name** Playfair `parchment` (calendar month as a page H1 is acceptable) and **Today** ghost button (`parchment/70%`, gold underline when relevant). Below: a 7-column grid with mono day numbers; each cell holds up to 3 deed **chips** + a `+n` mono overflow note; a hairline cell progress bar using the 3-state rule (moss/gold/ember). **Day cells are the drill target** → opens the DayPanel (C6 behavior) or navigates to `/day/<date>`.

**Buttons:**
| Button | Type | Spec |
|---|---|---|
| ‹ / › | Quiet | gold-dim chevrons, 40×40, hover parchment; fade, no slide. |
| Today | Ghost | parchment/70%; resets month; gold underline if today is in view. |
| Month name | — | Playfair, non-interactive (or ghost to jump to current). |
| Day cell | Drill | Hover hairline→gold; completed days `moss` number; overdue `ember`; keyboard enter opens. |
| Deed chip | Ghost | Mono text; completed = struck `parchment/45%` + moss check; hover reveals edit. |
| Pull-to-refresh (mobile) | Gesture | Keep, but show as a quiet mono "Refreshing…" line, not a spinner glow. |

Remove the gamified/glow styling; the day grid is a ledger. Google events render as non-checkable `gold-dim` timeline chips distinguishable from Deeds.

---

### C8. Finance (`/finance`) — the ledger

**Goal (brief §5, Finance module):** every figure **JetBrains Mono, right-aligned, ledger-precise.** NGN/USD is a **quiet inline switch**, not a segmented control war. Tithe/Offerings tracked as its own section. Restrain to one gold figure: the month's **net position** (the single most important number).

**Layout (max ~900px; figures all mono right-aligned):**
1. **Header:** "Finance" Playfair H1; **currency switch** `NGN`/`USD` as a quiet mono toggle (active = gold underline; both options `parchment`).
2. **Ledger summary row:** Income (parchment), Expenses (parchment), **Net (gold — one gold figure)**, plus Offerings/Tithe (parchment) — each a mono figure with a `parchment/45%` mono caption. No cards-with-icons, no colored big numbers.
3. **Section budgets** (Need / Want / Offerings / Savings): hairline cards. Each shows section name (Inter), mono budget vs spent right-aligned, and a thin hairline bar (over-budget → `ember`). Editing budget = inline mono input or small dialog (Section D).
4. **Purses** (wallets): hairline grid → **Add purse** secondary; each purse card → open it (link to a purse-filtered Transactions view), **⋯ menu** (Edit / Delete). Purse color chips replaced by a **6-color muted palette** aligned to the six tokens + muted neutrals (kill the 16 bright hex swatches).
5. **Transfer** (+ between purses) — secondary → sheet/dialog: from-select, to-select, mono amount.
6. **Savings target** — inline mono edit on the Savings card (quiet pencil), not a separate control.
7. **Recent transactions** — mono table excerpt with a **View all →** ghost to `/transactions`; row delete (danger icon + dialog).

**Buttons:**
| Button | Type | Spec |
|---|---|---|
| NGN / USD | Quiet switch | Mono; active = gold underline; not a segmented fill. |
| Add transaction | Primary | Opens TransactionForm sheet (Section D). category/amount/type/purse; amount field mono. |
| Add purse | Secondary | Inline or dialog; name + icon + muted color. |
| Transfer | Secondary | Opens transfer sheet. |
| Edit budget / target | Ghost pencil | Inline mono input; Enter saves. |
| Purse ⋯ | Quiet | Edit / Delete (ember dialog with cascade copy). |
| Delete entry | Danger icon | Confirm dialog; mono amount in copy. |
| View all | Ghost | → `/transactions`. |

> **Remove:** the emoji purse icons (👜🏦…) → `gold-dim`/`parchment` line icons or initials; bright color chips → muted palette; the `#D4AF37`-style bright gold accents; everything that reads "👛 emoji UI".

---

### C9. Transactions (`/transactions` — full ledger + analysis)

**Goal:** analysis module. Same ledger discipline; keep filters/pagination but restyle.

**Layout:** header "Transactions" Playfair H1; **analysis strip** (income/expense/net + category & purse breakdown) as mono figures, only **net** gold. Below: **filter bar** (purse select, category select, type select, date-from/to, Sort) — Section D form fields, quiet; a **table** (mono amounts right-aligned, `moss` income / `ember`-tinted expense *text*, not colored chips), and **pagination** (« Prev · Page X of Y · Next ») with quiet ghost buttons; disabled state = `parchment/25%`.

**Buttons:**
| Button | Type | Spec |
|---|---|---|
| Filter fields | Form | Section D; mono for numbers/dates; clearable × gold-dim. |
| Sort | Ghost | Cycles date/amount/category × asc/desc; shows a mono caret. |
| Prev / Next | Quiet | `parchment/70%`; `parchment/25%` disabled; no spin. |
| Row delete | Danger icon | Dialog confirm. |
| Purse/category chips in rows | — | Replace bright `bg-{color}20` pills with `parchment/45%` text badges (no colored pills). |

### C10. Partners (`/partners`) — Productivity Partner

**Goal:** accountability, toned down (brief §4 — the one kokonutui-adapted glass card is used *here only*, softened to the palette). Two surfaces: **Partner list** and a selected partner's **message thread** + the incoming **nudges** tray.

**Layout:**
- Header "Partners" Playfair H1 + **Add Partner** primary.
- **Incoming nudges** — a single quiet card (the *one* soft glass card allowed, `gold-dim @10%` glass on ink, no vivid gradient): "You've been nudged" + partner name + message, **Reply** ghost → opens the partner thread, **Dismiss** ghost.
- **Partner list** — hairline cards: initial avatar (moss/ink circle, not colored gradient), name (Inter), email (mono, `parchment/55%`), role (gold-dim), linked-count (mono), **Message** secondary, **⋯** menu (Edit role / Remove — remote menu with ember danger).
- **Message thread:** back-ghost, header = partner name, message bubbles (mine = `parchment/90` on `ink` hairline; theirs = `ink` on `parchment/8%` hairline, radius 8), mono timestamps, **Send** primary + input (Section D). 5s auto-refresh keeps but shows a quiet mono "·" pulse only.

**Buttons:**
| Button | Type | Spec |
|---|---|---|
| Add Partner | Primary | Opens add form (Section D) — name, email, role select. |
| Reply (nudge) | Ghost | Opens thread. |
| Dismiss (nudge) | Quiet | gold-dim ×; removes tray item. |
| Message | Secondary | → thread. |
| ⋯ (partner) | Quiet | Edit role / Remove partner (ember dialog). |
| Back | Ghost | → list (gold-dim chevron). |
| Send | Primary | Disabled until text; mono char count optional. |
| Remove partner | Danger | Dialog with cascade copy ("their messages are preserved? deleted?"). |

---

### C11. Notes (`/notes`)

**Goal:** quiet indexed journal. Notes are rich text (Tiptap). Keep it minimal.

**Layout:** header "Notes" Playfair H1 + **New Note** primary → RichNoteModal. Grid of note cards (hairline): title (Inter 600, parchment), 3-line excerpt (parchment/60%), mono date, optional **View Day** gold-dim link, **Edit** secondary + **Download** ghost (downloads the note; keep PDF export only where Reports needs it).

Empty state (app's voice): *"Nothing written yet — a single honest sentence today is enough. Start with your first note."* + New Note primary.

**Buttons:**
| Button | Type | Spec |
|---|---|---|
| New Note | Primary | Opens RichNoteModal. |
| Edit | Secondary | Opens RichNoteModal on that note. |
| Download | Ghost | gold-dim download icon; HTML/PDF per current. |
| View Day | Ghost link | gold-dim → `/day/<date>`. |

(**RichNoteModal** — restyle toolbar to ghost gold-dim icons; parchment surface; radius 8; focus rings on all toolbar keys.)

---

### C12. Reviews (`/reviews`)

**Goal:** the periodic review ceremony — calm, not a questionnaire wall.

**Layout:** header "Periodic Reviews" Playfair H1 + **New Review** primary → ReviewModal. List of review cards (hairline): **mono period + date** (`parchment/60%`), mood/energy as **mono figures** (not green/gold pill badges — e.g. `mood 3 / 4 · energy 7 / 10`), reflection excerpt (Inter, parchment), *Wins* labeled in mono `parchment/50%` with moss-colored left rule (semantic, not decorative).

**ReviewModal buttons:**
| Button | Type | Spec |
|---|---|---|
| Period segmented (daily…yearly) | Quiet segmented | active = parchment + gold underline; no filled pill. |
| Mood (1–4) / Energy (0–10) | Quiet segmented / range | Mood = 4 quiet text buttons (active parchment+gold underline); Energy = thin gold-dim range with mono value (no big colored slider). |
| Reflection / Wins / Misses / Top 3 | Form | Section D textareas, parchment. |
| Cancel | Ghost | parchment/70%. |
| Save Review | Primary | Confirms; reduced-motion instant. |

### C13. Reports (`/reports`)

**Goal:** official progress documents, generated on demand. Both the screen and the PDF should feel like a *typeset report*, mono figures, no neon.

**Layout:** header "Reports" Playfair H1. **Period selector** `Weekly | Monthly | Quarterly | Yearly` (quiet segmented, active = gold underline). **Generate** primary → fetches `/api/reports`. Result card: period in mono, the **overview stats** as four mono figures (Total Tasks, Completed, Notes, Avg Score — only **Avg Score** gold), then a **Daily Breakdown** of hairline rows (mono date + mono score, task lines with natural `moss`/`gold` dot states and mono weights). **Download PDF** secondary (jsPDF restyled: parchment/ink palette, Playfair title, mono figures — replace the current inherited bright theme).

Empty/unset state: *"No report generated yet — choose a period and Generate."* (specific, not filler).

**Buttons:**
| Button | Type | Spec |
|---|---|---|
| Period segmented | Quiet segmented | active = gold underline. |
| Generate | Primary | Loading = mono "Generating…" text, no spinner glow. |
| Download PDF | Secondary | Exports restyled doc. |

---

### C14. Settings (`/settings`)

**Goal:** quiet preferences. Move power-tools (seed/reset) behind an explicit **"Danger zone"** group so they never sit beside routine toggles.

**Layout:** header "Settings" Playfair H1. Cards (hairline), each a simple labeled row:
1. **Appearance** — Theme: a **quiet switch** (`Light`/`Dark`), **dark = default/canonical** (gold underline + needle glyph on the active one); no dual gold buttons.
2. **Google Calendar** — status line (mono `Connected`/`Not connected`; connected = moss dot, not a big green pill), **Connect** secondary / **Disconnect** ghost (`ember`-tinted text on hover only).
3. **Notifications** — Push manager: quiet bell + **Enable/Manage** secondary → browser prompt.
4. **Install app** — **Install** secondary (PWA) when available.
5. **Danger zone (collapsed by default):** **Seed framework** (secondary, hidden) and **Reset all data** (danger) with a two-step confirm, both under a `ember`-hinted group header. Copy is specific and lists everything it erases ("items, tasks, habits, financial entries, notes, reviews, events, trackers, settings — cannot be undone").

**Buttons:**
| Button | Type | Spec |
|---|---|---|
| Theme switch | Quiet switch | Default Dark; active = parchment + gold underline. |
| Connect / Disconnect | Secondary / Ghost | Connect = secondary; Disconnect = quiet with ember hover. |
| Notifications Enable | Secondary | → browser permission. |
| Install | Secondary | PWA prompt; shown only when installable. |
| Seed | Secondary‑hidden | In Danger zone. |
## D. Shared Patterns

### D1. Cards
`ink` surface; `1px solid color-mix(in srgb, var(--gold-dim) 20%, transparent)`; radius **8px**; padding 20px (16px mobile); **no shadow, no gradient, no glass** (except the one Partners nudge card). Interactive cards: hover hairline → 40% gold; focus visible 2px gold ring. Keyboard = Enter/Space (current `Card.tsx` already handles this — keep).

### D2. Hairline tables
Headers: Inter 11px caps, `parchment/45%`. Body: Inter 13px `parchment` for text; **mono right-aligned** for every figure. Row hairline `gold-dim @15%`. Row hover: `parchment/3%` fill. No vertical zebra stripes, no colored pills — status as text or a 6px semantic dot (moss/gold/ember) only.

### D3. Modals & sheets (shadcn Dialog primitives, restyled)
- Surface: `ink` (default) or `parchment` only when a note/letter must read on light — keep dark for all forms. Radius 8px; `1px gold-dim @25%` hairline; no shadow beyond a hairline + slight ink. Max-width: 480px forms / 720px notes.
- Header: title Inter 600 `parchment`; close = ghost × gold-dim 40×40.
- Backdrop: `rgba(10,9,8,0.6)` + optional 12px backdrop-blur **only** for the Partners glass card (not forms).
- **Sheet** (right-side on desktop / bottom on mobile, `SheetPrimitive`): used for Day deed editor, TransactionForm, ReviewModal. Radius 8px. Enter = settle-in (no bouncy spring); reduced-motion → instant.
- Focus is trapped, Escape closes, `aria-modal` set, scroll-locked (shadcn does this).

### D4. Form fields
- Text/textarea/select/date/time/range styled uniformly: `ink` fill, `1px gold-dim @25%` hairline, radius 6px, padding 10–12px, Inter 14px `parchment`; placeholder `parchment/30%`; focus = `1px gold` hairline + 2px gold ring offset 1px. Mono styling when the field is a figure (amount, date, weight).
- Labels: Inter 12px `parchment/60%`, above field, mono for figure labels.
- Inline editing (Why, budgets, habits, add-deed): a single-line input that appears in place; Enter commits, Esc cancels, back-up with a quiet ghost button.
- Validation errors: `ember`-tinted text (readable AA, ~`#cf8f78`), specific message + focus the offending field.

### D5. Toasts (`ToastProvider`)
Keep the primitives; restyle: `ink` card, `gold-dim @20%` hairline, radius 8, **mono** for figures ("Deed added · 10%"), status dot = moss (success) / ember (error) / gold (neutral). Slide-up-settle 200ms, reduced-motion → fade. No neon edges.

### D6. Confirm dialogs (the `confirm()` helper → component)
Replace native `confirm()` with a styled dialog (used by delete/reset): title (Inter 600), **specific copy naming what will be deleted and its cascades** (never bare "Are you sure?"), mono details, **Cancel** ghost + **Confirm** (danger anatomy for destructive). Two-step confirm only for "Reset all data".

### D7. Empty & error states (voice)
Written for this product, specific and actionable — never "Nothing here yet!". Templates:
- **No framework:** "Start with your Why — the one sentence this year is really about." → **Build your Why**.
- **No deeds today:** "No deeds set for today. Add one, or open the week to plan ahead." → **Add a deed** / **Open week**.
- **No partners:** "Add an accountability partner to share your progress and stay honest." → **Add partner**.
- **No notes / reviews / habits:** as in their pages (specific + one primary action).
- **Error:** "We couldn't load your <X>. Check your connection and try again." → **Retry** (ghost). Never a bare "Something went wrong".

## E. Component Migration Map (today → tomorrow)

This is the concrete bridge between what exists in `src/components` today and the target. Many current components are *styled away from* the target; most can stay as functional primitives and be re-skinned in place.

### E1. Progress / instrument components
| Today | Tomorrow |
|---|---|
| `ui/ProgressRing.tsx` (SVG ring, auto gold/sage/coral by %, glow filter) | Replace internals with the **compass-instrument** ring primitive (token colors only). Remove the `drop-shadow` glow and the sage/coral auto-color (color now comes from explicit passes: `moss`/`gold`/`ember` only when meaningful). Keep the spring-settled stroke. |
| `ui/ProgressBar.tsx` | Keep as thin hairline bar (used for habits/budgets). Color passed explicitly, three-state only. Remove glow. |
| Dashboard stat cards / diffused orbs | Remove. Superseded by the compass hero. |

**New `ui/Compass.tsx`** — the instrument: options `size`, `rings` (shown/active per layer), `needleDeg` (alignment). One spring settle on mount/on data change; `prefers-reduced-motion` → static.

### E2. Layout & nav
| Today | Tomorrow |
|---|---|
| `ui/Sidebar.tsx`, `ui/Topbar.tsx`, `ui/BottomNav.tsx`, `ui/MobileMenu*.tsx` | Re-skinned per B1–B3. Add the topbar **small compass** (retrieve alignment from store). |
| `ui/Card.tsx` | Adjust radius→8px, hairline `gold-dim@20%`, no shadow; keep keyboard behavior. |
| `ui/MobileMenu` / `ui/BottomNav` "More" sheet | Merge into one mobile nav; restyle sheet per B3. |

### E3. Modals & forms
| Today | Tomorrow |
|---|---|
| `ui/DayModal.tsx`, `ui/DayPanel.tsx` | Restyle per C6/D3; unify as the Day sheet/drawer. |
| `finance/TransactionForm.tsx` | Restyle per C8/D3 (sheet, mono amount). |
| `ui/ReviewModal.tsx` | Quiet segmented controls, mono figures (C12). |
| `ui/NudgeModal.tsx` | Keep; restyle (hairline, glass-card backdrop only here). |
| `ui/NoteModal.tsx` / `ui/RichNoteModal.tsx` | Restyle Tiptap toolbar + surface (C11). |
| `ui/CategoryEditModal.tsx` | Restyle; inline editing preferred. |
| `ui/ToastProvider.tsx` | Restyle per D5; migrate `confirm()` → styled dialog. |

### E4. Finance
| Today | Tomorrow |
|---|---|
| `finance/budgetCategories.ts`, `finance/SectionBudgetCard.tsx`, `finance/BudgetProgress.tsx` | Mono figures, three-state bars, muted purse palette (C8). |
| Purse icon set (16 emoji) / bright color swatches (16 hex) | Replace with line icons/initials + 6-token muted palette. |

### E5. Misc UI
| Today | Tomorrow |
|---|---|
| `ui/InstallPrompt.tsx`, `ui/PushNotificationManager.tsx`, `ui/PendingSuggestions.tsx`, `ui/PartnerLinker.tsx`, `ui/WeekView.tsx`, `ui/MonthView.tsx` | Keep function; re-skin to tokens. `WeekView`/`MonthView` fold into the shared `LayerView`/calendar. |

### E6. CSS housekeeping (`src/app/globals.css`)
- Define the six tokens (`--ink`, `--parchment`, `--gold`, `--gold-dim`, `--ember`, `--moss`) and a `color-mix` hairline utility; set **dark as the canonical `.dark`/default**.
- **Delete** (no longer permitted): `.glass*`, `.glow-sm`, `.gamified-bg`/orb classes, `.achievement-card`, `.stat-card`, `.quest-item`, `.streak-flame`, `.level-badge`, gold `linear-gradient` text helpers, `drop-shadow` filters.
- Keep: TipTap placeholder rule, mobile text-size rules, native `:focus-visible` gold ring, `prefers-reduced-motion` block that disables the settle/compound transitions.

### E7. Data-model alignment (see C6 note)
- Store (`src/stores/hierarchyStore.ts`): collapse the 7-layer enum into the **5-layer Why→Quest→Milestone→Win→Deed** model; remove the internal layer-5/6 ambiguity.
## F. Motion & Compass Specification

### F1. Sanctioned motions
1. **Settle (spring)** — `{ type: "spring", stiffness: 120, damping: 14 }` family. Used for: compass needle, number counters counting up on load (kokonutui-style number-ticker, mono, settle to final), stroke-dashoffset on rings/bars, sheet/dialog entrance (a short settle, no bounce).
2. **Compound reveal** — one `motion` parent with `staggerChildren: 0.06–0.08` staging the 5 hierarchy layers / child cards when a tree expands. Child animation = `opacity 0→1` + `y 6→0`, ease-out. Duration total ≤ 400ms.
3. **Page transition** — between hierarchy levels: a subtle **push/fade** (`opacity` + tiny `x`, ~200ms), never a full slide-in-from-right. Landing sequence (C1) is the one scripted reveal.
4. **Checkbox** — the deed checkbox fills gold over ~200ms ease (a settle, not a bounce); completed states simply exist (no confetti, no sparkle).

### F2. Forbidden
Spring bounces (low damping / high stiffness), keyframe loops (`animate-float`, `animate-slideUp` decorative), icon `scale-*` bounce on hover/tap, gradient sweeps, `animate-pulse` badges, glow `drop-shadow` pulses. Any animation not justified by "compounding / settling" is cut.

### F3. `prefers-reduced-motion`
Single global guard: set all transition durations to `0s` (or `motion`'s `MotionConfig reducedMotion="user"`), disable springs (instant), flatten staggers to a single opacity fade, freeze the needle and counters at final values. Verify the checkbox, compass, sheet, and hierarchy reveal all degrade cleanly.

### F4. Compass alignment formula
`needleDeg = todayDeedsTaggedToActiveQuest / todayDeedsTotal × 360` (or a normalized 0–100 if no quest tag exists). A deed is "aligned" when it sits under an **active** (non-complete, non-future) Quarterly Quest. Completed rollup at any layer lights that layer's ring gold; otherwise the ring rests at gold-dim. Empty/undecided state: needle at 0, fine mono caption `No decomposed deeds yet`.

---

## G. Accessibility & Quality Floor

- **Contrast (WCAG AA):** `parchment (#F3EFE6)` on `ink (#0A0908)` for body ≈ 14.5:1 (passes easily). `gold (#B8935A)` on ink ≈ **use only for large/UI text (≥ 18px bold or UI-graphics)** per the brief — small body copy stays parchment. `gold-dim (#8A6D42)` used only for decorative/disabled/inactive (non-essential). `ember` text raised to a readable `#cf8f78` where it must carry meaning; `moss` text on ink checked similarly (raise to `#7fa871` for small text if needed).
- **Keyboard:** every interactive element focusable; visible `2px gold` `:focus-visible` ring, offset 2px, on buttons/links/fields/cards/table rows. Dialog focus trap + `Escape` + `aria-modal` (shadcn provides; keep wired).
- **Screen readers:** `aria-label` on all icon-only buttons; `role/aria-pressed` on toggles (checkbox/lock/frog/theme); `aria-current` on active nav; tables use proper `<th scope>`. Mono/Playfair are presentational only — never conveyed to AT as meaning.
- **Touch:** min 44×44px targets on mobile; bottom nav & action rows comply; no `hover-only` gestures required to reach a control (menus/remotes become tap-accessible; hover-revealed Delete gets a visible tap alternative).
- **Reduced motion** per F3. **No layout shift** when numbers stream/settle (reserve mono widths / `font-variant-numeric: tabular-nums`).
- **Responsive:** single-column ≤ 768px; hierarchy grids collapse to 2→1 columns; tables scroll horizontally with sticky first column; modals become bottom sheets on mobile.

---

## H. Phased Implementation Order

**Phase 0 — Tokens & base (`globals.css`, `layout.tsx`)**
Install `motion`. Define six tokens, dark-canonical theme, hairline utilities, Playfair/Inter/JetBrains Mono in `layout.tsx`, global `prefers-reduced-motion` + `:focus-visible`. Delete the banned glow/gradient/orb/glass CSS.

**Phase 1 — Global chrome (B1–B4)**
Re-skin Sidebar, Topbar (+ small compass), BottomNav & More sheet. Add shared **breadcrumb** component. This immediately re-flavors every page.

**Phase 2 — Compass instrument + Dashboard (A5, C3)**
Build `ui/Compass.tsx`; replace the dashboard hero, remove gamified decorations, stat grid, achievements; add Today's Deeds list + empty state.

**Phase 3 — Hierarchy core (C4, C5, + data model E7)**
Unify `[id]` vs label routes; build the shared `LayerView` (breadcrumb, alignment figure, child drill cards, reflection card, inline add/sliders); align store to the 5-layer Why→Quest→Milestone→Win→Deed model; verify compass ring colors roll up correctly.

**Phase 4 — Day + Calendar (C6, C7)**
Day ledger/timeline + weighty checkboxes; Deed edit sheet; habit tracker + graph; DayPanel unification; calendar ledger restyle.

**Phase 5 — Finance (C8, C9)**
Mono ledger, NGN/USD inline switch, section budgets, muted purse palette, transactions filters/analysis restyle.

**Phase 6 — Partner/Notes/Reviews/Reports/Settings (C10–C14)**
Partners (glass card audit), Notes/RichNoteModal, Reviews modal, Reports + restyled PDF, Settings incl. Danger zone.

**Phase 7 — QA pass**
Run through Section G checklist per screen; sweep for banned patterns (`grep` for `shadow`, `gradient`, `glass`, `rounded-2xl`, `animate-float`, `scale-105`, bright hex palettes); reduced-motion + keyboard + mobile audit.

> **Definition of done for “Phase”: the full C-section button tables for that page are honored (styles + states + motion + reduced-motion), and the screen contains no banned pattern from A1/A3/A4/F2.**

- Active tab / active tab: `parchment` + **2px gold underline** (never gold pill/gradient).
- Disabled: `parchment/25%` text, no cursor change drama, but `aria-disabled`.
- Loading: prefer **mono status text** ("Loading…", "Generating…") over animated spinners; keep a tiny quiet spinner only where a figure is mid-fetch (reduced-motion: static icon).
- Overdue/urgent uses `ember`; completed rollups use `moss`; neutral/progress uses `gold`;**any given mini-region uses at most one of these three for meaning.**









