/**
 * Which node a long press landed on, if any.
 *
 * The gesture layer knows only the element the finger came down on, because it
 * listens on the surface in the capture phase and never sees React's props.
 * `data-node-id` on the node is the one thing that bridges the two.
 */
export function nodeIdAt(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null
  return target.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null
}
