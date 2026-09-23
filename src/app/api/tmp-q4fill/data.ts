export const Q = { start: new Date(2026, 8, 22), end: new Date(2026, 11, 31, 23, 59, 59, 999) }
export const MO = [
  { t: 'September \u2014 Finish Strong (Sep 22\u201330)', w: 10, s: new Date(2026, 8, 22), e: new Date(2026, 8, 30, 23, 59, 59, 999) },
  { t: 'October', w: 30, s: new Date(2026, 9, 1), e: new Date(2026, 9, 31, 23, 59, 59, 999) },
  { t: 'November', w: 30, s: new Date(2026, 10, 1), e: new Date(2026, 10, 30, 23, 59, 59, 999) },
  { t: 'December', w: 30, s: new Date(2026, 11, 1), e: new Date(2026, 11, 31, 23, 59, 59, 999) },
]
export type G = { t: string; s?: string; o?: string; n?: string; d?: string }
export type C = { name: string; weight: number; smart: string; goals: G[] }
export const CATS: C[] = [
  {
    name: 'Spiritual Growth', weight: 20,
    smart: 'SMART GOAL \u2014 From September 22 to December 31, 2026, I will pray and study Scripture for at least 1 hour 30 minutes every day (target: 100 of 101 days), intercede for at least 1 hour every week (14 sessions), and read 3 Christian books (one by Oct 31, one by Nov 30, one by Dec 31), so that I grow in practical obedience to God\u2019s Word and not merely in knowledge of Scripture.',
    goals: [
      { t: 'Pray and study Scripture for at least 1 hour 30 minutes every day until Dec 31. Track daily; review the count at Day 30, 60, and 100.', s: 'Days 1-9: 1h30 daily, start tracker.', o: 'Days 10-40: 1h30 daily 31/31. Day-30 review.', n: 'Days 41-70: 1h30 daily 30/30. Day-60 review.', d: 'Days 71-101: 1h30 daily 31/31. Day-100 review. Target 100 of 101.' },
      { t: 'Intercede intentionally for at least 1 hour every week, at a fixed weekly slot Saturdays. Target: 14 sessions.', s: 'Fix Saturday slot. Session 1 done.', o: 'Sessions 2-5 (4 Saturdays).', n: 'Sessions 6-10 (4-5 Saturdays).', d: 'Sessions 11-14. All 14 done.' },
      { t: 'Read at least 3 Christian books by Dec 31, 2026 (Book 1 by Oct 31, Book 2 by Nov 30, Book 3 by Dec 31).', s: 'Choose Book 1, start reading.', o: 'FINISH Book 1 by Oct 31.', n: 'FINISH Book 2 by Nov 30.', d: 'FINISH Book 3 by Dec 31.' },
      { t: 'Intentionally use my relationships and connections to evangelize and point people to Christ. Target: at least 1 person per week.', s: 'Reach 1+ person; keep a soul list.', o: 'Evangelize weekly (4+ people).', n: 'Evangelize weekly (4+ people).', d: 'Evangelize weekly (4-5); quarter review.' },
      { t: 'Completely avoid ungodly media and any media that does not minister grace, across all platforms. Target: 0 exceptions; weekly self-check every Sunday.', s: 'Begin fast (0 exceptions); first Sunday check.', o: 'Fast holds; Sunday checks.', n: 'Fast holds; Sunday checks.', d: 'Fast holds to Dec 31; quarter review.' },
      { t: 'Serve actively and consistently in media department, including teaching young children coding where opportunities arise.', s: 'Serve every opportunity; prep kids-coding material.', o: 'Serve consistently; teach coding where possible.', n: 'Serve consistently; teach coding where possible.', d: 'Serve faithfully; log sessions taught.' },
      { t: 'Demonstrate disciplined thinking, speech, conduct, and decision-making in everything I do. Measure: a daily 2-minute evening review, with a weekly score out of 10.', s: 'Start 2-min evening review; first weekly score.', o: 'Evening reviews daily; scores logged.', n: 'Evening reviews daily; scores logged.', d: 'Evening reviews daily; quarter summary.' },
      { t: 'Grow in practical obedience to God\u2019s Word. Measure: each week, write down 1 specific Scripture I obeyed in action, not just studied.', s: 'Log 1 obeyed Scripture (Sep 22-30).', o: 'Log 1 obeyed Scripture weekly (4-5).', n: 'Log 1 obeyed Scripture weekly (4-5).', d: 'Log weekly + quarter obedience summary.' },
    ],
  },

  {
    name: 'Academics and Research', weight: 20,
    smart: 'SMART GOAL \u2014 By December 31, 2026, I will complete WQU Course 2 (Financial Data) and send my transcript, and start 1 to 2 research projects in AI/ML for petroleum and energy systems or energy sustainability, taking at least one to a research question, literature review, methodology, dataset, and preliminary results, while studying at least 14 hours every week alongside work and NYSC.',
    goals: [
      { t: 'Complete WQU Course 2, Financial Data, by 31st October and submit/send my transcript as required by November 30.', s: 'WQU sprint daily; clear backlog modules.', o: 'COMPLETE Course 2 by Oct 31.', n: 'Transcript submitted/sent by Nov 30.', d: 'Confirm receipt; file records.' },
      { t: 'Start 1 to 2 research projects before the end of the year, with topics chosen by Oct 15. Areas: AI/ML in petroleum and energy systems; AI/ML in Finance; energy sustainability, gas utilization, methane/flaring, or CCUS.', s: 'Shortlist 2-3 candidate topics.', o: 'Topics LOCKED Oct 15; 1-2 projects started.', n: 'Both projects active; weekly reps.', d: 'Projects at milestone stages; quarter review.' },
      { t: 'Clear research question: by Oct 10.', s: 'Draft question + gap statement.', o: 'Question FINAL by Oct 10.', n: 'Question guides lit review + methods.', d: 'Question validated by results.' },
      { t: 'Literature review (at least 15-20 sources): by Oct 31.', s: 'Collect first 5 sources; reading log open.', o: '15-20 sources reviewed by Oct 31.', n: 'Gap analysis written from review.', d: 'Review cited in results note.' },
      { t: 'Methodology: by Nov 7.', s: 'Sketch method options.', o: 'Method draft ready for Nov 7.', n: 'Methodology FINAL by Nov 7.', d: 'Methods applied in results.' },
      { t: 'Dataset identified/collected: by Nov 21.', s: 'List candidate datasets.', o: 'Access requests sent.', n: 'Dataset identified/collected by Nov 21.', d: 'Dataset cleaned; documented.' },
      { t: 'Preliminary results: by Dec 20.', s: 'Define success metrics early.', o: 'Baseline runs attempted.', n: 'Analysis in progress.', d: 'Preliminary results by Dec 20 (tables/plots + note).' },
      { t: 'Identify and begin working with at least one potential research collaborator or supervisor. Target: contact at least 15 people by Oct 31, and have 1 actively engaged by Dec 1.', s: 'Build list; send first 5 messages.', o: 'All 15 contacts sent by Oct 31.', n: 'Nurture threads toward 1 engaged.', d: '1 collaborator engaged by Dec 1.' },
      { t: 'Continue building my mathematical, statistical, financial engineering, and programming foundations for my MSc and future research.', s: '14+ hrs study Sep 22-30 block.', o: '14+ hrs/week all October.', n: '14+ hrs/week all November.', d: '14+ hrs/week to Dec 31; review logged.' },
      { t: 'Make at least 3 scholarships and school applications each month (10 applications in total at least).', s: 'Shortlist schools; draft essays/CV.', o: '3 applications submitted.', n: '3+ submitted (total 6-7).', d: '3-4 submitted to reach 10+ total.' },
    ],
  },
  {
    name: 'Work and Practical Impact', weight: 15,
    smart: 'SMART GOAL \u2014 By December 31, 2026, I will maintain excellent standing in my current role, log measurable results monthly, secure a PPA aligned with my field by Nov 30, and launch an additional income stream by Nov 15.',
    goals: [
      { t: 'Maintain punctuality, accurate records, and professional conduct at my current workplace throughout the quarter.', s: 'Reset standards Sep 22-30.', o: 'Excellence holds all October.', n: 'Excellence holds all November.', d: 'Excellence holds to Dec 31.' },
      { t: 'Log measurable results and achievements at work at the end of each month (Oct, Nov, Dec), with numbers where possible.', s: 'Open results log; September baseline.', o: 'October results logged.', n: 'November results logged.', d: 'December + Q4 summary logged.' },
      { t: 'Secure a suitable PPA aligned with engineering, technology, research, AI/ML, or energy by Nov 30.', s: 'List target PPAs; start conversations.', o: 'Pursuit active; visits logged.', n: 'PPA SECURED by Nov 30.', d: 'Settle in; first-month wins logged.' },
      { t: 'Launch or grow an additional income stream that fits alongside work, NYSC, and academics. Identify options by Oct 15 and start by Nov 15.', s: 'List income options.', o: 'Options finalized Oct 15; prep.', n: 'Income stream STARTED by Nov 15.', d: 'First revenue/lessons reviewed.' },
      { t: 'Use the NYSC period strategically to gain experience, build relationships, and strengthen my professional profile.', s: 'Build 2-3 relationships; map goals.', o: 'Experience deepened.', n: 'Profile strengthened.', d: 'NYSC leverage review.' },
    ],
  },
  {
    name: 'Career and Professional Development', weight: 15,
    smart: 'SMART GOAL \u2014 By December 31, 2026, I will build 2 strong AI/ML or automation projects (first by Nov 15, second by Dec 20), document measurable results monthly, and update CV, LinkedIn, portfolio, research profile by Dec 20 (Petroleum Engineering, AI/ML, Energy Systems, Sustainability).',
    goals: [
      { t: 'Strengthen identity and positioning (Petroleum Engineering, Finance, AI/ML, Energy Systems, Sustainability). Deliverable: one-paragraph positioning statement by Oct 7, used across all profiles.', s: 'Draft the statement.', o: 'FINAL by Oct 7; live everywhere.', n: 'Echoed in outreach.', d: 'Reviewed with proof points.' },
      { t: 'Deliver measurable results in current role; document for CV and portfolio. Log results end of Oct, Nov, Dec with numbers.', s: 'September baseline captured.', o: 'October results logged.', n: 'November results logged.', d: 'December + Q4 proof logged.' },
      { t: 'Build at least 3 strong technical projects demonstrating practical AI/ML or automation in Energy, sustainability or finance.', s: 'Scope project 1.', o: 'Project 1 in build (target Nov 15).', n: 'SHIP project 1; project 2 in build.', d: 'SHIP project 2 (and 3rd if scoped) by Dec 20.' },
      { t: 'Improve ability to build and deploy production-level solutions with Python, SQL, AI/ML, automation, APIs, databases, modern web tech.', s: 'Track set; daily reps start.', o: 'Milestone 1 (API + DB live).', n: 'Milestone 2 (automation + frontend).', d: 'Demo shipped; skills review.' },
      { t: 'Update CV, LinkedIn, portfolio, research profile with strongest 2026 achievements. All four updated by Dec 20.', s: 'Audit all four; collect proof.', o: 'Draft updates ready.', n: 'Roll updates progressively.', d: 'All four UPDATED by Dec 20.' },
      { t: 'Develop relationships with professionals, researchers, mentors, organizations. At least 2 new meaningful connections per month, with follow-up.', s: 'Name 5 targets; start 2 conversations.', o: '2+ new connections + follow-ups.', n: '2+ new connections + follow-ups.', d: '2+ new connections; review.' },
      { t: 'Complete relevant certifications or solid structured knowledge in AI/automation, Finance, Sustainability and Energy.', s: 'Pick track(s); enroll.', o: 'Module block 1 done.', n: 'Module block 2 done.', d: 'Certification(s) logged.' },
    ],
  },


  {
    name: 'Personal Growth and Leadership', weight: 10,
    smart: 'SMART GOAL \u2014 By December 31, 2026, I will read 3 personal development books, engage in consistent leadership and mentoring activity, and document my growth every week.',
    goals: [
      { t: 'Read at least 3 leadership/personal development books by Dec 31, 2026. Target: 1 per month (Oct, Nov, Dec).', s: 'Choose Oct/Nov/Dec books; start Book 1.', o: 'FINISH Book 1.', n: 'FINISH Book 2.', d: 'FINISH Book 3 + notes review.' },
      { t: 'Maintain consistent evidence of ongoing work and learning, reviewed monthly.', s: 'Open evidence folder; log Sep 22-30.', o: 'Evidence reviewed Oct 31.', n: 'Evidence reviewed Nov 30.', d: 'Evidence reviewed Dec 31; Q4 summary.' },
      { t: 'Build meaningful relationships through intentional weekly engagement. At least 1 contact per week; list of key people by Oct 1.', s: 'Key-people list by Oct 1; first contact.', o: 'Weekly engagement (4-5 contacts).', n: 'Weekly engagement (4-5 contacts).', d: 'Weekly engagement; review.' },
      { t: 'Practice daily communication skills, seeking feedback where possible.', s: 'Daily reps start; ask 1 feedback.', o: 'Daily reps; feedback weekly.', n: 'Daily reps; feedback weekly.', d: 'Daily reps; growth review.' },
      { t: 'Continue mentoring and teaching where I can genuinely add value.', s: 'Name mentees; schedule sessions.', o: 'Mentoring rhythm holds.', n: 'Mentoring rhythm holds.', d: 'Mentoring impact review.' },
      { t: 'Document lessons, failures, achievements, areas for improvement. One entry every week Sunday.', s: 'First Sunday entry Sep 28.', o: 'Sunday entries (4-5).', n: 'Sunday entries (4-5).', d: 'Sunday entries + Q4 summary.' },
    ],
  },
  {
    name: 'Health, Order and Lifestyle Discipline', weight: 10,
    smart: 'SMART GOAL \u2014 Through December 31, 2026, I will keep a consistent sleep and wake-up routine, exercise 5-7 times per week (daily targets: 300 pushups, 50 situps + abs/core, 50 weight-lift reps minimum), and maintain daily order and discipline.',
    goals: [
      { t: 'Establish a consistent sleep and wake-up routine. Sleep for at least 5-6 hours daily.', s: 'Lock sleep/wake times.', o: 'Routine holds 31/31.', n: 'Routine holds 30/30.', d: 'Routine holds to Dec 31.' },
      { t: 'Exercise consistently: 5-7 sessions per week, 14 weeks. Daily targets of 300 pushups, 50 situps and abs/core, 50 reps of weight lifts at least.', s: 'Start 5-7x rhythm; targets begin.', o: '20+ sessions; progression logged.', n: '20+ sessions; progression.', d: 'Final 20+ sessions; Q4 summary.' },
      { t: 'Maintain daily hygiene, neatness, and order in my space and routines.', s: 'Reset space; routine set.', o: 'Order holds daily.', n: 'Order holds daily.', d: 'Order closes strong.' },
      { t: 'Reduce procrastination and unnecessary phone/social-media use. Limit social media and games screen time to less than 1 hr 30 mins.', s: 'Phone under 1h30; triggers listed.', o: 'Discipline holds; weekly audits.', n: 'Discipline holds; weekly audits.', d: 'Discipline holds; Q4 review.' },
      { t: 'Maintain disciplined food, spending, media, time, commitments. Weekly check on each area with yes/no.', s: 'First weekly yes/no check.', o: 'Weekly checks logged.', n: 'Weekly checks logged.', d: 'Checks + Q4 discipline score.' },
      { t: 'Practice clear communication, punctuality, reliability, excellence. 0 missed commitments without notice.', s: '0 missed Sep 22-30.', o: '0 missed without notice.', n: '0 missed without notice.', d: '0 missed; streak closed.' },
    ],
  },
  {
    name: 'Financial Stewardship', weight: 10,
    smart: 'SMART GOAL \u2014 By December 31, 2026, I will build and follow a monthly budget, save 100,000-125,000 monthly consistently, avoid unnecessary debt, tithe faithfully, and reach 500,000 savings by year-end.',
    goals: [
      { t: 'Track and review expenses monthly.', s: 'Start tracking Sep 22-30.', o: 'October tracking + review.', n: 'November tracking + review.', d: 'December + Q4 review.' },
      { t: 'Create a realistic monthly budget (transportation, food, accommodation, family obligations, giving, savings, professional development). In place by Sept 30; reviewed at month-end.', s: 'Budget IN PLACE by Sep 30.', o: 'Followed; month-end review.', n: 'Followed; month-end review.', d: 'Followed; Q4 review.' },
      { t: 'Save 100,000-125,000 monthly consistently every month. Minimum in each of Oct, Nov, Dec. Target of 500,000 at the end of the year.', s: 'Set Oct auto-transfer.', o: 'Save 100,000-125,000.', n: 'Save 100,000-125,000.', d: 'Save to reach 500,000.' },
      { t: 'Avoid unnecessary debt and borrowing where possible. Target: 0 new non-essential debt this quarter.', s: '0 new debt Sep 22-30.', o: '0 new non-essential debt.', n: '0 new non-essential debt.', d: '0 new debt; closed clean.' },
      { t: 'Tithe faithfully and consistently.', s: 'Tithe plan set.', o: 'Tithe paid.', n: 'Tithe paid.', d: 'Tithe paid; giving review.' },
      { t: 'Invest in tools and resources that directly increase earning capacity or professional value. Each purchase tied to a specific goal.', s: 'Needs list tied to goals.', o: 'Goal-tied purchases only.', n: 'Goal-tied purchases only.', d: 'ROI review on purchases.' },
    ],
  },
]
