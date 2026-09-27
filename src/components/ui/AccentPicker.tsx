'use client'

import { useEffect, useState } from 'react'
import { Check, Palette, Pipette, RotateCcw } from 'lucide-react'
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_ID,
  applyAccent,
  applyStoredAccent,
  choiceHex,
  customChoice,
  mixAccent,
  readableOn,
  type AccentChoice,
} from '@/lib/accent'

/**
 * AccentPicker — the Settings "Accent" control: the mixing palette on one row,
 * a real colour picker (plus a hex field) for anything else.
 *
 * An accent is applied by writing the --gold* variables inline on <html> (see
 * lib/accent.ts), so every interaction re-hues the whole app instantly — the
 * preview strip is a courtesy, not the only feedback. The choice survives
 * reloads, and the derived paper/ink mixes swap automatically with the theme.
 */
export function AccentPicker() {
  // null until mount: the server can't know the stored choice, and the palette
  // swatches themselves are static, so nothing flashes.
  const [choice, setChoice] = useState<AccentChoice | null>(null)
  const [dark, setDark] = useState(true)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const root = document.documentElement
    // Re-assert the stored accent (the boot script painted pre-hydration) and
    // stay in step with the theme switch, which flips the class on <html>.
    const sync = () => {
      const stored = applyStoredAccent()
      setChoice(stored)
      setDark(root.classList.contains('dark'))
      setDraft(choiceHex(stored).toUpperCase())
    }
    const raf = requestAnimationFrame(sync)
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  const adopt = (next: AccentChoice) => {
    setChoice(next)
    setDraft(choiceHex(next).toUpperCase())
    applyAccent(next)
  }

  const activeId =
    choice?.kind === 'preset' ? choice.id : choice?.kind === 'custom' ? 'custom' : DEFAULT_ACCENT_ID
  const activePreset = ACCENT_PRESETS.find(preset => preset.id === activeId)
  const mix = mixAccent(choiceHex(choice ?? { kind: 'default' }), dark)
  const onAccent = readableOn(mix.accent)
  const trio = [
    { label: 'Accent', value: mix.accent },
    { label: 'At rest', value: mix.rest },
    { label: 'Lift', value: mix.lift },
  ]

  const commitDraft = () => {
    const next = customChoice(draft)
    if (next) adopt(next)
    else setDraft(choiceHex(choice ?? { kind: 'default' }).toUpperCase())
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-heading text-parchment flex items-center gap-2">
          <Palette className="w-4 h-4 text-gold-dim" strokeWidth={1.5} />
          <span>Accent</span>
        </h3>
        <p className="mt-1 text-sm text-parchment/55">
          One colour drives every button, hairline and highlight in Inchstone. Take it from the
          mixing palette, or adopt your own.
        </p>
      </div>

      {/* The mixing palette */}
      <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Mixing palette">
        {ACCENT_PRESETS.map(preset => {
          const swatch = mixAccent(preset.hex, dark).accent
          const active = activeId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => adopt({ kind: 'preset', id: preset.id })}
              aria-pressed={active}
              aria-label={preset.name}
              title={preset.name}
              data-cursor={preset.hint}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-transform ${
                active ? 'scale-110 border-parchment/70' : 'border-gold-dim/30 hover:scale-105'
              }`}
              style={{ backgroundColor: swatch }}
            >
              {active && (
                <Check className="h-4 w-4" strokeWidth={2.5} style={{ color: readableOn(swatch) }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Adopt your own — a real colour picker, plus a hex field for pasting */}
      <div className="flex flex-wrap items-center gap-3 border-t border-gold-dim/20 pt-4">
        <span className="text-xs text-parchment/45">Mix your own</span>

        <label
          className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center"
          data-cursor="Pick any colour"
        >
          <input
            type="color"
            aria-label="Pick any accent colour"
            value={choice?.kind === 'custom' ? choice.hex : mix.accent}
            onChange={event => {
              const next = customChoice(event.target.value)
              if (next) adopt(next)
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            className="pointer-events-none absolute inset-0 rounded-full border border-gold-dim/40"
            style={{ backgroundColor: mix.accent }}
          />
          <Pipette
            className="pointer-events-none absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-parchment/70"
            strokeWidth={1.5}
          />
        </label>

        <input
          type="text"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft()
            }
          }}
          placeholder="#B8935A"
          spellCheck={false}
          aria-label="Accent hex code"
          data-cursor="Type a hex"
          className="w-[110px] rounded-md border hairline bg-transparent px-2.5 py-1.5 font-mono text-xs uppercase tracking-wide text-parchment outline-none transition-colors placeholder:text-parchment/30 focus:border-gold"
        />

        {activeId !== DEFAULT_ACCENT_ID && (
          <button
            type="button"
            onClick={() => adopt({ kind: 'default' })}
            data-cursor="Back to brass"
            className="inline-flex items-center gap-1.5 rounded-md border hairline px-3 py-1.5 text-xs text-parchment/70 transition-colors hover:border-gold hover:text-parchment"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            Brass
          </button>
        )}
      </div>

      {/* What the mix actually looks like */}
      <div className="rounded-lg border hairline p-3">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mix.accent }} />
          <span className="text-sm font-semibold text-gold">
            {activeId === 'custom' ? 'Custom' : activePreset?.name ?? 'Brass'}
          </span>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-wide text-parchment/45">
            {mix.accent.toUpperCase()}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {trio.map(step => (
            <div key={step.label}>
              <div className="h-8 rounded-md border hairline" style={{ backgroundColor: step.value }} />
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-parchment/40">
                {step.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span
            className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold"
            style={{ color: onAccent }}
          >
            Button
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-gold-dim">
            Icon
            <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
          </span>
          <span className="ml-auto rounded-md border border-gold/40 px-3 py-1.5 text-xs text-parchment/70">
            Hairline
          </span>
        </div>
      </div>
    </div>
  )
}
