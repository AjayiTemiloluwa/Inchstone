/**
 * Opportunity Cloud sections — scholarships, fellowships, jobs, internships, grants, admissions,
 * competitions — each with its own idea of what the person wants.
 *
 * Two modes (ScoutProfile.sectionMode):
 *   flow      the main profile (what you want, education, expertise) flows down to every section
 *   tailored  a section may set its own goal / field / expertise / level / local-global;
 *             a section left "flowing" (custom = false) still takes the main profile
 * `effectiveSection` resolves what one section actually searches and scores with. Pure: used by
 * the scout (server) and the settings preview (client) alike.
 */

export const SECTIONS = [
  { type: 'scholarship', label: 'Scholarships', short: 'Scholarship', levelHint: "e.g. Master's, PhD, undergraduate" },
  { type: 'fellowship', label: 'Fellowships', short: 'Fellowship', levelHint: 'e.g. early-career, mid-career, postdoc' },
  { type: 'job', label: 'Jobs', short: 'Job', levelHint: 'e.g. entry-level, mid-level, senior, remote' },
  { type: 'internship', label: 'Internships', short: 'Internship', levelHint: 'e.g. summer, graduate, paid' },
  { type: 'grant', label: 'Grants & funding', short: 'Grant', levelHint: 'e.g. research grant, startup funding' },
  { type: 'school', label: 'Admissions', short: 'Admission', levelHint: "e.g. MSc, MBA, PhD programme" },
  { type: 'competition', label: 'Competitions & awards', short: 'Competition', levelHint: 'e.g. hackathon, essay prize' },
] as const

export type SectionType = (typeof SECTIONS)[number]['type']
export type SectionScope = 'both' | 'local' | 'global'
export type SectionMode = 'flow' | 'tailored'

export interface SectionPrefs {
  /** Tailored for this section; false = flows from the main profile. */
  custom: boolean
  goal: string
  field: string
  expertise: string
  level: string
  scope: SectionScope
}

export interface MainProfile {
  interests: string
  education: string
  expertise: string
  sectionMode: string
  sections: unknown
  types: string
}

export const BLANK_SECTION: SectionPrefs = { custom: false, goal: '', field: '', expertise: '', level: '', scope: 'both' }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Clean whatever was stored or sent into a well-formed map (unknown types and fields dropped). */
export function parseSections(raw: unknown): Partial<Record<SectionType, SectionPrefs>> {
  const out: Partial<Record<SectionType, SectionPrefs>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const s of SECTIONS) {
    const v = (raw as Record<string, unknown>)[s.type]
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    out[s.type] = {
      custom: o.custom === true,
      goal: str(o.goal, 500),
      field: str(o.field, 200),
      expertise: str(o.expertise, 300),
      level: str(o.level, 120),
      scope: o.scope === 'local' || o.scope === 'global' ? o.scope : 'both',
    }
  }
  return out
}

export const enabledTypes = (p: Pick<MainProfile, 'types'>) => p.types.split(',').map((t) => t.trim()).filter(Boolean)

export interface Effective {
  type: SectionType
  label: string
  /** Where these preferences came from: the section itself, or the main profile flowing down. */
  from: 'section' | 'profile'
  goal: string
  field: string
  expertise: string
  level: string
  scope: SectionScope
}

/** What one section searches and scores with. Blank tailored fields fall back to the main profile. */
export function effectiveSection(p: MainProfile, type: SectionType): Effective {
  const meta = SECTIONS.find((s) => s.type === type)!
  const own = parseSections(p.sections)[type]
  const tailored = p.sectionMode === 'tailored' && own?.custom
  return {
    type,
    label: meta.label,
    from: tailored ? 'section' : 'profile',
    goal: (tailored && own.goal) || p.interests,
    field: (tailored && own.field) || p.education,
    expertise: (tailored && own.expertise) || p.expertise,
    level: tailored ? own.level : '',
    scope: tailored ? own.scope : 'both',
  }
}

/** Every enabled section, resolved. */
export function effectiveSections(p: MainProfile): Effective[] {
  const on = new Set(enabledTypes(p))
  return SECTIONS.filter((s) => on.has(s.type)).map((s) => effectiveSection(p, s.type))
}

/** One line describing a section's wants, for the AI and for the settings preview. */
export function describe(e: Effective): string {
  return [
    e.goal && `wants: ${e.goal}`,
    e.field && `field/education: ${e.field}`,
    e.expertise && `expertise: ${e.expertise}`,
    e.level && `level: ${e.level}`,
    e.scope !== 'both' && `${e.scope} only`,
  ].filter(Boolean).join('; ') || 'nothing specific given; judge general usefulness'
}

/** Search queries for one section (the scout spreads its budget across sections). */
export function sectionQueries(e: Effective, country: string, per = 2): string[] {
  const year = new Date().getFullYear()
  const kind = e.type === 'school' ? 'admission programme' : e.type === 'grant' ? 'grant funding' : e.type
  const topics = [e.goal, e.field, e.expertise].flatMap((t) => t.split(/[,;\n]/)).map((t) => t.trim()).filter(Boolean)
  const level = e.level ? `${e.level} ` : ''
  const qs: string[] = []
  if (topics[0]) qs.push(`${level}${topics[0]} ${kind} ${year} apply deadline`)
  if (e.scope === 'local') qs.push(`${level}${kind} in ${country} ${year} application open`)
  else if (e.scope === 'global') qs.push(`international ${level}${kind} ${year} ${topics[1] ?? topics[0] ?? ''} open to ${country} applicants`.replace(/\s+/g, ' '))
  else qs.push(`${level}${kind} ${year} ${topics[1] ?? ''} for ${country} applicants`.replace(/\s+/g, ' '))
  if (!topics[0]) qs.push(`${e.type === 'scholarship' ? 'fully funded ' : ''}${level}${kind} ${year} ${year + 1} apply`)
  return qs.slice(0, per)
}
