'use client'

import { useRef } from 'react'

/**
 * The four elements a viewport writes to, held together because they are used
 * together: the surface that draws the dot grid, the layer that carries the
 * transform, the dock whose height is subtracted from what is visible, and the
 * zoom percentage, which is written rather than rendered.
 */
export function usePaintedRefs() {
  return {
    surface: useRef<HTMLDivElement>(null),
    dock: useRef<HTMLDivElement>(null),
    layer: useRef<HTMLDivElement>(null),
    readout: useRef<HTMLSpanElement>(null),
  }
}
