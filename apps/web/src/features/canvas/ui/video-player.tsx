'use client'

import { Icon } from '@genny/ui/icon.tsx'
import { useState } from 'react'
import { useMediaClock } from './use-media-clock.ts'

/**
 * A clip on the board, with our own controls.
 *
 * The native control bar was the right first answer: keyboard reachable,
 * already translated, nothing to maintain. It is the wrong answer on a canvas.
 * It is a fixed height in screen pixels, so on a node scaled to 40% it covers
 * a third of the picture and its buttons are four pixels tall; it draws in the
 * browser's own idiom, so the board looks like three different products
 * depending on who is using it; and it puts a download and a picture-in-picture
 * menu on every result, which are answers to questions the node panel already
 * asks better.
 *
 * So: play, a scrubber, a time, and mute. Everything on the frame rather than
 * under it, so nothing is lost at any zoom, and shown on hover or focus so a
 * board of twenty clips is twenty pictures rather than twenty control bars.
 */
export function VideoPlayer({ src }: { src: string }) {
  const clock = useMediaClock<HTMLVideoElement>()
  const [muted, setMuted] = useState(true)

  return (
    <div className="group/player relative h-full w-full bg-black">
      {/* biome-ignore lint/a11y/useMediaCaption: freshly generated media has no caption track and an empty one claims otherwise */}
      <video
        ref={clock.media}
        src={src}
        muted={muted}
        playsInline
        preload="metadata"
        onClick={clock.toggle}
        className="h-full w-full object-cover"
      />

      {/*
        One overlay, shown while paused, hovered or focused within. A board of
        twenty clips that all show their controls is twenty control bars.
      */}
      <div
        className={[
          'pointer-events-none absolute inset-0 flex flex-col justify-end transition-opacity',
          'bg-gradient-to-t from-black/70 via-transparent to-transparent',
          clock.playing ? 'opacity-0 group-hover/player:opacity-100' : 'opacity-100',
          'focus-within:opacity-100',
        ].join(' ')}
      >
        {/*
          A mark, not a second button. It said "Play <name>" while the one in the
          bar below said "Play", which is two controls doing one job and two
          things for a screen reader to read out. The frame itself is the big
          target: the overlay lets pointer events through to the video, which
          toggles on click, and the bar holds the control anything else uses.
        */}
        {!clock.playing ? (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-canvas/70 backdrop-blur">
              <Icon name="play" className="size-5 text-ink" />
            </span>
          </span>
        ) : null}

        <div className="pointer-events-auto flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={clock.toggle}
            aria-label={clock.playing ? 'Pause' : 'Play'}
            className="shrink-0 rounded-[3px] p-1 text-ink outline-none hover:bg-canvas/60 focus-visible:ring-2 focus-visible:ring-accent"
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
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-ink/25 outline-none accent-ink focus-visible:ring-2 focus-visible:ring-accent"
          />

          <span className="shrink-0 font-mono text-[10px] text-ink tabular-nums">
            {clock.clock(clock.at)} / {clock.clock(clock.length)}
          </span>

          <button
            type="button"
            onClick={() => setMuted((was) => !was)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            className="shrink-0 rounded-[3px] p-1 text-ink outline-none hover:bg-canvas/60 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name={muted ? 'muted' : 'speaker'} className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
