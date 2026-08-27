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
import { useMemo, useState } from 'react'
import type { PickableModel } from '../model-list.ts'

type ModelPickerProps = {
  models: PickableModel[]
  selected: PickableModel
  onSelect: (model: PickableModel) => void
}

/**
 * A non-modal popover: it does not lock the page or trap focus, so the prompt
 * behind it stays readable while you choose. Categories on the left, models on
 * the right, search across both.
 */
export function ModelPicker({ models, selected, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState<string | null>(null)

  const groups = useMemo(() => [...new Set(models.map((m) => m.group))], [models])
  const visible = group ? models.filter((m) => m.group === group) : models

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Model: ${selected.displayName}`}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border',
          'border-line bg-surface px-3 text-sm text-ink transition-colors hover:bg-surface-hover',
          'outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <span className="max-w-40 truncate">{selected.displayName}</span>
        <span aria-hidden className="text-ink-faint">
          ▾
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        aria-label="Choose a model"
        className="chrome-edge w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-(--radius-panel) p-0"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder="Search models" className="border-line" />
          <div className="flex max-h-80">
            <ul className="w-32 shrink-0 border-line border-r py-1 text-sm">
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
            <CommandList className="max-h-80 flex-1">
              <CommandEmpty className="px-3 py-6 text-center text-ink-faint text-sm">
                Nothing matches that.
              </CommandEmpty>
              <CommandGroup className="p-1">
                {visible.map((model) => (
                  <CommandItem
                    key={model.endpointId}
                    value={`${model.displayName} ${model.group} ${model.description}`}
                    onSelect={() => {
                      onSelect(model)
                      setOpen(false)
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-(--radius-control) p-2 data-[selected=true]:bg-surface-hover"
                  >
                    <ModelThumb model={model} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate font-medium text-sm">{model.displayName}</span>
                        <span className="shrink-0 text-ink-faint text-xs tabular-nums">
                          {model.priceLabel}
                        </span>
                      </span>
                      {/* What it is for. Picking between eleven models on price
                          alone is picking on the only axis that does not matter. */}
                      <span className="line-clamp-2 text-ink-muted text-xs">
                        {model.description}
                      </span>
                    </span>
                    {model.endpointId === selected.endpointId ? (
                      <span className="text-accent">
                        <span className="sr-only">Selected</span>✓
                      </span>
                    ) : null}
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
          'w-full truncate px-3 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent',
          active ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:text-ink',
        )}
      >
        {label}
      </button>
    </li>
  )
}

function ModelThumb({ model }: { model: PickableModel }) {
  if (!model.thumbnailUrl) {
    return <span className="size-9 shrink-0 rounded-(--radius-control) bg-canvas" />
  }
  return (
    // Plain img: these are remote thumbnails on a CDN we allowlist in the CSP,
    // and next/image would add a proxy hop for no gain at this size.
    <img
      src={model.thumbnailUrl}
      alt=""
      loading="lazy"
      className="size-9 shrink-0 rounded-(--radius-control) object-cover"
    />
  )
}
