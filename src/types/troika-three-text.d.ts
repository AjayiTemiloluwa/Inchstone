// Minimal ambient typing for troika-three-text (ships UMD without .d.ts).
// Only the surface this codebase touches is declared.
declare module 'troika-three-text' {
  import type { Mesh } from 'three'

  export class Text extends Mesh {
    text: string
    font: string | null
    fontSize: number
    letterSpacing: number
    lineHeight: number
    maxWidth: number
    textAlign: 'left' | 'right' | 'center' | 'justify'
    anchorX: string
    anchorY: string
    depthOffset: number
    color: unknown
    sync(callback?: () => void): void
    dispose(): void
  }
}