'use client'

import { ArrowDownToLine, Globe2, MapPin, SlidersHorizontal } from 'lucide-react'
import { cx, inputClass } from '@/components/ds'
import {
  BLANK_SECTION, SECTIONS, effectiveSection, parseSections,
  type MainProfile, type SectionMode, type SectionPrefs, type SectionScope, type SectionType,
} from '@/lib/scoutSections'

/**
 * The Opportunity Cloud's sections editor (inside Scout settings).
 *
 * Choose which sections to look for, then how they get their wants:
 *   Flow to every section   your profile (what you want, education, expertise) drives them all
 *   Tailor each section     any section can set its own goal, field, expertise, level and
 *                           local/global; one left on "Flow from my profile" keeps the main profile
 * Each card says, in plain words, what that section will actually search for.
 */
export function ScoutSections({
  profile,
  onChange,
}: {
  profile: MainProfile & { homeCountry: string }
  onChange: (next: { types?: string; sectionMode?: SectionMode; sections?: Partial<Record<SectionType, SectionPrefs>> }) => void
}) {
  const on = profile.types.split(',').filter(Boolean)
  const mode: SectionMode = profile.sectionMode === 'tailored' ? 'tailored' : 'flow'
  const sections = parseSections(profile.sections)
  const prefs = (t: SectionType) => sections[t] ?? BLANK_SECTION
  const setPrefs = (t: SectionType, patch: Partial<SectionPrefs>) => onChange({ sections: { ...sections, [t]: { ...prefs(t), ...patch } } })
  const toggleType = (t: string) => onChange({ types: (on.includes(t) ? on.filter((x) => x !== t) : [...on, t]).join(',') })

  return (
    <fieldset className="space-y-3">
      <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/50">Sections</legend>

      {/* How sections get their wants */}
      <div role="radiogroup" aria-label="How sections are set" className="grid gap-2 sm:grid-cols-2">
        {([
          ['flow', ArrowDownToLine, 'Flow to every section', 'Your profile above drives every section. Simplest.'],
          ['tailored', SlidersHorizontal, 'Tailor each section', 'Give a section its own goal, field, expertise, level and local or global.'],
        ] as const).map(([value, Icon, title, body]) => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => onChange({ sectionMode: value })}
            className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition-colors', mode === value ? 'border-gold/60 bg-gold/[0.08]' : 'border-gold/15 hover:border-gold/35')}>
            <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', mode === value ? 'text-gold' : 'text-parchment/45')} aria-hidden />
            <span>
              <span className={cx('block text-sm font-semibold', mode === value ? 'text-gold' : 'text-parchment')}>{title}</span>
              <span className="block text-caption text-parchment/55">{body}</span>
            </span>
          </button>
        ))}
      </div>

      {/* One card per section */}
      <ul className="grid gap-2 lg:grid-cols-2">
        {SECTIONS.map((s) => {
          const enabled = on.includes(s.type)
          const p = prefs(s.type)
          const tailored = mode === 'tailored' && p.custom
          const eff = effectiveSection(profile, s.type)
          const summary = [eff.goal, eff.field, eff.expertise].filter(Boolean).join(' · ')
          return (
            <li key={s.type} className={cx('rounded-xl border p-3 transition-colors', enabled ? 'border-gold/25 bg-surface-solid' : 'border-gold/10 opacity-70')}>
              <div className="flex items-center gap-2">
                <label className="flex min-h-9 flex-1 cursor-pointer items-center gap-2 text-sm font-semibold text-parchment">
                  <input type="checkbox" checked={enabled} onChange={() => toggleType(s.type)} className="h-4 w-4 accent-[rgb(var(--gold-rgb))]" />
                  {s.label}
                </label>
                {enabled && mode === 'tailored' && (
                  <div className="flex rounded-lg border border-gold/15 p-0.5 text-[11px]" role="group" aria-label={`${s.label}: where its wants come from`}>
                    {([[false, 'Flow from profile'], [true, 'Set for this section']] as const).map(([custom, label]) => (
                      <button key={label} type="button" aria-pressed={p.custom === custom} onClick={() => setPrefs(s.type, { custom })}
                        className={cx('rounded-md px-2 py-1 font-medium transition-colors', p.custom === custom ? 'bg-gold/15 text-gold' : 'text-parchment/55 hover:text-parchment')}>{label}</button>
                    ))}
                  </div>
                )}
              </div>

              {enabled && !tailored && (
                <p className="mt-1 pl-6 text-caption text-parchment/50">
                  <ArrowDownToLine className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />
                  {summary ? <>Flows from your profile: <span className="text-parchment/70">{summary}</span></> : 'Flows from your profile (fill it in above).'}
                </p>
              )}

              {enabled && tailored && (
                <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">
                  <input value={p.goal} onChange={(e) => setPrefs(s.type, { goal: e.target.value })} aria-label={`${s.label}: what you want`}
                    placeholder={profile.interests ? `What you want (else: ${profile.interests.slice(0, 40)})` : 'What you want from this section'} className={cx(inputClass, 'sm:col-span-2')} />
                  <input value={p.field} onChange={(e) => setPrefs(s.type, { field: e.target.value })} aria-label={`${s.label}: field or education`}
                    placeholder={profile.education ? `Field (else: ${profile.education.slice(0, 30)})` : 'Field / area of study'} className={inputClass} />
                  <input value={p.expertise} onChange={(e) => setPrefs(s.type, { expertise: e.target.value })} aria-label={`${s.label}: expertise`}
                    placeholder={profile.expertise ? `Expertise (else: ${profile.expertise.slice(0, 30)})` : 'Expertise to match on'} className={inputClass} />
                  <input value={p.level} onChange={(e) => setPrefs(s.type, { level: e.target.value })} aria-label={`${s.label}: level`}
                    placeholder={`Level, ${s.levelHint}`} className={inputClass} />
                  <div className="flex gap-1 rounded-xl border border-gold/15 p-1" role="group" aria-label={`${s.label}: local or global`}>
                    {([['both', 'Both', null], ['local', 'Local', MapPin], ['global', 'Global', Globe2]] as [SectionScope, string, typeof MapPin | null][]).map(([v, label, Icon]) => (
                      <button key={v} type="button" aria-pressed={p.scope === v} onClick={() => setPrefs(s.type, { scope: v })}
                        className={cx('inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors', p.scope === v ? 'bg-gold/15 text-gold' : 'text-parchment/55 hover:text-parchment')}>
                        {Icon && <Icon className="h-3 w-3" aria-hidden />}{label}
                      </button>
                    ))}
                  </div>
                  <p className="text-caption text-parchment/45 sm:col-span-2">
                    Leave a box empty and it uses your profile. {p.scope === 'local' ? `Only opportunities in or for ${profile.homeCountry}.` : p.scope === 'global' ? `Only international ones.` : ''}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
