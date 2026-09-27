# Inchstone Widget (Android companion)

A tiny native Android app that puts a **live Inchstone widget on your home
screen** — real home-screen tiles, which a PWA alone cannot create.

Works on **Android 7 → 16 with one APK** (`minSdk 24`, `targetSdk 35`).
No code changes needed per version — just follow the section for your
Android version below.

## What it shows

The widget rotates through "pages" you design in the web app
(**Settings → Widget** — the design lives in your Inchstone account, so every
device shows the same thing):

| Page kind | Shows |
|---|---|
| `plan` | Your next deed today + its time + progress bar |
| `timers` | Your next *timed* deed + `HH:MM · n/m done` + the day's progress |
| `alarms` | Your next alarm (title + time, "+n more") |
| `messages` | Latest message from your partner |
| `clock` | Big live clock + date |
| `note` | Any free text you wrote, fully styleable |

You control: page order & count (up to 10), rotation speed, which of
plan/alarms/messages are included, and **per page** the accent colour, the
background colour, and the text colour + text size.
**Tap the widget to flip to the next page** at any time.

### How the rotation actually behaves

The widget advances a page on a repeating alarm set to your `rotateSeconds`,
but Android clamps repeating alarms to a **60-second floor** (and Doze mode on
Android 13–16 can stretch ticks to ~15 min when the phone sleeps). So:
tap-to-advance is always instant, and auto-rotation runs at whatever your
dwell time is with a minimum of ~1 minute. The system's own 30-minute
`updatePeriodMillis` is a second, slower safety net.

---

## Part A — Install it (pick ONE method)

### Method 1: Android Studio Run to phone (easiest, all versions)

1. Install **Android Studio** on your computer (Hedgehog / Iguana /
   Jellyfish / Koala all work).
2. Connect your phone with a **USB cable**.
3. On the phone, enable developer mode + USB debugging:
   - **Settings → About phone → tap Build number 7 times**
     ("You are now a developer!").
   - Go to **Settings → System → Developer options → USB debugging ON**.
     - Samsung: **Settings → Developer options** (directly under Settings).
     - Xiaomi / Redmi / POCO: **Settings → Additional settings →
       Developer options**. Also turn ON **Install via USB** and
       **USB debugging (Security settings)**, otherwise install is blocked.
   - Plug in → tap **Allow** on "Allow USB debugging?"
     (tick **Always allow from this computer**).
4. In Android Studio: **File → Open → select the `widget-app/` folder** →
   wait for **Gradle sync finished** at the bottom.
   (Studio generates the Gradle wrapper itself on first sync — none is
   committed on purpose.)
5. Pick your phone in the device dropdown → press **Run**. The
   **Inchstone Widget** app installs on your phone.

### Method 2: Build an APK once, install on any phone (no cable next time)

1. In Android Studio with `widget-app/` open:
   **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
2. Click **locate** when it finishes. The file is at:
   `widget-app/app/build/outputs/apk/debug/app-debug.apk`
3. Send that file to your phone (WhatsApp to yourself, Drive, USB copy —
   anything). Open it on the phone → **Install**.
   - If blocked — Android 13+: tap **Settings → Allow from this source**.
     Android 8–12: enable **Install unknown apps** for the app you install
     from (Chrome / Files / WhatsApp).

> One APK works on Android 7 through 16. No separate builds needed.

---

## Part B — Pair it (same on every version)

1. Web app: **Settings → Widget → copy pairing secret**.
2. Open the **Inchstone Widget** app on your phone.
3. Leave **Server** as-is unless you self-host
   (default `inchstone.vercel.app` — must match your deployed URL,
   no `https://`, no trailing `/`).
4. Paste the secret → tap **Pair & refresh**.
   - **Paired ✓** → done, go to Part C.
   - **Couldn't reach Inchstone** → secret has an extra space, no
     internet, or wrong server host spelling.

## Part C — Put the widget on your home screen

### Android 13 / 14 / 15 / 16 (incl. Samsung One UI 5.1–8, Pixel UI)

1. **Long-press an empty spot** on the home screen → tap **Widgets**.
2. Scroll to **Inchstone Widget** (or search "Inchstone") → **drag it** onto
   the home screen (or tap **Add**).
3. First time, the pairing screen opens — pair once (Part B) and it drops
   straight on. Adding a second widget later skips pairing entirely.
4. To resize: long-press the widget → drag the handles
   (4x2 cells is the designed size; works from 2x1 up to full-width).

### Android 10 / 11 / 12

Long-press home screen → **Widgets** → find **Inchstone Widget** → drag it on.
First add opens pairing; later adds go straight on.

### Android 7 / 8 / 9

- Stock Android: long-press home screen → **Widgets** → drag it on.
- Samsung Experience (S8/S9 era): long-press → **Widgets** → scroll to it.
- No live preview thumbnail on these versions (launcher shows the app icon
  instead) — the widget itself works identically once placed.

---

## Troubleshooting (read only if something is off)

| Symptom | Fix |
|---|---|
| Widget doesn't rotate every few seconds | Normal on all versions. 60-sec OS minimum; Doze stretches it further asleep. Tap to flip instantly. |
| "Tap to pair with Inchstone" | Open the app and pair (Part B) — it refreshes by itself. |
| "No pages configured" | Web app → Settings → Widget → add a page → phone app → Pair & refresh. |
| Rotation stops after hours (Xiaomi, Oppo, Vivo, OnePlus, Samsung) | Battery killed the alarm. **Settings → Apps → Inchstone Widget → Battery → Unrestricted.** Xiaomi: also lock app in Recents + enable Autostart. Samsung: **Battery → Background usage limits → Never sleeping apps → add it.** |
| "App not installed" sideloading APK | Uninstall old Inchstone Widget first, then reinstall (signature clash). |
| Install via USB greyed out (Xiaomi) | Sign into Mi account + insert SIM first. |
| Studio: "No devices found" | Swap cable (charge-only?), notification → USB → File transfer, or revoke authorizations in Developer options and replug. |

## Before building: nothing to edit

The server host is entered in the app's pairing screen — no source edits
needed. The defaults live in `WidgetData.kt` (`DEFAULT_HOST`) if you want to
change them.

## Files

- `InchstoneWidgetProvider.kt` — the AppWidgetProvider: renders a page, tap-to-next-page
- `Pages.kt` — one renderer per page kind
- `WidgetData.kt` — secret storage, cached `/api/widget` fetch, rotation alarm
- `MainActivity.kt` — the pairing screen
- Server side: `src/app/api/widget/route.ts` (data + design), `WidgetConfig`
  Prisma model (design + secret)
