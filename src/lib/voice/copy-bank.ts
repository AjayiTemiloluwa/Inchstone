import type { CopyBank } from './types'

/**
 * VOICE_BANK — every recurring bit of user-facing copy, keyed by VoiceKey
 * and time band. Design/agents add lines here without touching any logic.
 *
 * Time bands mirror the atmosphere engine's TimeOfDay (single source of truth):
 *   dawn (5–7) · morning (7–11) · noon (11–14) · afternoon (14–17)
 *   dusk (17–20) · night (20–5)
 *
 * A key can omit bands it doesn't warrant and rely on `any` instead.
 * Rule of thumb: 2–3 lines per band so the same surface never repeats in a
 * row; `any` for lines that are time-independent.
 */
export const VOICE_BANK: CopyBank = {
  /* ── Loading lines ─────────────────────────────────────────────── */
  'loading.calendar': {
    dawn: ['First light on your schedule…', 'Waking the calendar up…'],
    morning: ['Brewing today’s schedule…', 'Spreading out the day…'],
    noon: ['Pulling up the day so far…', 'Syncing the timeline…'],
    afternoon: ['Arranging the afternoon…', 'Filing the day’s work…'],
    dusk: ['Wrapping today into view…', 'Tallying today’s events…'],
    night: ['Sneaking a peek at tomorrow…', 'Calendar’s under the covers, one sec…'],
  },
  'loading.day': {
    dawn: ['Setting the stage for today…', 'First deeds, unfolding…'],
    morning: ['Laying out your deeds…', 'Finding today’s thread…'],
    noon: ['Midday — refocusing the list…', 'Straightening the timeline…'],
    afternoon: ['Winding down the tasks…', 'Locking in this afternoon…'],
    dusk: ['Gathering the day’s deeds…', 'Counting what got done…'],
    night: ['Filing today’s close…', 'Quietly putting the day to bed…'],
  },
  'loading.week': {
    any: ['Sketching the week ahead…', 'Laying the week’s stones…'],
  },
  'loading.month': {
    any: ['Carving the month…', 'Stepping through the month…'],
  },
  'loading.quarter': {
    any: ['Surveying the quarter…', 'Aligning the quarter…'],
  },
  'loading.year': {
    dawn: ['A fresh page of the year…', 'Opening the year lightly…'],
    morning: ['Spreading the year before you…', 'Mind the year’s arc…'],
    noon: ['Midyear at a glance…', 'Year in full stride…'],
    afternoon: ['The year, so far…', 'Year surveying in the afternoon light…'],
    dusk: ['Gathering the year’s glow…', 'The year at close of day…'],
    night: ['The whole year under starlight…', 'A quiet look across the year…'],
  },
'loading.goal': {
    any: ['Polishing this goal…', 'Inching the goal forward…', 'Checking the milestone…'],
  },
  'loading.finance': {
    any: ['Balancing the ledger…', 'Counting the purses…', 'Reconciling the sums…'],
  },
  'loading.notes': {
    any: ['Unfolding your notes…', 'Gathering the page…'],
  },
  'loading.partners': {
    any: ['Fetching messages…', 'Finding your partners…'],
  },
  'loading.reports': {
    any: ['Setting up the report…', 'Laying out the numbers…'],
  },
  'loading.plans': {
    any: ['Spreading the plan…', 'Assembling the sections…'],
  },
  'loading.dashboard': {
    any: ['Compass righting north…', 'Gathering your quiet progress…'],
  },
  'loading.reviews': {
    any: ['Reopening the review…', 'Gathering last week’s reflections…'],
  },
  'loading.settings': {
    any: ['Tuning the dials…', 'Arranging your preferences…'],
  },
  'loading.year-quarter': {
    any: ['Opening the quarter…', 'Quarter by quarter…'],
  },
  'loading.year-quarter-month': {
    any: ['Zooming to the month…', 'Narrowing to the page…'],
  },
  'loading.year-quarter-month-week': {
    any: ['Down to the week…', 'Rounding on this week…'],
  },

  /* ── Empty states ─────────────────────────────────────────────── */
  'empty.calendar': {
    any: ['Nothing scheduled yet — the page is open.'],
  },
  'empty.day': {
    morning: ['No deeds set for today. Add one, or open the week to plan ahead.'],
    any: ['The day is unwritten — start with a single honest deed.'],
  },
  'empty.week': {
    any: ['Nothing planned this week yet. The week is a blank ledger.'],
  },
  'empty.goals': {
    any: ['No goals here yet. Click + to set your first milestone.'],
  },
  'empty.hierarchy': {
    any: ['Nothing in this pocket yet. Add a goal and give it a next step.'],
  },
  'empty.notes': {
    any: ['Nothing written yet — a single honest sentence today is enough.'],
  },
  'empty.reviews': {
    any: ['Nothing reviewed yet — a short honest review is a good place to start.'],
  },
  'empty.finance': {
    any: ['No transactions yet. The purse starts at zero — and zero is a fine place.'],
  },
  'empty.plans': {
    any: ['This plan is an empty shell, ready to fill.'],
  },
  'empty.partners': {
    any: ['No partners yet — add someone to walk the year with.'],
  },

  /* ── Confirmations (destructive / cascade) ────────────────────── */
  'confirm.deleteCascade': {
    any: ['Delete this? All nested goals underneath will be removed too.'],
  },
  'confirm.deleteGoal': {
    any: ['Delete this goal, its milestones and their history?'],
  },
  'confirm.deleteMilestone': {
    any: ['Delete this milestone and trace it from the record?'],
  },
  'confirm.deleteSection': {
    any: ['Remove this section with all its goals and milestones?'],
  },
  'confirm.deleteTransaction': {
    any: ['Remove this transaction from the ledger?'],
  },
  'confirm.deleteCategory': {
    any: ['Delete this category? Its transactions will be freed.'],
  },
  'confirm.deleteHabitAll': {
    any: ['Delete every instance of this habit, including the past? This cannot be undone.'],
  },
  'confirm.unlink': {
    any: ['Unlink this partner? You can link them again later.'],
  },
/* ── Toasts ───────────────────────────────────────────────────── */
  'toast.changesSaved': {
    any: ['Saved.', 'Changes saved.', 'Done — noted.'],
  },
  'toast.deleted': {
    any: ['Deleted.', 'Removed.', 'Gone.'],
  },
  'toast.deedAdded': {
    any: ['Deed added.', 'Added to the day.', 'One more deed on the ledger.'],
  },
  'toast.habitAdded': {
    any: ['Habit added for every day going forward.', 'Repeats daily from now on.'],
  },
  'toast.streakContinued': {
    any: ['Streak continues — keep the line unbroken.', 'Another day on the chain.'],
  },
  'toast.pdfGenerated': {
    any: ['PDF downloaded successfully.', 'Your report is on its way.'],
  },
  'toast.categoryCreated': {
    any: ['Category saved.', 'Category locked in.'],
  },

  /* ── Celebrations ─────────────────────────────────────────────── */
  'celebrate.perfectDay': {
    any: ['A perfect day.', 'Every deed done — well done.', 'The whole day, complete.'],
  },
  'celebrate.milestoneComplete': {
    any: ['Milestone reached.', 'A stone set in place.', 'That step is behind you.'],
  },

  /* ── Nudges ───────────────────────────────────────────────────── */
  'nudge.behindOnWeek': {
    any: ['The week is drifting — pull one small deed back into today.'],
  },
  'nudge.aheadOfWeek': {
    any: ['Ahead of the week — protect the pace, don’t overbook.'],
  },
}