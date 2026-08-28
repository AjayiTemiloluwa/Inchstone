/**
 * Shared label-resolver for the cursor/touch hint pills.
 * Resolves a short "what does this do" instruction for any interactive
 * element, in priority order:
 *   1. data-cursor="…"            — hand-written playful copy
 *   2. aria-label                 — the accessible name (free coverage)
 *   3. title                      — native tooltips
 *   4. placeholder (inputs only)  — field hints
 */
export function resolveHintLabel(hit: Element | null): string {
  if (!hit) return ''
  const e = hit as HTMLElement
  return (
    e.getAttribute('data-cursor') ||
    e.getAttribute('aria-label') ||
    e.getAttribute('title') ||
    (e.tagName === 'INPUT' ? e.getAttribute('placeholder') : null) ||
    ''
  )
}

/** Elements the hint layers treat as interactive. */
export const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, select, textarea, summary, [data-cursor]'
