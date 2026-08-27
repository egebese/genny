'use client'

import { Icon } from '@genny/ui/icon.tsx'
import { CHIP, CHIP_GLYPH, CHIP_LABEL, CHIP_VALUE } from './chip.ts'

/**
 * An ordered enum as a slider: 0.5K, 1K, 2K, 4K.
 *
 * A dropdown makes you open a list to find out there were four rungs on a ladder
 * you already understood. Dragging one notch is also the gesture people expect
 * for quality, and the price beside it moves as they drag wherever fal bills by
 * area rather than by image.
 */
export function ScaleChip(props: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const at = Math.max(0, props.options.indexOf(props.value))
  const last = props.options.length - 1

  return (
    <span className={`${CHIP} gap-2 pr-3`}>
      <Icon name="frame" className={CHIP_GLYPH} />
      <span className={CHIP_LABEL}>{props.label}</span>
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={at}
        aria-label={props.label}
        aria-valuetext={props.value}
        onChange={(event) => {
          const next = props.options[Number(event.target.value)]
          if (next !== undefined) props.onChange(next)
        }}
        // 14px per rung, so four rungs is a chip and not a control panel.
        style={{ width: Math.max(36, last * 14 + 8) }}
        className="h-1 cursor-pointer appearance-none rounded-full bg-surface-hover outline-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink"
      />
      <span className={`${CHIP_VALUE} tabular-nums`}>{props.value}</span>
    </span>
  )
}
