import type { Guide } from '@genny/canvas/snap.ts'

/**
 * The hairlines that appear while a node is dragged into line with another.
 *
 * Drawn under the nodes, in canvas space, so a line stays on the edge it is
 * about at any zoom. Its own width is divided back out so it stays a hairline
 * rather than growing into a bar when the board is zoomed in.
 */
export function SnapGuides({ guides, zoom }: { guides: Guide[]; zoom: number }) {
  return guides.map((guide) => (
    <div
      key={`${guide.axis}:${guide.at}:${guide.from}`}
      aria-hidden
      style={
        guide.axis === 'x'
          ? { left: guide.at, top: guide.from, height: guide.to - guide.from, width: 1 / zoom }
          : { top: guide.at, left: guide.from, width: guide.to - guide.from, height: 1 / zoom }
      }
      className="pointer-events-none absolute bg-accent"
    />
  ))
}
