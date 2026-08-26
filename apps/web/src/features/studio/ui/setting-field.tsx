'use client'

import type { ModelInput } from '@genny/models/schema.ts'

type SettingFieldProps = {
  input: ModelInput
  value: unknown
  onChange: (value: unknown) => void
}

const control =
  'h-9 rounded-(--radius-control) border border-line bg-canvas px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

/**
 * Renders one control from the model's catalog entry. The catalog decides what
 * exists, so adding a model never means touching this file, and a model without
 * an aspect ratio simply has no aspect ratio control.
 */
export function SettingField({ input, value, onChange }: SettingFieldProps) {
  const id = `setting-${input.name}`

  if (input.type === 'enum' && input.enum) {
    return (
      <label htmlFor={id} className="flex items-center gap-1.5 text-ink-muted text-xs">
        <span className="sr-only sm:not-sr-only">{input.label}</span>
        <select
          id={id}
          className={control}
          value={String(value ?? input.default ?? input.enum[0])}
          onChange={(event) => onChange(event.target.value)}
        >
          {input.enum.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (input.type === 'boolean') {
    return (
      <label htmlFor={id} className="flex items-center gap-1.5 text-ink-muted text-xs">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value ?? input.default)}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        {input.label}
      </label>
    )
  }

  if (input.type === 'integer' || input.type === 'number') {
    return (
      <label htmlFor={id} className="flex items-center gap-1.5 text-ink-muted text-xs">
        <span>{input.label}</span>
        <input
          id={id}
          type="number"
          className={`${control} w-20`}
          value={String(value ?? input.default ?? '')}
          min={input.min}
          max={input.max}
          step={input.type === 'integer' ? 1 : 0.1}
          onChange={(event) => {
            const parsed = event.target.value === '' ? undefined : Number(event.target.value)
            onChange(parsed)
          }}
        />
      </label>
    )
  }

  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-ink-muted text-xs">
      <span>{input.label}</span>
      <input
        id={id}
        type="text"
        className={`${control} w-32`}
        value={String(value ?? input.default ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
