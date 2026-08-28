'use client'

import type { ModelInput } from '@genny/models/schema.ts'
import { Icon } from '@genny/ui/icon.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@genny/ui/vendor/ui/popover.tsx'
import { useState } from 'react'
import { CHIP, CHIP_GLYPH, CHIP_LABEL, CHIP_VALUE } from './chip.ts'
import { RowField } from './row-field.tsx'

export type Row = Record<string, unknown>

/**
 * A control that is a list of rows: LoRA weights, keyframes, cast elements.
 *
 * A popover rather than a route or a panel, and non-modal like everything else
 * on this dock: the prompt stays live behind it, which matters because the rows
 * are usually being filled in while reading the sentence they belong to.
 *
 * The chip counts rather than lists. Two LoRA paths are forty characters of
 * hash and the dock is one line high.
 */
export function RowsChip({
  input,
  rows,
  onChange,
}: {
  input: ModelInput
  rows: Row[]
  onChange: (rows: Row[]) => void
}) {
  const [open, setOpen] = useState(false)
  const fields = input.fields ?? []
  const full = input.max !== undefined && rows.length >= input.max

  const write = (index: number, name: string, value: unknown) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, [name]: value } : row)))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={input.label} className={CHIP}>
        <Icon name="copies" className={CHIP_GLYPH} />
        <span className={CHIP_LABEL}>{input.label}</span>
        <span className={CHIP_VALUE}>{rows.length || 'none'}</span>
        <Icon name="chevron" className="size-3 text-ink-faint" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        aria-label={input.label}
        // Capped and scrolling: three keyframes is a tall list, and a popover
        // that runs off the top of the board is one nobody can finish filling in.
        className="panel max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-(--radius-panel) p-2"
      >
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            // Rows have no id of their own and reorder only by being removed,
            // so the index is what identifies one.
            <li key={`row-${index}`} className="flex items-start gap-1.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {fields.map((field) => (
                  <RowField
                    key={field.name}
                    field={field}
                    value={row[field.name]}
                    onChange={(value) => write(index, field.name, value)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label={`Remove ${input.label} ${index + 1}`}
                onClick={() => onChange(rows.filter((_, at) => at !== index))}
                className="mt-0.5 rounded-[3px] p-1 text-ink-faint outline-none hover:bg-surface-hover hover:text-danger focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon name="trash" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        {rows.length === 0 ? (
          <p className="px-1 py-2 text-ink-faint text-xs">Nothing yet.</p>
        ) : null}

        <button
          type="button"
          disabled={full}
          onClick={() => onChange([...rows, {}])}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-(--radius-control) bg-control py-1.5 text-ink-muted text-xs outline-none hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="plus" className="size-3" />
          {full ? `${input.max} is the most it takes` : `Add ${input.label.toLowerCase()}`}
        </button>
      </PopoverContent>
    </Popover>
  )
}
