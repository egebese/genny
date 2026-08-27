'use client'

import { cn } from '@genny/ui/cn.ts'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@genny/ui/vendor/ui/command.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@genny/ui/vendor/ui/popover.tsx'
import { useMemo, useRef, useState } from 'react'
import type { PickableFamily } from '../family-list.ts'
import { ModelCard } from './model-card.tsx'

type ModelPickerProps = {
  models: PickableFamily[]
  selected: PickableFamily
  onSelect: (model: PickableFamily) => void
}

/**
 * A non-modal popover: it does not lock the page or trap focus, so the prompt
 * behind it stays readable while you choose. Categories on the left, models on
 * the right, search across both.
 */
export function ModelPicker({ models, selected, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [offset, setOffset] = useState(8)

  const groups = useMemo(() => [...new Set(models.map((m) => m.group))], [models])
  const visible = group ? models.filter((m) => m.group === group) : models

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        /*
         * Clear the whole dock, not just the chip. The trigger sits at the
         * bottom of the dock, so an offset measured from it opens the picker
         * flush against the prompt with nothing between them.
         */
        if (next) setOffset(dockClearance(trigger.current))
        setOpen(next)
      }}
    >
      <PopoverTrigger
        ref={trigger}
        aria-label={`Model: ${selected.name}`}
        // Exactly the setting chips beside it, one size up in text: the model is
        // a setting too, and giving it its own shape made it read as chrome.
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-(--radius-control)',
          'bg-control px-2.5 text-ink text-xs transition-colors hover:bg-surface-hover',
          'outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        {selected.markUrl ? (
          <img src={selected.markUrl} alt="" className="size-3.5 shrink-0" />
        ) : null}
        <span className="max-w-40 truncate">{selected.name}</span>
        <span aria-hidden className="text-ink-faint">
          ▾
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={offset}
        /*
         * The dock sits on the bottom edge, so without this the popover opens
         * flush against the frame with nothing under it. Radix measures the
         * viewport, not our layout, and does not know the dock is there.
         */
        collisionPadding={16}
        aria-label="Choose a model"
        /*
         * A fixed size, not a maximum. The card used to grow and shrink with
         * whatever the filter left in it, so every click moved the thing you
         * were about to click next.
         */
        className="panel h-[min(30rem,70dvh)] w-[min(54rem,calc(100vw-2rem))] overflow-hidden rounded-(--radius-panel) p-0"
      >
        <Command className="flex h-full flex-col bg-transparent">
          <CommandInput placeholder="Search models" className="border-line" />
          {/* Stacked on a phone: a category rail plus a grid in 343px leaves no
              room for either, so the rail becomes a row that scrolls sideways. */}
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <ul className="flex shrink-0 gap-1 overflow-x-auto border-line border-b p-1 text-sm sm:w-40 sm:flex-col sm:gap-0 sm:overflow-y-auto sm:border-r sm:border-b-0 scrollbar-none">
              <CategoryButton active={group === null} onClick={() => setGroup(null)} label="All" />
              {groups.map((name) => (
                <CategoryButton
                  key={name}
                  active={group === name}
                  onClick={() => setGroup(name)}
                  label={name}
                />
              ))}
            </ul>
            <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto">
              <CommandEmpty className="px-3 py-6 text-center text-ink-faint text-sm">
                Nothing matches that.
              </CommandEmpty>
              {/* cmdk puts the items in a nested container, so the grid has to
                  reach into it or every card ends up in one column. */}
              <CommandGroup className="p-2 [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-2 [&_[cmdk-group-items]]:gap-2 lg:[&_[cmdk-group-items]]:grid-cols-3">
                {visible.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`${model.name} ${model.group}`}
                    onSelect={() => {
                      onSelect(model)
                      setOpen(false)
                    }}
                    className="cursor-pointer rounded-(--radius-control) p-1 data-[selected=true]:bg-surface-hover"
                  >
                    <ModelCard model={model} current={model.id === selected.id} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** How far above the trigger the dock's own top edge is, plus room to breathe. */
function dockClearance(trigger: HTMLElement | null): number {
  const dock = trigger?.closest('[data-dock]')
  if (!trigger || !dock) return 8
  return Math.max(8, trigger.getBoundingClientRect().top - dock.getBoundingClientRect().top + 12)
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'w-full shrink-0 truncate rounded-(--radius-control) px-3 py-1.5 text-left whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
          active ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:text-ink',
        )}
      >
        {label}
      </button>
    </li>
  )
}
