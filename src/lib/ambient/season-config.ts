/**
 * season-config.ts — climate-aware season model.
 *
 * Inchstone's default user base is in Lagos / Southern Nigeria (tropical,
 * wet-dry climate, with a dusty harmattan period Dec–Feb), so the hardcoded
 * four-season Western model is wrong here. This file makes the season model
 * CONFIGURABLE (not hardcoded logic): to support another climate, swap in a
 * different SeasonConfig object — no logic changes needed.
 */

export type Season = 'dry' | 'wet'

export interface SeasonBand {
  season: Season
  /** Inclusive month range, 0-based (Jan = 0). `from > to` wraps the year, e.g. Dec(11)–Feb(1). */
  from: number
  to: number
  /** Harmattan / dusty-haze marker for the dry season (adds a faint haze layer). */
  haze?: boolean
}

export interface SeasonConfig {
  /** Human label for the model, e.g. 'tropical-wet-dry' (Lagos default). */
  climate: string
  /** Ordered band list; the first band containing the month wins. */
  bands: SeasonBand[]
}

export interface SeasonResult {
  season: Season
  haze: boolean
}

/**
 * Lagos / Southern Nigeria default:
 *   · wet season  — Apr(3)–Sep(8), heavy rain, greener/cooler palette
 *   · dry season  — Oct(9)–Mar(2); harmattan haze widens over Dec(11)–Feb(1)
 * Months not matched explicitly fall through to the default dry, no haze.
 */
export const DEFAULT_SEASON_CONFIG: SeasonConfig = {
  climate: 'tropical-wet-dry',
  bands: [
    { season: 'wet', from: 3, to: 8 },                 // Apr–Sep
    { season: 'dry', from: 11, to: 1, haze: true },    // Dec–Feb harmattan
  ],
}

/** True when `month` falls inside an inclusive (possibly year-wrapping) range. */
function inRange(month: number, from: number, to: number): boolean {
  return from <= to ? month >= from && month <= to : month >= from || month <= to
}

/** Resolve the season (and harmattan haze flag) for a 0-based month. */
export function seasonForMonth(
  month: number,
  config: SeasonConfig = DEFAULT_SEASON_CONFIG,
): SeasonResult {
  for (const band of config.bands) {
    if (inRange(month, band.from, band.to)) {
      return { season: band.season, haze: !!band.haze }
    }
  }
  return { season: 'dry', haze: false }
}