/**
 * Every dock control is the same chip: an icon, a faint label, the value.
 *
 * Labelled form rows made the dock read as a settings panel with a prompt
 * attached, when the prompt is the point and these are adjustments to it. No
 * border, because inside a panel these already sit one shade up from what is
 * behind them and an outline on top of that says it twice.
 *
 * The whole chip is the control. A `<select>` inside a span meant the clickable
 * area was the text and not the box around it, which is a target you have to aim
 * at rather than one you hit.
 */
export const CHIP =
  'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-(--radius-control) bg-control px-2.5 text-xs outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent'

export const CHIP_LABEL = 'text-ink-faint'
export const CHIP_VALUE = 'text-ink'
export const CHIP_GLYPH = 'size-3.5 text-ink-faint'
