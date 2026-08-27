'use client'

import { cn } from '@genny/ui/cn.ts'
import { Icon } from '@genny/ui/icon.tsx'
import { useState } from 'react'
import type { PickableModel } from '../model-list.ts'
import { ModelPicker } from './model-picker.tsx'
import { SettingField } from './setting-field.tsx'
import { CHIP } from './settings/chip.ts'
import { isPrimary } from './settings/priority.ts'

type SettingsRowProps = {
  models: PickableModel[]
  model: PickableModel
  settings: Record<string, unknown>
  onModelChange: (model: PickableModel) => void
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
  const primary = props.model.inputs.filter((input) => isPrimary(input.name))
  const secondary = props.model.inputs.filter((input) => !isPrimary(input.name))

  const control = (input: (typeof primary)[number]) => (
    <SettingField
      key={input.name}
      input={input}
      value={props.settings[input.name]}
      onChange={(value) => props.onSettingChange(input.name, value)}
    />
  )

  return (
    <div className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-0.5 py-0.5 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] scrollbar-none">
      <ModelPicker models={props.models} selected={props.model} onSelect={props.onModelChange} />
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
  )
}
