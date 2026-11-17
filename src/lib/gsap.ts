'use client'

/**
 * GSAP, registered once for the whole app.
 *
 * Inchstone scrolls inside <main> (the shell is h-screen, overflow hidden),
 * not the window, so every ScrollTrigger here uses `scroller()` — the main
 * element — as its scroller.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { useGSAP } from '@gsap/react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin, ScrambleTextPlugin, CustomEase, useGSAP)
  // the app's signature ease: a quick start and a long, calm settle
  CustomEase.create('settle', 'M0,0 C0.22,1 0.36,1 1,1')
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** the element the app actually scrolls */
export const scroller = () => (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('main') : null)

export { gsap, ScrollTrigger, Draggable, useGSAP }
