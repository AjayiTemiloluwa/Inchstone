/**
 * Semantic 5-layer model — the brief's hierarchy:
 *   Why → Quarterly Quest → Monthly Milestone → Weekly Win → Daily Deed
 *
 * The legacy schema stores 7 integers on `item.layer`:
 *   0 Year · 1 Category · 2 Yearly · 3 Quarter · 4 Month · 5 Week · 6 Day.
 * Rather than a destructive renumber, we keep the stored integers and PROJECT
 * them onto the 5 layers here, so the whole UI speaks the 5-layer language.
 * See `scripts/renumber-layers.sql` for the optional hard migration.
 *
 * NOTE on the legacy 5/6 ambiguity: the seed creates 5=Week and 6=Day, and the
 * brief's "Daily Deed" is the day (6). Some legacy readers (calendar / daily-score)
 * sampled 5 as "deeds" — those should be normalized to 6 as pages adopt this model.
 */

export const LAYERS = {
  WHY: 1,
  QUEST: 2,
  MILESTONE: 3,
  WIN: 4,
  DEED: 5,
} as const

export type Layer = (typeof LAYERS)[keyof typeof LAYERS]

/** Ring order matches the compass: outer = Why ... innermost = Deed. */
export const LAYER_ORDER: Layer[] = [LAYERS.WHY, LAYERS.QUEST, LAYERS.MILESTONE, LAYERS.WIN, LAYERS.DEED]

export const LAYER_META: Record<
  Layer,
  { key: string; label: string; short: string; legacy: number }
> = {
  [LAYERS.WHY]: { key: 'why', label: 'Why', short: 'WHY', legacy: 1 },
  [LAYERS.QUEST]: { key: 'quest', label: 'Quarterly Quest', short: 'QUEST', legacy: 3 },
  [LAYERS.MILESTONE]: { key: 'milestone', label: 'Monthly Milestone', short: 'MILESTONE', legacy: 4 },
  [LAYERS.WIN]: { key: 'win', label: 'Weekly Win', short: 'WIN', legacy: 5 },
  [LAYERS.DEED]: { key: 'deed', label: 'Daily Deed', short: 'DEED', legacy: 6 },
}

/** Project a stored legacy layer integer onto the 5-layer model. */
export function toLayer(legacyLayer: number): Layer {
  if (legacyLayer <= 2) return LAYERS.WHY // 0 Year · 1 Category · 2 Yearly
  if (legacyLayer === 3) return LAYERS.QUEST
  if (legacyLayer === 4) return LAYERS.MILESTONE
  if (legacyLayer === 5) return LAYERS.WIN
  return LAYERS.DEED // 6 (and anything ≥ 6)
}

export function layerLabel(legacyLayerOrSemantic: number): string {
  return LAYER_META[toLayer(legacyLayerOrSemantic)].label
}

export function layerShort(legacyLayerOrSemantic: number): string {
  return LAYER_META[toLayer(legacyLayerOrSemantic)].short
}