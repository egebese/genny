'use client'

import { cn } from '@genny/ui/cn.ts'
import { Icon, type IconName } from '@genny/ui/icon.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@genny/ui/vendor/ui/popover.tsx'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { CHIP, CHIP_GLYPH, CHIP_LABEL, CHIP_VALUE } from './chip.ts'

export type SelectChipProps = {
  icon: IconName
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  /** How an option draws itself. Text when a word is all it is. */
  render?: (option: string) => ReactNode
}

/**
 * A dropdown that is ours.
 *
 * A native `<select>` renders its list in the platform's own chrome: white on
 * macOS whatever the page says, a different metric on every OS, and no way to
 * put a shape next to an option. The rest of the dock is one dark language and
 * the one place people open most often was not speaking it.
 */
export function SelectChip(props: SelectChipProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={props.label} className={CHIP}>
        <Icon name={props.icon} className={CHIP_GLYPH} />
        <span className={CHIP_LABEL}>{props.label}</span>
        <span className={CHIP_VALUE}>{props.value}</span>
        <Icon name="chevron" className="size-3 text-ink-faint" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        aria-label={props.label}
        // Sized to what is in it, never narrower than the chip it came from.
        // Capped and scrolling. A voice list is thirty options and a couple of
        // endpoints offer more; without this the popover runs off the screen
        // and the last option cannot be reached at all.
        className="panel max-h-72 w-auto min-w-(--radix-popover-trigger-width) max-w-64 overflow-y-auto rounded-(--radius-panel) p-1"
      >
        <ul>
          {props.options.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => {
                  props.onChange(option)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-xs',
                  'outline-none hover:bg-surface-hover focus-visible:bg-surface-hover',
                  option === props.value ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {props.render ? props.render(option) : <span className="truncate">{option}</span>}
                {option === props.value ? (
                  <Icon name="check" className="ml-auto size-3 shrink-0 text-accent" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
