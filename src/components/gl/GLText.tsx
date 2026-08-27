'use client'

/**
 * GLText — mirrors a DOM text node into the GL scenes (dion's BaseText).
 * Typography (size, leading, tracking, color, alignment, casing) is read
 * from the mirror's computed styles, so the GL version is pixel-faithful
 * to the CSS it replaces. Rendering uses troika-three-text SDF meshes.
 *
 * Font resolution order:
 *   1. explicit `font` prop (public URL)
 *   2. the first matching @font-face in the document whose family matches
 *      the mirror's computed font-family and whose file troika can parse
 *      (.ttf/.otf/.woff — next/font serves .woff2 only, so it is skipped)
 *   3. /fonts/PlayfairDisplay-Bold.woff (bundled fallback)
 *
 * The DOM mirror stays visible until troika's first successful sync — if
 * fonts or WebGL fail, the plain HTML text simply remains.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { Group } from 'three'
import type { Text as TroikaText } from 'troika-three-text'
import { useGL } from './GLProvider'

const DEFAULT_FONT = '/fonts/PlayfairDisplay-Bold.woff'

export interface GLTextHandle {
  el: Promise<HTMLElement | null>
  /** Force a re-layout of the GL mesh. */
  update(): Promise<void>
}

export interface GLTextProps {
  text: string
  className?: string
  style?: CSSProperties
  /** HTML element used for the hidden DOM mirror. */
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'div'
  /** Explicit font file URL (wins over CSS @font-face detection). */
  font?: string
  enable3d?: boolean
  /** Skip re-measuring on resize (for text you mutate imperatively). */
  manualResize?: boolean
}

function fontFromStylesheets(computedFamily: string): string | null {
  try {
    const want = computedFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase()
    if (!want) return null
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = (sheet as CSSStyleSheet).cssRules
      } catch {
        continue // cross-origin sheet
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue
        const fam = rule.style
          .getPropertyValue('font-family')
          .replace(/["']/g, '')
          .trim()
          .toLowerCase()
        if (fam !== want) continue
        const src = rule.style.getPropertyValue('src')
        const urls = Array.from(src.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)).map(m => m[2])
        // troika parses ttf/otf/woff — woff2 (next/font's output) is unsupported
        const pick = urls.find(u => /\.(ttf|otf|woff)$/i.test(u))
        if (pick) {
          if (/^https?:|^\/\//.test(pick) || pick.startsWith('/')) return pick
          return new URL(pick, document.baseURI).toString()
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function cssToHex(cssColor: string): string {
  const m = cssColor.match(/rgba?\(([^)]+)\)/)
  if (!m) return cssColor
  const [r, g, b] = m[1].split(',').map(v => Math.round(parseFloat(v)))
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

export const GLText = forwardRef<GLTextHandle, GLTextProps>(function GLText(
  { text, className = '', style, as = 'p', font, enable3d = false, manualResize = false },
  ref
) {
  const { client, request } = useGL()
  const mirror = useRef<HTMLElement | null>(null)
  const meshRef = useRef<TroikaText | null>(null)
  const parentRef = useRef<Group | null>(null)
  const [drawn, setDrawn] = useState(false)
  const readyRef = useRef<(el: HTMLElement | null) => void>(() => {})
  const readyPromise = useRef(
    new Promise<HTMLElement | null>(res => {
      readyRef.current = res
    })
  )

  useImperativeHandle(
    ref,
    () => ({
      el: readyPromise.current,
      async update() {
        await readyPromise.current
        meshRef.current?.sync()
      },
    }),
    []
  )

  useEffect(() => {
    request()
  }, [request])

  useEffect(() => {
    if (!client || !mirror.current) return
    let disposed = false
    let offResize: (() => void) | undefined

    ;(async () => {
      const { Text: TroikaTextCtor } = await import('troika-three-text')
      const el = mirror.current
      if (disposed || !el) return

      const cs = getComputedStyle(el)
      const lh = parseFloat(cs.lineHeight)
      const ls = parseFloat(cs.letterSpacing)

      const t = new TroikaTextCtor()
      t.font = font ?? fontFromStylesheets(cs.fontFamily) ?? DEFAULT_FONT
      t.anchorX = 'left'
      t.anchorY = 'top'
      t.depthOffset = -1

      // Typography from the mirror's computed styles (3D scales via pxToUnit).
      const applyText = () => {
        const source = mirror.current
        if (!source) return
        const s = getComputedStyle(source)
        const px = parseFloat(s.fontSize) || 16
        t.text = s.textTransform === 'uppercase' ? text.toUpperCase() : text
        t.fontSize = enable3d ? client.pxToUnit(px) : px
        t.maxWidth = enable3d
          ? client.pxToUnit(source.offsetWidth + 5)
          : source.offsetWidth + 5
        t.textAlign = (s.textAlign === 'start' ? 'left' : s.textAlign) as
          | 'left'
          | 'right'
          | 'center'
          | 'justify'
        t.lineHeight = lh && px ? lh / px : 1.2
        t.letterSpacing = ls && px ? ls / px : 0
        t.color = cssToHex(s.color)
        t.sync(() => {
          if (!disposed) setDrawn(true)
        })
      }

      const parent = enable3d ? client.container3d : client.container
      parent.add(t)
      meshRef.current = t
      parentRef.current = parent

      // Anchor the text block's top-left to the mirror's content rect.
      const place = () => {
        const source = mirror.current
        if (!source) return
        const r = source.getBoundingClientRect()
        if (r.width === 0) return
        const scrollTop = client.scrollEl ? client.scrollEl.scrollTop : window.scrollY
        const { width: vw, height: vh } = client.viewport
        const u = enable3d ? client.pxToUnit : (v: number) => v
        t.position.x = u(r.left - vw / 2)
        t.position.y = u(vh / 2 - (r.top + scrollTop))
        applyText()
      }

      place()
      readyRef.current(el)
      if (!manualResize) offResize = client.onResize(place)
      // Webfonts finish loading later — metrics change, re-measure.
      document.fonts?.ready.then(() => {
        if (!disposed) place()
      })
    })()

    return () => {
      disposed = true
      offResize?.()
      if (meshRef.current) {
        parentRef.current?.remove(meshRef.current)
        meshRef.current.dispose()
        meshRef.current = null
        parentRef.current = null
      }
    }
  }, [client, text, font, enable3d, manualResize])

  const Tag = as
  return (
    <Tag
      ref={mirror as never}
      className={className}
      style={{
        visibility: client && drawn ? 'hidden' : 'visible',
        ...style,
      }}
    >
      {text}
    </Tag>
  )
})