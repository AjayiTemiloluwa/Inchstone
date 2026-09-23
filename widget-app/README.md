# Inchstone Widget (Android companion)

A tiny native Android app that puts a **live Inchstone widget on your home
screen** — real home-screen tiles, which a PWA alone cannot create.

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
but Android clamps repeating alarms to a **60-second floor** (and doze mode can
stretch it further). So: tap-to-advance is always instant, and auto-rotation
runs at whatever your dwell time is with a minimum of ~1 minute. The system's
own 30-minute `updatePeriodMillis` is a second, slower safety net.

## Setup

1. Deploy the Inchstone web app (the widget reads `/api/widget`).
2. In the web app: **Settings → Widget → copy pairing secret**.
3. **Android Studio → Open this `widget-app/` folder** → let it sync → **Run ▶**.
   (Studio generates the Gradle wrapper and any missing config on first sync —
   there is deliberately no committed wrapper.)
4. Open "Inchstone Widget", paste the secret, set your server host
   (defaults to `inchstone.vercel.app`), tap **Pair & refresh** → you should see
   "Paired ✓".
5. Long-press your home screen → Widgets → **Inchstone Widget** → add it.
   (The first add opens the pairing screen; once paired it finishes straight
   to the home screen.)

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
