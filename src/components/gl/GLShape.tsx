'use client'

/**
 * GLShape — mirrors a DOM box into the GL scenes (dion's BaseShape).
 * The DOM element keeps its layout (and drives all measurements) but is
 * hidden once the GL client is live; a shader plane is drawn at the same
 * spot instead, so layout, SEO and a11y are untouched.
 *
 *  • src      → texture-mapped plane (uType 1); alpha comes from the image
 *  • no src   → solid plane tinted by the mirror's computed background-color
 *               (uColor); final alpha = opacity × background alpha
 *  • parallax → 0 scrolls with content, 1 pins to the viewport, values in
 *               between drift slower than the page (depth layers)
 *  • enable3d → draws in the perspective scene (true depth + scale falloff)
 *  • z-index  → the mirror's computed z-index becomes mesh renderOrder
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { BufferGeometry, Group, Mesh, ShaderMaterial, Texture } from 'three'
import { useGL } from './GLProvider'

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uType;
  varying vec2 vUv;
  void main() {
    vec4 texel = texture2D(tMap, vUv);
    vec4 color = vec4(uColor, uAlpha * texel.a);
    if (uType > 0.5) color = vec4(texel.rgb, texel.a);
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`

/** 1×1 opaque white fallback so color-only planes sample alpha = 1. */
const WHITE_TEXEL = new Uint8Array([255, 255, 255, 255])

export interface GLShapeHandle {
  el: Promise<HTMLDivElement | null>
  /** Re-tint the solid plane with any CSS color. */
  setColor(css: string): Promise<void>
}

export interface GLShapeProps {
  className?: string
  style?: CSSProperties
  src?: string
  alt?: string
  children?: ReactNode
  enable3d?: boolean
  solid?: boolean
  parallax?: number
  opacity?: number
  gl?: {
    uniforms?: Record<string, { value: unknown }>
    vertexShader?: string
    fragmentShader?: string
  }
}

/** "rgb(r, g, b)" / "rgba(...)" → { color, alpha } for THREE.Color. */
function parseBg(bg: string): { color: string; alpha: number } | null {
  const m = bg.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const parts = m[1].split(',').map(v => parseFloat(v))
  if (parts.length < 3 || parts.slice(0, 3).some(n => Number.isNaN(n))) return null
  const alpha = parts[3] ?? 1
  if (alpha === 0) return null
  return { color: `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`, alpha }
}

export const GLShape = forwardRef<GLShapeHandle, GLShapeProps>(function GLShape(
  {
    className = '',
    style,
    src,
    children,
    enable3d = false,
    solid = false,
    parallax = 0,
    opacity = 1,
    gl,
  },
  ref
) {
  const { client, request } = useGL()
  const mirror = useRef<HTMLDivElement>(null)
  const parentRef = useRef<Group | null>(null)
  const meshRef = useRef<Mesh | null>(null)
  const geoRef = useRef<BufferGeometry | null>(null)
  const texRef = useRef<Texture | null>(null)
  const readyRef = useRef<(el: HTMLDivElement | null) => void>(() => {})
  const readyPromise = useRef(
    new Promise<HTMLDivElement | null>(res => {
      readyRef.current = res
    })
  )

  useImperativeHandle(
    ref,
    () => ({
      el: readyPromise.current,
      async setColor(css: string) {
        const THREE = await import('three')
        if (meshRef.current) {
          ;(meshRef.current.material as ShaderMaterial).uniforms.uColor.value =
            new THREE.Color(css)
        }
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
    let offFrame: (() => void) | undefined
    let offResize: (() => void) | undefined

    ;(async () => {
      const THREE = await import('three')
      if (disposed || !mirror.current) return

      const geo = new THREE.PlaneGeometry(1, 1)
      geo.translate(0.5, -0.5, 0) // top-left pivot, like DOM
      geoRef.current = geo

      // 1×1 opaque white so color-only planes sample alpha = 1.
      const fallbackTex = new THREE.DataTexture(WHITE_TEXEL, 1, 1)
      fallbackTex.needsUpdate = true

      const uniforms: Record<string, { value: unknown }> = {
        ...gl?.uniforms,
        uColor: { value: new THREE.Color('#FFFFFF') },
        uAlpha: { value: opacity },
        uType: { value: 0 },
        tMap: { value: fallbackTex },
      }
      const mat = new THREE.ShaderMaterial({
        uniforms: uniforms as never,
        vertexShader: gl?.vertexShader ?? VERT,
        fragmentShader: gl?.fragmentShader ?? FRAG,
        transparent: true,
        depthWrite: false,
      })

      const mesh = new THREE.Mesh(geo, mat)
      const parent = enable3d ? client.container3d : client.container
      parent.add(mesh)
      parentRef.current = parent
      meshRef.current = mesh

      if (src) {
        new THREE.TextureLoader().load(src, tex => {
          if (disposed) {
            tex.dispose()
            return
          }
          tex.colorSpace = THREE.SRGBColorSpace
          texRef.current = tex
          mat.uniforms.tMap.value = tex
          if (!solid) mat.uniforms.uType.value = 1
        })
      }

      // Re-project the DOM rect into world space (2D: 1 unit = 1 px).
      const place = () => {
        const el = mirror.current
        if (!el) return
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return
        const scrollTop = client.scrollEl ? client.scrollEl.scrollTop : window.scrollY
        const top = r.top + scrollTop // content-space anchor, scroll-independent
        const cx = r.left + r.width / 2
        const { width: vw, height: vh } = client.viewport
        const u = enable3d ? client.pxToUnit : (v: number) => v

        mesh.position.x = u(cx - vw / 2)
        mesh.userData.baseY = u(vh / 2 - top)
        mesh.scale.set(u(r.width), u(r.height), 1)

        const cs = getComputedStyle(el)
        const z = parseInt(cs.zIndex, 10)
        mesh.renderOrder = Number.isNaN(z) ? 0 : z
        const bg = parseBg(cs.backgroundColor)
        if (bg && !src) mat.uniforms.uColor.value = new THREE.Color(bg.color)
        if (bg) mat.uniforms.uAlpha.value = bg.alpha * opacity
      }

      place()
      readyRef.current(mirror.current)
      offResize = client.onResize(place)
      // Parallax layers move at a fraction of scroll speed (1 = pinned).
      offFrame = client.onFrame(frame => {
        const perPx = enable3d ? client.pxToUnit(1) : 1
        mesh.position.y =
          (mesh.userData.baseY as number) + frame.scroll * parallax * perPx
      })
    })()

    return () => {
      disposed = true
      offFrame?.()
      offResize?.()
      if (meshRef.current) parentRef.current?.remove(meshRef.current)
      geoRef.current?.dispose()
      ;(meshRef.current?.material as ShaderMaterial | undefined)?.dispose()
      texRef.current?.dispose()
      meshRef.current = null
      parentRef.current = null
    }
    // `gl` is read once at mount by design (shader swaps are not reactive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, enable3d, parallax, opacity, src, solid])

  // GL draws it → hide the DOM mirror; keep it visible until then (or
  // forever on the no-WebGL / reduced-motion path) so content never lost.
  return (
    <div
      ref={mirror}
      className={className}
      style={{ visibility: client ? 'hidden' : 'visible', ...style }}
    >
      {src ? null : children}
    </div>
  )
})