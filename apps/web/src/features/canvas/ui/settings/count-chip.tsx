'use client'

import { cn } from '@genny/ui/cn.ts'
import { Icon } from '@genny/ui/icon.tsx'
import { CHIP, CHIP_GLYPH, CHIP_LABEL, CHIP_VALUE } from './chip.ts'

/**
 * How many to make, clamped to what the endpoint allows.
 *
 * The catalog carries each model's own min and max, and a typed number could
 * walk straight past both: fal answers 422 and the reason never reaches the
 * person who typed it. Two buttons cannot.
 */
export function CountChip(props: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const step = (by: number) =>
    props.onChange(Math.min(props.max, Math.max(props.min, props.value + by)))

  return (
    <span className={`${CHIP} gap-1 pr-1`}>
      <Icon name="copies" className={CHIP_GLYPH} />
      <span className={CHIP_LABEL}>{props.label}</span>
      <Step
        icon="minus"
        label={`One fewer ${props.label.toLowerCase()}`}
        disabled={props.value <= props.min}
        onClick={() => step(-1)}
      />
      <span className={`${CHIP_VALUE} w-3 text-center tabular-nums`}>{props.value}</span>
      <Step
        icon="plus"
        label={`One more ${props.label.toLowerCase()}`}
        disabled={props.value >= props.max}
        onClick={() => step(1)}
      />
    </span>
  )
}

function Step(props: {
  icon: 'plus' | 'minus'
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        'flex size-6 items-center justify-center rounded-[3px] text-ink-muted',
        'outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:pointer-events-none disabled:opacity-30',
      )}
    >
      <Icon name={props.icon} className="size-3" />
    </button>
  )
}
