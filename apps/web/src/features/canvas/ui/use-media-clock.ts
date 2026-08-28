'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Where a clip or a sound is up to, and the two buttons that move it.
 *
 * Shared by the video and the audio player because it is the same element API
 * behind both and the same reason for not reading it from React: `timeupdate`
 * fires several times a second and the element is the only thing that knows,
 * so it reports rather than being told.
 */
export function useMediaClock<T extends HTMLMediaElement>() {
  const media = useRef<T>(null)
  const [playing, setPlaying] = useState(false)
  const [at, setAt] = useState(0)
  const [length, setLength] = useState(0)

  useEffect(() => {
    const node = media.current
    if (!node) return
    const tick = () => setAt(node.currentTime)
    const loaded = () => setLength(node.duration || 0)
    const stopped = () => setPlaying(false)
    const started = () => setPlaying(true)
    node.addEventListener('timeupdate', tick)
    node.addEventListener('loadedmetadata', loaded)
    node.addEventListener('ended', stopped)
    node.addEventListener('pause', stopped)
    node.addEventListener('play', started)
    return () => {
      node.removeEventListener('timeupdate', tick)
      node.removeEventListener('loadedmetadata', loaded)
      node.removeEventListener('ended', stopped)
      node.removeEventListener('pause', stopped)
      node.removeEventListener('play', started)
    }
  }, [])

  const toggle = useCallback(() => {
    const node = media.current
    if (!node) return
    if (node.paused) void node.play()
    else node.pause()
  }, [])

  const seek = useCallback((to: number) => {
    const node = media.current
    if (!node) return
    node.currentTime = to
    setAt(node.currentTime)
  }, [])

  return { media, playing, at, length, toggle, seek, clock }
}

/** Minutes and seconds. Anything longer than an hour is not a generation. */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
