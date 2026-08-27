import { Sparkle } from './sparkle.tsx'

/*
 * Fixed positions rather than random ones: a field regenerated on every render
 * shimmers as the page hydrates, and a field regenerated on the server does not
 * match the one the client draws.
 */
const SPARKLES = [
  { top: '12%', left: '6%', size: 'size-3', dim: 'opacity-25' },
  { top: '26%', left: '92%', size: 'size-2', dim: 'opacity-20' },
  { top: '44%', left: '18%', size: 'size-4', dim: 'opacity-15' },
  { top: '58%', left: '78%', size: 'size-3', dim: 'opacity-20' },
  { top: '70%', left: '38%', size: 'size-2', dim: 'opacity-25' },
  { top: '82%', left: '88%', size: 'size-3', dim: 'opacity-15' },
  { top: '34%', left: '54%', size: 'size-2', dim: 'opacity-15' },
  { top: '90%', left: '14%', size: 'size-2', dim: 'opacity-20' },
] as const

/**
 * Decoration for the empty parts of a black page.
 *
 * Behind everything and unclickable. It exists because a studio with three
 * results on a tall screen is mostly void, and void reads as unfinished rather
 * than as restraint.
 *
 * z-0 rather than a negative index: body paints the canvas colour, and anything
 * behind that is simply not on screen. The content above it is positioned to
 * stay above it.
 */
export function SparkleField() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {SPARKLES.map((s) => (
        <Sparkle
          key={`${s.top}-${s.left}`}
          className={`absolute text-ink ${s.size} ${s.dim}`}
          // Inline because these are data, not a design decision a class encodes.
          style={{ top: s.top, left: s.left }}
        />
      ))}
    </div>
  )
}
