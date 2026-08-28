'use client'

import { Icon } from '@genny/ui/icon.tsx'
import { useState } from 'react'

const HEX = /^#[0-9a-fA-F]{6}$/
const MAX = 12

/**
 * The project's colours, as swatches.
 *
 * Hex rather than free text, because these are handed to agents as colours and
 * drawn as squares, and "warm terracotta" is neither. A native colour input
 * alongside the field, so picking one does not mean knowing its number.
 */
export function PaletteField({
  palette,
  onChange,
}: {
  palette: string[]
  onChange: (palette: string[]) => void
}) {
  const [draft, setDraft] = useState('#')

  const add = () => {
    const value = draft.trim().toLowerCase()
    if (!HEX.test(value) || palette.includes(value) || palette.length >= MAX) return
    onChange([...palette, value])
    setDraft('#')
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-ink text-sm">Palette</legend>

      {palette.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {palette.map((colour) => (
            <li key={colour}>
              <button
                type="button"
                onClick={() => onChange(palette.filter((one) => one !== colour))}
                aria-label={`Remove ${colour}`}
                className="flex items-center gap-2 rounded-(--radius-control) bg-control py-1 pr-2 pl-1 text-ink-muted text-xs outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  aria-hidden
                  className="size-5 rounded-[3px] ring-1 ring-line"
                  style={{ background: colour }}
                />
                <span className="font-mono tabular-nums">{colour}</span>
                <Icon name="close" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-faint text-sm">No colours yet.</p>
      )}

      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Pick a colour"
          value={HEX.test(draft) ? draft : '#888888'}
          onChange={(event) => setDraft(event.target.value)}
          className="size-(--size-touch) cursor-pointer rounded-(--radius-control) bg-control p-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <input
          type="text"
          aria-label="Colour as hex"
          value={draft}
          maxLength={7}
          placeholder="#0a0a0a"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            // Otherwise Enter here submits the whole form, saving the project
            // instead of adding the colour that was just typed.
            event.preventDefault()
            add()
          }}
          className="h-(--size-touch) w-28 rounded-(--radius-control) bg-control px-3 font-mono text-ink text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="button"
          onClick={add}
          disabled={!HEX.test(draft) || palette.length >= MAX}
          className="h-(--size-touch) rounded-(--radius-control) bg-control px-3 text-ink text-sm outline-none disabled:opacity-40 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
        >
          Add
        </button>
      </div>
    </fieldset>
  )
}
