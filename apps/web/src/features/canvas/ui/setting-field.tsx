'use client'

import type { ModelInput } from '@genny/models/schema.ts'
import { Icon } from '@genny/ui/icon.tsx'
import { settingIcon } from './setting-icon.ts'
import { AspectChip } from './settings/aspect-chip.tsx'
import { CHIP, CHIP_GLYPH, CHIP_LABEL } from './settings/chip.ts'
import { CountChip } from './settings/count-chip.tsx'
import { ScaleChip } from './settings/scale-chip.tsx'
import { SelectChip } from './settings/select-chip.tsx'

type SettingFieldProps = {
  input: ModelInput
  value: unknown
  onChange: (value: unknown) => void
}

/** Ordered rungs rather than unordered choices, so a slider is the honest shape. */
const SCALES = new Set(['resolution', 'rendering_speed'])
const ASPECTS = new Set(['aspect_ratio', 'image_size', 'ratio'])

/**
 * Renders one control from the model's catalog entry.
 *
 * The catalog decides what exists, so adding a model never means touching this
 * file, and a model without an aspect ratio simply has no aspect ratio control.
 * What this file decides is which *shape* of control each field gets, which is a
 * fact about the field and not about the endpoint.
 */
export function SettingField({ input, value, onChange }: SettingFieldProps) {
  const current = value ?? input.default

  if (input.type === 'enum' && input.enum) {
    const chosen = String(current ?? input.enum[0])
    if (ASPECTS.has(input.name)) {
      return (
        <AspectChip label={input.label} value={chosen} options={input.enum} onChange={onChange} />
      )
    }
    if (SCALES.has(input.name)) {
      return (
        <ScaleChip label={input.label} value={chosen} options={input.enum} onChange={onChange} />
      )
    }
    return (
      <SelectChip
        icon={settingIcon(input.name)}
        label={input.label}
        value={chosen}
        options={input.enum}
        onChange={onChange}
      />
    )
  }

  if (input.name === 'num_images' && input.type === 'integer') {
    return (
      <CountChip
        label={input.label}
        value={Number(current ?? 1)}
        min={input.min ?? 1}
        max={input.max ?? 4}
        onChange={onChange}
      />
    )
  }

  if (input.type === 'boolean') {
    const on = Boolean(current)
    return (
      <label htmlFor={id(input)} className={`${CHIP} cursor-pointer ${on ? 'text-accent' : ''}`}>
        <Icon name={settingIcon(input.name)} className={CHIP_GLYPH} />
        <input
          id={id(input)}
          type="checkbox"
          className="sr-only"
          checked={on}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className={on ? '' : CHIP_LABEL}>{input.label}</span>
      </label>
    )
  }

  const numeric = input.type === 'integer' || input.type === 'number'
  return (
    <span className={CHIP}>
      <Icon name={settingIcon(input.name)} className={CHIP_GLYPH} />
      <label htmlFor={id(input)} className={CHIP_LABEL}>
        {input.label}
      </label>
      <input
        id={id(input)}
        type={numeric ? 'number' : 'text'}
        className={`bg-transparent text-ink outline-none ${numeric ? 'w-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none' : 'w-24'}`}
        value={String(current ?? '')}
        {...(numeric ? { min: input.min, max: input.max } : {})}
        step={input.type === 'number' ? 0.1 : 1}
        onChange={(event) => {
          const raw = event.target.value
          if (!numeric) return onChange(raw)
          onChange(raw === '' ? undefined : clamp(Number(raw), input))
        }}
      />
    </span>
  )
}

const id = (input: ModelInput) => `setting-${input.name}`

/** The endpoint's own bounds. Past them fal answers 422 and says nothing useful. */
function clamp(value: number, input: ModelInput): number {
  const low = input.min ?? Number.NEGATIVE_INFINITY
  const high = input.max ?? Number.POSITIVE_INFINITY
  return Math.min(high, Math.max(low, value))
}
