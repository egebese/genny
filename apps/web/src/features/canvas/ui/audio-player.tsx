'use client'

import { Icon } from '@genny/ui/icon.tsx'
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
 * A sound has nothing to look at, so unlike the video the controls are the
 * whole node rather than an overlay, and the waveform mark stands in for the
 * picture that is not there.
 */
export function AudioPlayer({ src, label }: { src: string; label: string | null }) {
  const clock = useMediaClock<HTMLAudioElement>()

  return (
    <div className="flex h-full w-full flex-col justify-between gap-2 bg-surface p-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Icon
          name="waveform"
          aria-hidden
          className="size-10 text-ink-faint transition-colors group-hover:text-ink-muted"
        />
      </div>

      {/* biome-ignore lint/a11y/useMediaCaption: freshly generated audio has no transcript and an empty track claims otherwise */}
      <audio ref={clock.media} src={src} preload="metadata" className="hidden" />

      <span className="truncate font-mono text-[10px] text-ink-faint uppercase tracking-wider">
        {label ?? 'audio'}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clock.toggle}
          aria-label={clock.playing ? 'Pause' : 'Play'}
          className="shrink-0 rounded-(--radius-media) p-1 text-ink outline-none hover:bg-control focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name={clock.playing ? 'pause' : 'play'} className="size-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(clock.length, 0.01)}
          step={0.01}
          value={clock.at}
          aria-label="Seek"
          onChange={(event) => clock.seek(Number(event.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-ink/25 outline-none accent-accent focus-visible:ring-2 focus-visible:ring-accent"
        />

        <span className="shrink-0 font-mono text-[10px] text-ink-muted tabular-nums">
          {clock.clock(clock.at)} / {clock.clock(clock.length)}
        </span>
      </div>
    </div>
  )
}
