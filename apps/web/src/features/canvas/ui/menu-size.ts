/**
 * How big the node menu is allowed to be, given the board it has to sit on.
 *
 * A constant would do on a desktop, and did: 232 by 260, hard-coded. At 375px
 * that is most of the width, and `anchorPanel` clamps rather than shrinks, so
 * the menu ran off the right edge of a phone.
 *
 * Rows at 44 rather than the 33 they were: a menu item is a primary action on
 * touch, and the accessibility floor for one is the size of a thumb.
 */
export const MENU = { width: 232, height: 260 }

export const MENU_ROW = 44

export function menuSize(bounds: { width: number; height: number }, rows: number) {
  const gap = 8
  return {
    width: Math.min(MENU.width, Math.max(160, bounds.width - gap * 2)),
    // Derived from the rows it is about to draw rather than measured: measuring
    // costs a layout pass and shows the menu in the wrong place for one frame.
    height: Math.min(rows * MENU_ROW + 16, Math.max(120, bounds.height - gap * 2)),
  }
}
