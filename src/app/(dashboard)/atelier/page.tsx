'use client'

/**
 * /atelier — living showcase for the GL rig (GLProvider/GLText/GLShape).
 *
 * Every display glyph and plane below is drawn by WebGL, mirrored from
 * hidden DOM anchors — the same architecture as dion's BaseText/BaseShape.
 * If WebGL is unavailable or the user prefers reduced motion, the client
 * never boots and the DOM mirrors simply stay visible: the page degrades
 * to a normal, perfectly readable document.
 *
 * Scroll, resize and parallax all run through the provider's frame loop.
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GLText } from '@/components/gl/GLText'
import { GLShape } from '@/components/gl/GLShape'

const IDEA_COPY = [
  'This page is rendered twice. Once by the browser, once by the GPU. Every heading and rule of copy you see is an SDF text mesh or a shader plane, mirrored in real time from a hidden DOM twin that keeps the layout, the accessibility tree and the SEO intact.',
  'Scrolling does not move the canvas. The canvas never moves at all — the meshes inside it ride the app scroll every frame, re-projected from their anchors the way a camera rides a dolly. Resize the window and the whole scene re-measures from the DOM.',
  'Typography is not approximated. Size, leading, tracking, alignment, casing and color are read from the computed styles of the mirror itself, so the GL glyphs are pixel-faithful to the CSS they replace.',
]

const SPECIMENS: Array<{ label: string; text: string; className: string; font?: string }> = [
  {
    label: 'Display / 700',
    text: 'The Unhurried Year',
    className: 'font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.08] text-parchment',
  },
  {
    label: 'Display / medium',
    text: 'Inchstones over milestones.',
    className: 'font-display text-[clamp(1.4rem,3vw,2.1rem)] leading-[1.15] text-parchment/90',
  },
  {
    label: 'Mono / explicit font file',
    text: 'eat the frog · 06:00',
    className: 'font-mono text-sm tracking-[0.18em] text-gold uppercase',
    font: '/fonts/JetBrainsMono-Regular.woff',
  },
]

export default function AtelierPage() {
  return (
    <div className="mx-auto max-w-3xl pb-28">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="pt-8 pb-14 sm:pt-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-parchment/40 transition hover:text-parchment/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>

        <h1 className="mt-8 font-display text-[clamp(2.8rem,7vw,4.9rem)] leading-[1.04] text-parchment">
          <GLText as="span" text="Craft," className="block" />
          <GLText as="span" text="rendered." className="block text-gold" />
        </h1>

        <GLText
          text="A small museum of the WebGL rig — text meshes, shader planes, parallax layers and true depth, all mirrored from the DOM below."
          className="mt-6 block max-w-xl text-[15px] leading-relaxed text-parchment/60"
        />
      </header>

      {/* ── The Idea ───────────────────────────────────────────── */}
      <section className="border-t border-white/10 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">
          01 — The Idea
        </p>
        <div className="mt-6 space-y-5">
          {IDEA_COPY.map((paragraph, i) => (
            <GLText
              key={i}
              text={paragraph}
              className="block text-[15px] leading-[1.75] text-parchment/75"
            />
          ))}
        </div>
      </section>

      {/* ── Specimens ──────────────────────────────────────────── */}
      <section className="border-t border-white/10 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">
          02 — Type Specimens
        </p>
        <div className="mt-8 space-y-10">
          {SPECIMENS.map(s => (
            <div key={s.label}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parchment/35">
                {s.label}
              </p>
              <GLText
                text={s.text}
                font={s.font}
                className={`mt-3 block ${s.className}`}
              />
            </div>
          ))}
        </div>
        {/* Static DOM rule drawn as a GL plane — the tint comes from CSS */}
        <GLShape className="mt-10 block h-px w-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.45)' }} />
      </section>

      {/* ── Layers — parallax planes ───────────────────────────── */}
      <section className="border-t border-white/10 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">
          03 — Parallax Layers
        </p>
        <GLText
          text="Three solid planes, one tint each, drifting at a third, a fifth and a tenth of scroll speed. Scroll slowly and watch them shear apart — depth without a single image."
          className="mt-6 block max-w-xl text-[15px] leading-relaxed text-parchment/60"
        />
        <div className="mt-10 space-y-40">
          <GLShape
            className="block h-36 w-full sm:h-44"
            style={{ backgroundColor: 'rgba(212, 175, 55, 0.30)' }}
            parallax={0.33}
          />
          <GLShape
            className="block h-36 w-full sm:h-44"
            style={{ backgroundColor: 'rgba(122, 158, 126, 0.32)' }}
            parallax={0.2}
          />
          <GLShape
            className="block h-36 w-full sm:h-44"
            style={{ backgroundColor: 'rgba(214, 116, 84, 0.30)' }}
            parallax={0.1}
          />
        </div>
      </section>

      {/* ── Texture — image plane ──────────────────────────────── */}
      <section className="border-t border-white/10 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">
          04 — Texture Plane
        </p>
        <div className="mt-8 flex items-center gap-8">
          <GLShape
            src="/images/smile.svg"
            alt="Inchstone smile"
            className="block h-24 w-24 shrink-0"
            style={{ backgroundColor: 'rgba(212, 175, 55, 0.12)' }}
          />
          <GLText
            text="An image mapped onto a shader quad. The PNG/SVG loads as a texture; alpha flows straight from the file into the fragment shader."
            className="block text-[15px] leading-relaxed text-parchment/60"
          />
        </div>
      </section>

      {/* ── Depth — the 3D scene ───────────────────────────────── */}
      <section className="border-t border-white/10 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-parchment/35">
          05 — True Depth
        </p>
        <GLText
          text="Below the fold of the flat world lives a perspective camera. Elements that opt in are re-projected through it, so they shrink with distance and parallax falls out of geometry instead of math."
          className="mt-6 block max-w-xl text-[15px] leading-relaxed text-parchment/60"
        />
        <div className="mt-10 grid grid-cols-3 gap-4">
          <GLShape
            enable3d
            className="block h-40"
            style={{ backgroundColor: 'rgba(212, 175, 55, 0.35)' }}
            parallax={0.25}
          />
          <GLShape
            enable3d
            className="block h-40"
            style={{ backgroundColor: 'rgba(212, 175, 55, 0.22)' }}
            parallax={0.45}
          />
          <GLShape
            enable3d
            className="block h-40"
            style={{ backgroundColor: 'rgba(212, 175, 55, 0.12)' }}
            parallax={0.65}
          />
        </div>
        <GLText
          enable3d
          text="Rendered in the perspective scene"
          className="mt-8 block text-center font-mono text-[11px] uppercase tracking-[0.3em] text-parchment/40"
        />
      </section>

      {/* ── Colophon ───────────────────────────────────────────── */}
      <section className="border-t border-white/10 pt-10">
        <GLText
          text="No WebGL? No motion? The DOM twins above simply stay visible and this page reads like any other. That is the whole trick: the spectacle is a layer, never a dependency."
          className="block text-[13px] leading-relaxed text-parchment/40"
        />
      </section>
    </div>
  )
}