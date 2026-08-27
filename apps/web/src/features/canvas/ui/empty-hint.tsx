/**
 * What an empty board says for itself.
 *
 * Centred in the viewport rather than placed on the canvas, because an empty
 * canvas has no coordinates worth pointing at and panning away from the only
 * instruction on screen is not a feature.
 */
export function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      <p className="max-w-sm text-center text-ink-muted text-sm">
        Describe what you want in the box below. Everything you make lands here, and you can point
        the next prompt at it with <span className="font-mono text-ink">@</span>.
      </p>
    </div>
  )
}
