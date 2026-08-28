import { cn } from './cn.ts'

/**
 * The whole icon set, as path data.
 *
 * Hand-written rather than a package: eleven shapes at 16px do not justify a
 * dependency in the client bundle, and every one of these is drawn on the same
 * grid with the same stroke, which is the part an icon library usually gets you
 * and the part that actually matters here.
 *
 * Stroked, never filled, so they sit at the weight of the label beside them.
 */
const PATHS = {
  frame: 'M2.5 4.5h11v7h-11z',
  copies: 'M5.5 2.5h8v8m-3-5.5h-8v8h8z',
  clock: 'M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM8 5.8V8l1.6 1.2',
  file: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3',
  ban: 'M8 2.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 8 2.8zM4.6 4.6l6.8 6.8',
  steps: 'M2.5 12.5h3v-3h3v-3h3v-3h2',
  sliders: 'M2.5 5h11M2.5 11h11M6 3.5v3M11 9.5v3',
  gauge: 'M3 12a5.5 5.5 0 1 1 10 0M8 12l2.6-3.4',
  waveform: 'M3 6.5v3M5.75 4v8M8.5 5.5v5M11.25 3v10M14 6.5v3',
  speaker: 'M3 6.5h2L8 4v8L5 9.5H3zM10.5 6a3 3 0 0 1 0 4',
  muted: 'M3 6.5h2L8 4v8L5 9.5H3zM11 6.5l3 3M14 6.5l-3 3',
  play: 'M5.5 3.5 12 8l-6.5 4.5z',
  pause: 'M6 3.5v9M10 3.5v9',
  hash: 'M6 2.5 4.5 13.5M11.5 2.5 10 13.5M2.5 5.8h11M2.5 10.2h11',
  info: 'M8 2.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 8 2.8zM8 7.3v3.4M8 5.3v.1',
  close: 'M4 4l8 8M12 4l-8 8',
  copy: 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7',
  check: 'M3.5 8.5l3 3 6-7',
  download: 'M8 2.5v8M4.8 7.6 8 10.8l3.2-3.2M3 13h10',
  link: 'M6.6 9.4a2.7 2.7 0 0 0 4 .3l1.9-1.9a2.7 2.7 0 0 0-3.8-3.8l-1 1M9.4 6.6a2.7 2.7 0 0 0-4-.3L3.5 8.2a2.7 2.7 0 0 0 3.8 3.8l1-1',
  refresh: 'M13 8a5 5 0 1 1-1.6-3.7M13 2.6V5h-2.4',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
  chevron: 'M4.5 6.5 8 10l3.5-3.5',
  plus: 'M8 3.5v9M3.5 8h9',
  minus: 'M3.5 8h9',
} as const

export type IconName = keyof typeof PATHS

/**
 * A 16px line icon. Decorative by default, because these sit beside their own
 * label: an icon that announces "clock" next to the word Length is noise.
 */
export function Icon({
  name,
  label,
  className,
}: {
  name: IconName
  /** Only when the icon is the whole control. Otherwise the label says it. */
  label?: string
  className?: string
}) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative unless `label` is given, and then it carries aria-label instead
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
