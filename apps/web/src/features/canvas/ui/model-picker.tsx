'use client'

import type { MediaKind } from '@genny/models/aspect.ts'
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
import { matching } from '../model-search.ts'
import { CategoryRail } from './category-rail.tsx'
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
  const [query, setQuery] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const [offset, setOffset] = useState(8)

  /*
   * Every category any endpoint covers, and a model shows in all of its own.
   * Kling appears under Text to Video and under Image to Video, because it
   * does both and which one runs is decided by what you attach.
   */
  // Browsing a category, a card names that one rather than its plainest task:
  // picked out of Image to Video it should not go on saying Text to Video.
  const groups = useMemo(() => {
    const seen = new Map<string, MediaKind>()
    for (const model of models) {
      for (const name of model.groups) if (!seen.has(name)) seen.set(name, model.modality)
    }
    return [...seen].map(([name, modality]) => ({ name, modality }))
  }, [models])
  const inGroup = group ? models.filter((m) => m.groups.includes(group)) : models
  const visible = useMemo(() => matching(inGroup, query), [inGroup, query])

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
        if (!next) setQuery('')
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
        {/* Filtered here rather than by cmdk, which scores letters found
            scattered in order and ranked FLUX above the upscalers for
            "upscale". `matching` is ours and has a test. */}
        <Command shouldFilter={false} className="flex h-full flex-col bg-transparent">
          {/* cmdk draws its input as a full-bleed strip with a rule under it,
              which reads as a browser chrome bar rather than as part of the
              panel. Restyled through its own slot rather than by editing the
              vendored file, which an upstream `shadcn add` would overwrite. */}
          <div className={SEARCH}>
            <CommandInput placeholder="Search models" value={query} onValueChange={setQuery} />
          </div>
          {/* Stacked on a phone: a category rail plus a grid in 343px leaves no
              room for either, so the rail becomes a row that scrolls sideways. */}
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <CategoryRail groups={groups} chosen={group} onChoose={setGroup} />
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
                    value={model.id}
                    onSelect={() => {
                      onSelect(model)
                      setOpen(false)
                    }}
                    className="cursor-pointer rounded-(--radius-control) p-1 data-[selected=true]:bg-surface-hover"
                  >
                    <ModelCard
                      model={model}
                      current={model.id === selected.id}
                      {...(group ? { group } : {})}
                    />
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

/**
 * The search row, as a contained field on a header band.
 *
 * Reaches into cmdk's markup because its input hardcodes its own wrapper. The
 * slot attribute is the seam it offers for exactly this.
 */
const SEARCH = cn(
  'border-line border-b p-2',
  '[&_[data-slot=command-input-wrapper]]:h-9 [&_[data-slot=command-input-wrapper]]:gap-2',
  '[&_[data-slot=command-input-wrapper]]:rounded-(--radius-control)',
  '[&_[data-slot=command-input-wrapper]]:border-0 [&_[data-slot=command-input-wrapper]]:bg-control',
  '[&_[data-slot=command-input-wrapper]]:px-2.5',
  '[&_[data-slot=command-input-wrapper]>svg]:text-ink-faint [&_[data-slot=command-input-wrapper]>svg]:opacity-100',
  '[&_[data-slot=command-input]]:h-9 [&_[data-slot=command-input]]:py-0',
  '[&_[data-slot=command-input]]:text-ink [&_[data-slot=command-input]]:placeholder:text-ink-faint',
)

/** How far above the trigger the dock's own top edge is, plus room to breathe. */
function dockClearance(trigger: HTMLElement | null): number {
  const dock = trigger?.closest('[data-dock]')
  if (!trigger || !dock) return 8
  return Math.max(8, trigger.getBoundingClientRect().top - dock.getBoundingClientRect().top + 12)
}
