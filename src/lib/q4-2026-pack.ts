import { randomUUID } from 'crypto'

export const Q4_META = {
  theme: 'Q4 2026 — Commit to the Lord (Proverbs 16:3)',
  anchorScripture: '"Commit to the Lord whatever you do, and he will establish your plans." - Proverbs 16:3',
  focusQuestion: "Did my actions today align with God's will and the disciplined identity I am building this quarter?",
  qStart: new Date(2026, 8, 22),
  qEnd: new Date(2026, 11, 31, 23, 59, 59, 999),
}

export type Q4Row = {
  id: string
  userId: string
  layer: number
  parentId: string | null
  title: string
  weight: number
  description?: string
  startDate?: Date
  endDate?: Date
}
export const Q4_MONTHS = [
  { t: 'September — Finish Strong (Sep 22-30)', w: 10, s: new Date(2026, 8, 22), e: new Date(2026, 8, 30, 23, 59, 59, 999) },
  { t: 'October', w: 30, s: new Date(2026, 9, 1), e: new Date(2026, 9, 31, 23, 59, 59, 999) },
  { t: 'November', w: 30, s: new Date(2026, 10, 1), e: new Date(2026, 10, 30, 23, 59, 59, 999) },
  { t: 'December', w: 30, s: new Date(2026, 11, 1), e: new Date(2026, 11, 31, 23, 59, 59, 999) },
]

export type CatDef = { name: string; weight: number; yearly: string; smart: string; checks: string[]; months: string[] }

export const Q4_CATS: CatDef[] = [
  {
    name: 'Spiritual Growth', weight: 20,
    yearly: 'Spiritual Growth — 2026 Annual Goal',
    smart: 'SMART GOAL — Sep 22 to Dec 31, 2026: pray + study Scripture 1h30 daily (target 100 of 101 days), intercede 1h weekly (14 sessions, Saturdays), read 3 Christian books (one by Oct 31, one by Nov 30, one by Dec 31) — to grow in practical obedience, not mere knowledge.',
    checks: [
      'Pray and study Scripture 1h30 every day until Dec 31. Track daily; review at Day 30, 60, 100.',
      'Intercede 1h every week at a fixed Saturday slot. Target: 14 sessions.',
      'Read 3 Christian books by Dec 31 (Book 1 by Oct 31, Book 2 by Nov 30, Book 3 by Dec 31).',
      'Evangelize intentionally: at least 1 person per week pointed to Christ.',
      'Avoid ungodly and non-grace media on all platforms. Target: 0 exceptions; self-check every Sunday.',
      'Serve actively in media department, incl. teaching young children coding where possible.',
      'Disciplined thinking, speech, conduct, decisions. Measure: 2-min evening review daily + weekly score out of 10.',
      'Practical obedience: each week write 1 specific Scripture obeyed in action.',
    ],
    months: [
      'SEP 22-30 LAUNCH: 1h30 daily streak 9 of 9. Fix Saturday intercession slot (session 1). Choose Christian Book 1. Evangelize 1+ person. Start media fast (0 exceptions) + first Sunday check. Serve in media. Begin 2-min reviews + log 1 obeyed Scripture.',
      'OCTOBER: 1h30 daily 31 of 31. 4 Saturday intercessions (sessions 2-5). FINISH Book 1 by Oct 31. Evangelize weekly (4+). Media fast holds. Serve + teach coding. Day-30 count review. Evening reviews + obedience log.',
      'NOVEMBER: 1h30 daily 30 of 30. 4-5 intercessions (sessions 6-10). FINISH Book 2 by Nov 30. Evangelize weekly. Media fast holds. Serve consistently. Day-60 review. Evening reviews + obedience log.',
      'DECEMBER: 1h30 daily 31 of 31 to reach 100 of 101. Final intercessions (sessions 11-14). FINISH Book 3 by Dec 31. Evangelize weekly. Media fast holds. Serve faithfully. Day-100 review + quarter obedience summary.',
    ],
  },
  {
    name: 'Academics and Research', weight: 20,
    yearly: 'Academics and Research — 2026 Annual Goal',
    smart: 'SMART GOAL — By Dec 31, 2026: complete WQU Course 2 (Financial Data) + send transcript, start 1-2 AI/ML research projects (petroleum/energy or sustainability) to question + lit review + methodology + dataset + preliminary results, studying 14+ hrs/week alongside work and NYSC.',
    checks: [
      'Complete WQU Course 2 (Financial Data) by Oct 31; submit/send transcript by Nov 30.',
      'Start 1-2 research projects; topics chosen by Oct 15. Areas: AI/ML in petroleum & energy; AI/ML in Finance; sustainability, gas utilization, methane/flaring, CCUS.',
      'Take one project to: question (by Oct 10) > lit review 15-20 sources (by Oct 31) > methodology (by Nov 7) > dataset (by Nov 21) > preliminary results (by Dec 20).',
      'Contact 15+ potential collaborators/supervisors by Oct 31; 1 actively engaged by Dec 1.',
      'Build math, stats, financial-engineering, programming foundations (14+ hrs/week).',
      'Make 3+ scholarship/school applications per month (10+ total).',
    ],
    months: [
      'SEP 22-30: study 14+ hrs. Shortlist topics (lock by Oct 15); draft question (due Oct 10). Contact first 5 of 15 collaborators. WQU sprint daily. Start Oct batch of 3 applications. Foundations reps.',
      'OCTOBER: study 14+ hrs/wk. COMPLETE WQU by Oct 31 (transcript by Nov 30). Topics locked Oct 15; question final Oct 10. Lit review 15-20 sources by Oct 31. All 15 contacts done. 3 applications.',
      'NOVEMBER: study 14+ hrs/wk. Methodology by Nov 7; dataset by Nov 21. Push for 1 engaged collaborator (by Dec 1). 3+ applications (running total 6-7).',
      'DECEMBER: study 14+ hrs/wk. Preliminary results by Dec 20. 1 collaborator engaged. Final 3-4 applications to reach 10+ total. Review: transcript sent, stage reached, apps logged.',
    ],
  },
  {
    name: 'Work and Practical Impact', weight: 15,
    yearly: 'Work and Practical Impact — 2026 Annual Goal',
    smart: 'SMART GOAL — By Dec 31, 2026: keep excellent standing in current role, log measurable results monthly, secure a field-aligned PPA by Nov 30, and launch an additional income stream by Nov 15.',
    checks: [
      'Maintain punctuality, accurate records, professional conduct all quarter.',
      'Log measurable results with numbers at end of Oct, Nov, Dec.',
      'Secure a PPA aligned with engineering / tech / research / AI-ML / energy by Nov 30.',
      'Launch/grow an income stream fitting work + NYSC + academics: options by Oct 15, started by Nov 15.',
      'Use NYSC strategically: experience, relationships, stronger profile.',
    ],
    months: [
      'SEP 22-30: reset standards — punctuality, records, conduct. Start the results log. List PPA targets + income-stream options (shortlist by Oct 15). Build 2-3 NYSC relationships.',
      'OCTOBER: excellence holds. Log October results w/ numbers. PPA pursuit active. Income options finalized by Oct 15; prep to launch. NYSC leveraged for experience.',
      'NOVEMBER: excellence holds. Log November results. PPA SECURED by Nov 30. Income stream STARTED by Nov 15. Relationships deepened.',
      'DECEMBER: excellence holds. Log December results + quarter summary. PPA settled in. Income stream reviewed (first revenue/lessons). Profile strengthened.',
    ],
  },
  {
    name: 'Career and Professional Development', weight: 15,
    yearly: 'Career and Professional Development — 2026 Annual Goal',
    smart: 'SMART GOAL — By Dec 31, 2026: build 2 strong AI-ML/automation projects (first by Nov 15, second by Dec 20), document measurable results monthly, update CV/LinkedIn/portfolio/research profile by Dec 20. Position: Petroleum Eng x AI-ML x Energy x Sustainability.',
    checks: [
      'Write one-paragraph positioning statement by Oct 7; use across all profiles.',
      'Deliver + document measurable role results monthly (Oct, Nov, Dec) with numbers.',
      'Build 3 strong technical projects in AI-ML/automation for energy, sustainability or finance.',
      'Grow production-level skill: Python, SQL, AI-ML, automation, APIs, databases, modern web tech.',
      'Update CV, LinkedIn, portfolio, research profile with strongest 2026 wins by Dec 20.',
      'Add 2+ meaningful new connections per month with follow-up.',
      'Complete certifications/structured knowledge in AI-automation, Finance, Sustainability, Energy.',
    ],
    months: [
      'SEP 22-30: write positioning statement (by Oct 7). Audit profiles. Pick project 1 scope. Log September baseline. 2+ new connections.',
      'OCTOBER: positioning live. Project 1 in build (target Nov 15). Log October results. 2+ connections. Start 1 certification module.',
      'NOVEMBER: SHIP project 1 by Nov 15; start project 2. Log November results. 2+ connections. Certification progress.',
      'DECEMBER: SHIP project 2 (and 3rd if scoped) by Dec 20. All 4 profiles updated by Dec 20. Log December + quarter proof. 2+ connections.',
    ],
  },
  {
    name: 'Personal Growth and Leadership', weight: 10,
    yearly: 'Personal Growth and Leadership — 2026 Annual Goal',
    smart: 'SMART GOAL — By Dec 31, 2026: read 3 personal-development books, keep consistent leadership/mentoring activity, and document growth every week.',
    checks: [
      'Read 3 leadership/personal-development books by Dec 31 (1 per month: Oct, Nov, Dec).',
      'Keep evidence of ongoing work and learning, reviewed monthly.',
      'Weekly engagement: 1+ contacts per week; key-people list by Oct 1.',
      'Practise daily communication skills, seeking feedback where possible.',
      'Continue mentoring and teaching where genuine value can be added.',
      'Document lessons, failures, wins, improvements: 1 entry every Sunday.',
    ],
    months: [
      'SEP 22-30: key-people list by Oct 1. Choose Oct/Nov/Dec books. Start weekly engagement + Sunday docs. Mentor where possible.',
      'OCTOBER: FINISH book 1. Weekly engagement holds. Communication practice + feedback. Sunday entries (4-5). Monthly review.',
      'NOVEMBER: FINISH book 2. Weekly engagement holds. Communication + mentoring continue. Sunday entries. Monthly review.',
      'DECEMBER: FINISH book 3. Weekly engagement holds. Sunday entries + quarter growth summary.',
    ],
  },
  {
    name: 'Health, Order and Lifestyle Discipline', weight: 10,
    yearly: 'Health, Order and Lifestyle Discipline — 2026 Annual Goal',
    smart: 'SMART GOAL — Through Dec 31, 2026: consistent sleep/wake (5-6h), exercise 5-7x/week (300 pushups, 50 situps + core, 50 lift reps daily targets), daily order and discipline.',
    checks: [
      'Consistent sleep/wake routine; 5-6h sleep daily.',
      'Exercise 5-7x per week. Daily targets: 300 pushups, 50 situps + core, 50 lift reps minimum.',
      'Daily hygiene, neatness, order in space and routines.',
      'Idle phone/social/games under 1h30 unless a solid need demands more.',
      'Disciplined food, spending, media, time, commitments: weekly yes/no check per area.',
      'Punctuality, reliability, excellence: 0 missed commitments without notice.',
    ],
    months: [
      'SEP 22-30: lock sleep/wake times. Start 5-7x rhythm + daily targets. Reset space + hygiene. Phone under 1h30. First weekly check.',
      'OCTOBER: routine holds 31 days. 20+ sessions. Order daily. Weekly checks. 0 missed commitments without notice.',
      'NOVEMBER: routine holds. 20+ sessions; strength progression. Weekly checks. Reliability streak continues.',
      'DECEMBER: routine holds to Dec 31. Final 20+ sessions + quarter fitness summary. Order closes strong.',
    ],
  },
  {
    name: 'Financial Stewardship', weight: 10,
    yearly: 'Financial Stewardship — 2026 Annual Goal',
    smart: 'SMART GOAL — By Dec 31, 2026: monthly budget followed, 100,000-125,000 saved monthly (500,000 year-end target), 0 unnecessary debt, faithful tithing.',
    checks: [
      'Track and review expenses monthly.',
      'Budget (transport, food, accommodation, family, giving, savings, dev) in place by Sep 30; reviewed month-end.',
      'Save 100,000-125,000 monthly (Oct, Nov, Dec). Target: 500,000 by year-end.',
      '0 new non-essential debt this quarter.',
      'Tithe faithfully and consistently.',
      'Buy only goal-tied tools that raise earning capacity.',
    ],
    months: [
      'SEP 22-30: budget in place by Sep 30. Start tracking. Set Oct savings transfer. Tithe plan. 0 new debt.',
      'OCTOBER: follow budget; month-end review. Save 100,000-125,000. Tithe. 0 new debt.',
      'NOVEMBER: follow budget; month-end review. Save 100,000-125,000. Tithe. 0 new debt.',
      'DECEMBER: follow budget; quarter review. Save 100,000-125,000 to reach 500,000. Tithe. 0 new debt.',
    ],
  },
]
export function buildQ4Rows(userId: string, yearId: string): Q4Row[] {
  const rows: Q4Row[] = []
  for (const c of Q4_CATS) {
    const catId = randomUUID()
    rows.push({ id: catId, userId, layer: 1, parentId: yearId, title: c.name, weight: c.weight, startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31, 23, 59, 59, 999) })
    const yId = randomUUID()
    rows.push({ id: yId, userId, layer: 2, parentId: catId, title: c.yearly, weight: 100, description: c.smart, startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31, 23, 59, 59, 999) })
    const qId = randomUUID()
    const qDesc = c.smart + '\n\n' + c.checks.map((x, i) => (i + 1) + '. ' + x).join('\n')
    rows.push({ id: qId, userId, layer: 3, parentId: yId, title: 'Q4 2026 Objective (Sep 22 - Dec 31)', weight: 100, description: qDesc, startDate: Q4_META.qStart, endDate: Q4_META.qEnd })
    c.months.forEach((m, i) => {
      rows.push({ id: randomUUID(), userId, layer: 4, parentId: qId, title: Q4_MONTHS[i].t, weight: Q4_MONTHS[i].w, description: m, startDate: Q4_MONTHS[i].s, endDate: Q4_MONTHS[i].e })
    })
  }
  return rows
}
