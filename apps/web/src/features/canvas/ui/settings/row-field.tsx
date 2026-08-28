'use client'

import type { ObjectField } from '@genny/models/schema.ts'
import { cn } from '@genny/ui/cn.ts'
import { SelectChip } from './select-chip.tsx'

const BOX =
  'h-7 w-full rounded-(--radius-control) bg-control px-2 text-xs text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-accent'

/**
 * One column of one row.
 *
 * Deliberately not `SettingField`. That one picks a shape from the field's
 * name, so a column called `scale` would draw the resolution slider and a
 * column called `seed` would get the seed icon; inside a row the name is a
 * column heading, not a hint about what the control is for.
 */
export function RowField({
  field,
  value,
  onChange,
}: {
  field: ObjectField
  value: unknown
  onChange: (value: unknown) => void
}) {
  const current = value ?? field.default

  if (field.type === 'enum' && field.enum) {
    const options = field.enum
    return (
      <SelectChip
        icon="sliders"
        label={field.label}
        value={String(current ?? options[0])}
        options={options.map(String)}
        onChange={(picked) =>
          onChange(options.find((option) => String(option) === picked) ?? picked)
        }
      />
    )
  }

  if (field.type === 'boolean') {
    return (
      <label className="flex h-7 items-center gap-2 text-ink-muted text-xs">
        <input
          type="checkbox"
          checked={current === true}
          onChange={(event) => onChange(event.target.checked)}
          className="size-3.5 accent-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {field.label}
      </label>
    )
  }

  if (field.type === 'integer' || field.type === 'number') {
    return (
      <input
        type="number"
        aria-label={field.label}
        placeholder={field.label}
        value={typeof current === 'number' ? current : ''}
        min={field.min}
        max={field.max}
        step={field.type === 'integer' ? 1 : 'any'}
        onChange={(event) => {
          // Empty means "unset", which is not the same as zero: a cleared box
          // should fall back to the column's default rather than send 0.
          const raw = event.target.value
          onChange(raw === '' ? undefined : Number(raw))
        }}
        className={cn(BOX, 'tabular-nums')}
      />
    )
  }

  return (
    <input
      type="text"
      aria-label={field.label}
      placeholder={field.label}
      value={typeof current === 'string' ? current : ''}
      onChange={(event) => onChange(event.target.value || undefined)}
      className={BOX}
    />
  )
}
