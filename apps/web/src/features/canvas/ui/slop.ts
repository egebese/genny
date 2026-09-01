/**
 * How far something must move before it counts as a drag rather than a tap.
 *
 * A finger is not a pointer. `use-node-drag` treated any pointermove at all as
 * a move, so touching a node to select it almost always committed a two-pixel
 * reposition, and the branch that narrows a selection by tapping one of its
 * members could never run on touch because `moved` was already true.
 */
export const POINTER_SLOP = 4
export const TOUCH_SLOP = 10

export function slopFor(pointerType: string): number {
  return pointerType === 'touch' ? TOUCH_SLOP : POINTER_SLOP
}
