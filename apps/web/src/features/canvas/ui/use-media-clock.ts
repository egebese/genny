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
/** `HTMLMediaElement.HAVE_METADATA`, which is not on the type in a server build. */
const HAVE_METADATA = 1

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
    /*
     * Read once before listening, because the event may already have happened.
     * `preload="metadata"` starts the fetch as soon as the element exists and
     * this effect runs after the commit, so a file already in the browser's
     * cache resolves its duration first and the listener never fires: every
     * player on the board read "0:00" for its length, and the scrubber had
     * nothing to fill against.
     */
    if (node.readyState >= HAVE_METADATA) loaded()
    const stopped = () => setPlaying(false)
    const started = () => setPlaying(true)
    node.addEventListener('timeupdate', tick)
    node.addEventListener('loadedmetadata', loaded)
    node.addEventListener('ended', stopped)
    node.addEventListener('pause', stopped)
    node.addEventListener('play', started)
    // Some browsers only settle the duration here for a streamed file.
    node.addEventListener('durationchange', loaded)
    return () => {
      node.removeEventListener('timeupdate', tick)
      node.removeEventListener('loadedmetadata', loaded)
      node.removeEventListener('ended', stopped)
      node.removeEventListener('pause', stopped)
      node.removeEventListener('play', started)
      node.removeEventListener('durationchange', loaded)
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

  return { media, playing, at, length, toggle, seek }
}
