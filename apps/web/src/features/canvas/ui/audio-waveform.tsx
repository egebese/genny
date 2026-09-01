import { cn } from '@genny/ui/cn.ts'

const BARS = 40

/**
 * The shape of a sound, and how far through it you are.
 *
 * Not the real waveform. Reading one means fetching and decoding the whole file
 * to draw a picture of it, which for a board of six tracks is six downloads to
 * decorate six cards. This is a stable pattern derived from the label, so a
 * given sound always looks like itself and two sounds never look the same, and
 * the played part is coloured, which is the half that is actually information.
 *
 * The card had a single grey glyph in the middle of it before, which said only
 * "this is audio" to somebody already looking at an audio player.
 */
export function AudioWaveform({ label, played }: { label: string; played: number }) {
  const heights = shapeOf(label)
  const upTo = Math.round(played * BARS)

  return (
    /*
     * A band across the card, not a field of stripes filling it. Bars measured
     * against the whole height ran floor to ceiling and read as noise; the band
     * is a fixed height in the middle, which is the shape a waveform has.
     */
    <div aria-hidden className="flex h-full w-full items-center">
      <div className="flex h-16 w-full items-center gap-[2px]">
        {heights.map((height, at) => (
          <span
            key={`${at}-${height}`}
            style={{ height: `${height}%` }}
            className={cn(
              'min-h-[3px] flex-1 rounded-full transition-colors',
              at < upTo ? 'bg-accent' : 'bg-ink/30',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A pattern that belongs to this label and no other.
 *
 * Deterministic on purpose: a random one would redraw itself on every render,
 * and a sound whose shape changes while it plays is a distraction rather than a
 * decoration.
 */
function shapeOf(label: string): number[] {
  let seed = 0
  for (const character of label) seed = (seed * 31 + character.charCodeAt(0)) >>> 0

  const heights: number[] = []
  for (let at = 0; at < BARS; at++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    // Kept off the floor and well under the ceiling: a bar at zero reads as a
    // gap in the sound, and bars at full height fill the card with stripes.
    heights.push(20 + ((seed >>> 16) % 80))
  }
  return heights
}
