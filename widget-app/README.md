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
| `alarms` | Your next alarm (title + time, "+n more") |
| `messages` | Latest message from your partner |
| `clock` | Big live clock + date |
| `note` | Any free text you wrote, fully styleable |

You control: page order & count (up to 10), rotation speed, which of
plan/alarms/messages are included, per-page accent + background color, and
per-element text size/color. **Tap the widget to flip to the next page.**

## Setup

1. Deploy the Inchstone web app (the widget reads `/api/widget`).
2. In the web app: **Settings → Widget → copy pairing secret**.
3. Build & install this app (Android Studio → Open `widget-app/` → Run), or
   `./gradlew :app:assembleDebug` and install `app/build/outputs/apk/debug/app-debug.apk`.
4. Open "Inchstone Widget", paste the secret, tap **Pair & refresh**.
5. Long-press your home screen → Widgets → **Inchstone Widget** → add it.
   (The first add opens the pairing screen if you haven't paired yet.)

## Before building: set your server host

`WidgetData.kt` has `https://YOUR-INCHSTONE-HOST/api/widget?...` — replace
`YOUR-INCHSTONE-HOST` with your deployed domain (e.g. `inchstone.vercel.app`).

## Files

- `InchstoneWidgetProvider.kt` — the AppWidgetProvider: renders a page, tap-to-next-page
- `Pages.kt` — one renderer per page kind
- `WidgetData.kt` — secret storage, cached `/api/widget` fetch, rotation alarm
- `MainActivity.kt` — the pairing screen
- Server side: `src/app/api/widget/route.ts` (data + design), `WidgetConfig`
  Prisma model (design + secret)
