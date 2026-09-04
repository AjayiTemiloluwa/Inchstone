import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Inchstone',
  description: 'How Inchstone handles your data, including Google Calendar data.',
}

const SECTIONS: Array<{ title: string; body: Array<string> }> = [
  {
    title: 'What Inchstone is',
    body: [
      'Inchstone is a personal productivity app for turning yearly goals into daily deeds: goals, quarters, months, weeks, daily deeds, habits, finances, notes, reviews, long-term plans and accountability partners.',
    ],
  },
  {
    title: 'What data we collect',
    body: [
      'Account basics — your name and email address, provided by Google or email sign-in through our authentication provider (Clerk).',
      'Content you create — the goals, deeds, tasks, habits, financial entries, notes, reviews, reflections and plans you write inside the app.',
      'Google Calendar data — only if you choose to connect Google Calendar. In "pull" mode Inchstone reads events from your calendar (calendar.events.readonly) to show them on your day timeline. In "two-way" mode Inchstone may also create and update events on your calendar (calendar.events) for deeds you schedule.',
      'Connection tokens — if you connect Google Calendar, a refresh token is stored so syncing can continue. Tokens are stored server-side and are never exposed to your browser.',
      'Notification data — if you enable web push, your browser-generated subscription endpoint is stored so alarms and reminders can reach you.',
      'Usage data — daily scores and streaks you generate by using the app.',
    ],
  },
  {
    title: 'How your data is used',
    body: [
      'Everything is used solely to operate the features you choose: showing your calendar on your timeline, pushing deeds you scheduled to your own calendar, sending alarms and reminders you set, and delivering partner invites.',
      'We do not sell your data. We do not use it for advertising. We do not use it to train machine-learning or AI models.',
      "If you connect Google Calendar, Inchstone's use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
    ],
  },
  {
    title: 'Third parties we rely on',
    body: [
      'Clerk — account authentication (name, email).',
      'Vercel — application hosting.',
      'Neon — hosted PostgreSQL database where your app data is stored.',
      'Google — Calendar API, only when you connect your calendar.',
      'Resend — email delivery for accountability-partner invites.',
    ],
  },
  {
    title: 'Your controls',
    body: [
      'Disconnect Google Calendar any time from Settings → Google Calendar. This deletes the stored tokens and stops all calendar syncing immediately.',
      'You can also revoke Inchstone directly in your Google Account at myaccount.google.com/permissions.',
      'Settings → Danger zone → Reset all data permanently deletes your app content (goals, deeds, habits, finances, notes, reviews, events, trackers and settings).',
      'Deleting your account removes your account record; residual app data is removed with it.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'Questions or data requests: ajayitemiloluwasamuel6@gmail.com',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper px-6 py-[8vh]">
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-display font-display text-parchment">Privacy Policy</h1>
        <p className="mt-3 text-body text-ink/60">
          Effective {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · Inchstone
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map(section => (
            <section key={section.title}>
              <h2 className="text-body font-semibold text-gold">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph, i) => (
                  <p key={i} className="text-body leading-relaxed text-ink/80">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Link
          href="/"
          className="mt-14 inline-flex min-h-10 items-center text-body text-parchment/60 transition-colors hover:text-gold"
        >
          ← Back to Inchstone
        </Link>
      </div>
    </div>
  )
}