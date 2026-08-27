'use client'

/**
 * GLProvider — dion-style DOM→WebGL mirroring rig for Inchstone.
 *
 * Inert until the first <GLText>/<GLShape> mounts and calls request().
 * It then lazily imports three, appends a fixed, pointer-transparent
 * canvas at z-index 1 (above the ambient backdrop, below app content)
 * and drives two scenes every frame:
 *
 *   • UI scene — orthographic camera, 1 world unit = 1 CSS pixel
 *   • 3D scene — perspective camera (fov 30°) parked at z = 12;
 *     pxToUnit() maps CSS pixels onto its z=0 focal plane
 *
 * Both scene containers ride the app's scroll each frame, so mirrored
 * elements stay glued to their (hidden) DOM anchors — including under
 * Lenis smooth scroll. IMPORTANT: this app scrolls inside <main>
 * (the shell is h-screen overflow-hidden), NOT the window, so the
 * scroll source is that element.
 *
 * Graceful degradation: prefers-reduced-motion or missing WebGL → the
 * client never initializes and GL elements simply leave their DOM
 * mirrors visible. Zero cost on pages that use none of them.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type {
  Group,
  OrthographicCamera,
  PerspectiveCamera,
  WebGLRenderer,
} from 'three'

export interface GLFrame {
  scroll: number
  /** px/s, smoothed — exposed for future velocity-driven effects */
  velocity: number
}

export interface GLClient {
  container: Group
  container3d: Group
  cameraUI: OrthographicCamera
  camera3d: PerspectiveCamera
  renderer: WebGLRenderer
  viewport: { width: number; height: number }
  scrollEl: HTMLElement | null
  /** CSS pixels → world units in the perspective scene */
  pxToUnit(px: number): number
  onFrame(cb: (frame: GLFrame) => void): () => void
  onResize(cb: () => void): () => void
}

interface GLContextValue {
  client: GLClient | null
  request: () => void
}

const GLContext = createContext<GLContextValue>({
  client: null,
  request: () => {},
})

export function useGL() {
  return useContext(GLContext)
}

const FOV = 30
const CAM_Z = 12
const MAX_DPR = 2

export function GLProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<GLClient | null>(null)
  const [want, setWant] = useState(false)

  const request = useCallback(() => setWant(true), [])

  useEffect(() => {
    if (!want) return
    let disposed = false
    let teardown = () => {}

    ;(async () => {
      if (typeof window === 'undefined') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      try {
        const THREE = await import('three')

        const canvas = document.createElement('canvas')
        canvas.setAttribute('aria-hidden', 'true')
        canvas.style.cssText =
          'position:fixed;inset:0;width:100vw;height:100vh;z-index:1;pointer-events:none;'
        document.body.appendChild(canvas)

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        })
        renderer.setClearColor(0x000000, 0)
        renderer.autoClear = false // two scenes share one buffer

        const sceneUI = new THREE.Scene()
        const scene3d = new THREE.Scene()
        const container = new THREE.Group()
        const container3d = new THREE.Group()
        sceneUI.add(container)
        scene3d.add(container3d)

        const cameraUI = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 1000)
        cameraUI.position.z = 10
        const camera3d = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
        camera3d.position.z = CAM_Z

        const viewport = { width: 1, height: 1 }
        const scrollEl = document.querySelector<HTMLElement>('main')

        // Full window height spans the frustum at z=0 → px ↔ world units.
        const pxToUnit = (px: number) =>
          (px * (2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180))) / viewport.height

        const frameCbs = new Set<(f: GLFrame) => void>()
        const resizeCbs = new Set<() => void>()

        const setSize = () => {
          viewport.width = window.innerWidth
          viewport.height = window.innerHeight
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))
          renderer.setSize(viewport.width, viewport.height, false)
          cameraUI.left = -viewport.width / 2
          cameraUI.right = viewport.width / 2
          cameraUI.top = viewport.height / 2
          cameraUI.bottom = -viewport.height / 2
          cameraUI.updateProjectionMatrix()
          camera3d.aspect = viewport.width / viewport.height
          camera3d.updateProjectionMatrix()
          resizeCbs.forEach(cb => cb())
        }
        setSize()

        const ro = new ResizeObserver(setSize)
        ro.observe(document.documentElement)
        window.addEventListener('resize', setSize)

        let raf = 0
        let lastT = performance.now()
        let lastScroll = scrollEl ? scrollEl.scrollTop : window.scrollY
        let velocity = 0

        const loop = (t: number) => {
          raf = requestAnimationFrame(loop)
          const dt = Math.max((t - lastT) / 1000, 1e-4)
          lastT = t
          const scroll = scrollEl ? scrollEl.scrollTop : window.scrollY
          velocity = velocity * 0.8 + ((scroll - lastScroll) / dt) * 0.2
          lastScroll = scroll

          // Containers track scroll; shapes/text add their own parallax.
          container.position.y = scroll
          container3d.position.y = pxToUnit(scroll)

          const frame = { scroll, velocity }
          frameCbs.forEach(cb => cb(frame))

          renderer.clear()
          renderer.render(sceneUI, cameraUI)
          renderer.render(scene3d, camera3d)
        }
        raf = requestAnimationFrame(loop)

        const c: GLClient = {
          container,
          container3d,
          cameraUI,
          camera3d,
          renderer,
          viewport,
          scrollEl,
          pxToUnit,
          onFrame: cb => {
            frameCbs.add(cb)
            return () => {
              frameCbs.delete(cb)
            }
          },
          onResize: cb => {
            resizeCbs.add(cb)
            return () => {
              resizeCbs.delete(cb)
            }
          },
        }

        if (disposed) {
          cancelAnimationFrame(raf)
          ro.disconnect()
          window.removeEventListener('resize', setSize)
          renderer.dispose()
          canvas.remove()
          return
        }
        setClient(c)

        teardown = () => {
          cancelAnimationFrame(raf)
          ro.disconnect()
          window.removeEventListener('resize', setSize)
          renderer.dispose()
          canvas.remove()
        }
      } catch {
        // No WebGL / import failure → DOM mirrors stay visible.
      }
    })()

    return () => {
      disposed = true
      teardown()
    }
  }, [want])

  return (
    <GLContext.Provider value={{ client, request }}>{children}</GLContext.Provider>
  )
}