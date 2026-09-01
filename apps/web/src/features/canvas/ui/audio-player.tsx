'use client'

import { Icon } from '@genny/ui/icon.tsx'
import { useState } from 'react'
import { AudioWaveform } from './audio-waveform.tsx'
import { clock, MediaScrubber } from './media-scrubber.tsx'
import { useMediaClock } from './use-media-clock.ts'

/**
 * A sound on the board, with our own controls.
 *
 * The same argument as the video player, and worse here: the native audio bar
 * is a fixed height in screen pixels, so on a node scaled to 40% it is the
 * whole node and its buttons are four pixels tall; it draws in the browser's
 * own idiom, so a board of a still, a clip and a voiceover looks like three
 * different products; and its overflow menu offers a download and a playback
 * rate, which are answers to questions the node panel asks better.
 *
 * A sound has nothing to look at, so the waveform is the picture: it fills the
 * space a still would take and colours in as the track plays.
 */
export function AudioPlayer({ src, label }: { src: string; label: string | null }) {
  const clockState = useMediaClock<HTMLAudioElement>()
  const [muted, setMuted] = useState(false)
  const played = clockState.length > 0 ? clockState.at / clockState.length : 0

  return (
    /*
     * Label, then waveform, then controls, and the waveform is the only one
     * that gives ground. A node is whatever size somebody dragged it to: these
     * arrive wide and short, and a band with a fixed height ran off the top of
     * one and printed the label straight through the middle of it.
     */
    <div className="flex h-full w-full flex-col gap-2 bg-surface p-3">
      <span className="shrink-0 truncate font-mono text-[10px] text-ink-faint uppercase tracking-wider">
        {label ?? 'audio'}
      </span>

      <div className="min-h-0 flex-1">
        <AudioWaveform label={label ?? 'audio'} played={played} />
      </div>

      {/* biome-ignore lint/a11y/useMediaCaption: freshly generated audio has no transcript and an empty track claims otherwise */}
      <audio ref={clockState.media} src={src} muted={muted} preload="metadata" className="hidden" />

      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={clockState.toggle}
          aria-label={clockState.playing ? 'Pause' : 'Play'}
          className="shrink-0 rounded-(--radius-media) p-1 text-ink outline-none hover:bg-control focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name={clockState.playing ? 'pause' : 'play'} className="size-3.5" />
        </button>

        <MediaScrubber at={clockState.at} length={clockState.length} onSeek={clockState.seek} />

        <span className="shrink-0 font-mono text-[10px] text-ink-muted tabular-nums">
          {clock(clockState.at)} / {clock(clockState.length)}
        </span>

        <button
          type="button"
          onClick={() => setMuted((was) => !was)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          aria-pressed={muted}
          className="shrink-0 rounded-(--radius-media) p-1 text-ink outline-none hover:bg-control focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name={muted ? 'muted' : 'speaker'} className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
