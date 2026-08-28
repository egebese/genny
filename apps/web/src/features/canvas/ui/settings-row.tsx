'use client'

import { cn } from '@genny/ui/cn.ts'
import { Icon } from '@genny/ui/icon.tsx'
import { useRef, useState } from 'react'
import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'
import { ModelPicker } from './model-picker.tsx'
import { SettingField } from './setting-field.tsx'
import { CHIP } from './settings/chip.ts'
import { isPrimary } from './settings/priority.ts'
import { useOverflow } from './settings/use-overflow.ts'

type SettingsRowProps = {
  families: PickableFamily[]
  family: PickableFamily
  /** The endpoint the attachments resolved to; its controls are what show. */
  model: PickableModel
  settings: Record<string, unknown>
  onModelChange: (family: PickableFamily) => void
  onSettingChange: (name: string, value: unknown) => void
}

/**
 * The model and its controls, in one line under the prompt.
 *
 * One line that scrolls sideways rather than a block that wraps: a second row
 * pushes the prompt up the screen on a phone, and these are adjustments to the
 * prompt rather than the point of the dock.
 *
 * Four of them at a time. Quality, length, shape and how many are what changes
 * between one generation and the next; format and seed and guidance are set
 * once, if ever, and eight chips in a row made the four that matter exactly as
 * hard to find as the four that do not.
 */
export function SettingsRow(props: SettingsRowProps) {
  const [showAll, setShowAll] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const primary = props.model.inputs.filter(isPrimary)
  const secondary = props.model.inputs.filter((input) => !isPrimary(input))
  const edges = useOverflow(scroller, `${props.model.endpointId}:${showAll}`)

  const nudge = (by: number) => scroller.current?.scrollBy({ left: by, behavior: 'smooth' })

  const control = (input: (typeof primary)[number]) => (
    <SettingField
      key={input.name}
      input={input}
      value={props.settings[input.name]}
      onChange={(value) => props.onSettingChange(input.name, value)}
    />
  )

  return (
    <div className="group/row relative min-w-0 flex-1">
      <div
        ref={scroller}
        className={cn(
          '-mx-0.5 flex items-center gap-1.5 overflow-x-auto px-0.5 py-0.5 scrollbar-none',
          // The fade only belongs on the side there is more content on.
          edges.right && 'mask-r',
          edges.left && 'mask-l',
        )}
      >
        <ModelPicker
          models={props.families}
          selected={props.family}
          onSelect={props.onModelChange}
        />
        {primary.map(control)}

        {secondary.length > 0 ? (
          <button
            type="button"
            aria-expanded={showAll}
            aria-label={showAll ? 'Fewer settings' : 'More settings'}
            onClick={() => setShowAll((open) => !open)}
            className={cn(CHIP, 'px-2', showAll ? 'bg-surface-hover text-ink' : 'text-ink-faint')}
          >
            <Icon name="sliders" className="size-3.5" />
          </button>
        ) : null}

        {showAll ? secondary.map(control) : null}
      </div>

      {/* Only when there is somewhere to go, and only under a pointer. The
          scrollbar is hidden on purpose here, so without these opening the
          adjust button silently put four controls past the edge. */}
      <Arrow side="left" show={edges.left} onClick={() => nudge(-200)} />
      <Arrow side="right" show={edges.right} onClick={() => nudge(200)} />
    </div>
  )
}

function Arrow(props: { side: 'left' | 'right'; show: boolean; onClick: () => void }) {
  if (!props.show) return null
  return (
    <button
      type="button"
      aria-label={props.side === 'left' ? 'Scroll settings left' : 'Scroll settings right'}
      onClick={props.onClick}
      className={cn(
        'absolute top-1/2 flex size-6 -translate-y-1/2 items-center justify-center',
        'rounded-full bg-surface-hover text-ink shadow-(--shadow-panel)',
        'opacity-0 transition-opacity outline-none',
        'group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent',
        props.side === 'left' ? '-left-1' : '-right-1',
      )}
    >
      <Icon
        name="chevron"
        className={cn('size-3', props.side === 'left' ? 'rotate-90' : '-rotate-90')}
      />
    </button>
  )
}
