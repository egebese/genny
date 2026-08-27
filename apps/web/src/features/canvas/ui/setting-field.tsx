'use client'

import type { ModelInput } from '@genny/models/schema.ts'

type SettingFieldProps = {
  input: ModelInput
  value: unknown
  onChange: (value: unknown) => void
}

/*
 * Every control is the same chip: a faint label and the value, side by side, at
 * the height of the model button next to it. Labelled form rows made the dock
 * read as a settings panel with a prompt attached, when the prompt is the point
 * and these are adjustments to it.
 *
 * No border. Inside a panel these already sit one shade up from what is behind
 * them, and an outline on top of that is a second way of saying the same thing.
 */
const pill =
  'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-(--radius-control) bg-control px-2.5 text-xs transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-accent'
const label = 'text-ink-faint'
const field = 'bg-transparent text-ink outline-none'

/**
 * Renders one control from the model's catalog entry. The catalog decides what
 * exists, so adding a model never means touching this file, and a model without
 * an aspect ratio simply has no aspect ratio control.
 */
export function SettingField({ input, value, onChange }: SettingFieldProps) {
  const id = `setting-${input.name}`

  if (input.type === 'enum' && input.enum) {
    return (
      <span className={pill}>
        <label htmlFor={id} className={label}>
          {input.label}
        </label>
        <select
          id={id}
          className={`${field} -mr-1 cursor-pointer appearance-none pr-3`}
          value={String(value ?? input.default ?? input.enum[0])}
          onChange={(event) => onChange(event.target.value)}
        >
          {input.enum.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span aria-hidden className="-ml-2 pointer-events-none text-ink-faint">
          ▾
        </span>
      </span>
    )
  }

  if (input.type === 'boolean') {
    const on = Boolean(value ?? input.default)
    return (
      <label
        htmlFor={id}
        className={`${pill} cursor-pointer ${on ? 'text-accent' : 'text-ink-faint'}`}
      >
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={on}
          onChange={(event) => onChange(event.target.checked)}
        />
        {input.label}
      </label>
    )
  }

  if (input.type === 'integer' || input.type === 'number') {
    return (
      <span className={pill}>
        <label htmlFor={id} className={label}>
          {input.label}
        </label>
        <input
          id={id}
          type="number"
          className={`${field} w-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
          value={String(value ?? input.default ?? '')}
          min={input.min}
          max={input.max}
          step={input.type === 'integer' ? 1 : 0.1}
          onChange={(event) => {
            const parsed = event.target.value === '' ? undefined : Number(event.target.value)
            onChange(parsed)
          }}
        />
      </span>
    )
  }

  return (
    <span className={pill}>
      <label htmlFor={id} className={label}>
        {input.label}
      </label>
      <input
        id={id}
        type="text"
        className={`${field} w-24`}
        value={String(value ?? input.default ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  )
}
