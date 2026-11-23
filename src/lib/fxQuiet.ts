/**
 * Quiet zones for the app-wide touch effects (fluid glyphs, touch streaks, ripples, glow).
 *
 * Anything inside an element marked `data-fx-quiet` is a control that needs every frame for
 * itself — e.g. the paint wheel (components/fun/PaintDrops.tsx), which you spin with a finger.
 * Effects call `isFxQuiet(event)` first and skip the event, so they don't redraw the page on
 * every finger movement while that control is being used.
 */
export const FX_QUIET_ATTR = 'data-fx-quiet'

export function isFxQuiet(e: Event): boolean {
  const t = e.target as Element | null
  return !!t && typeof t.closest === 'function' && !!t.closest(`[${FX_QUIET_ATTR}]`)
}
