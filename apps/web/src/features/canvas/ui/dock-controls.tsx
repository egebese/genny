'use client'

import { Button } from '@genny/ui/button.tsx'
import { Icon } from '@genny/ui/icon.tsx'
import type { PickableFamily } from '../family-list.ts'
import type { PickableModel } from '../model-list.ts'
import { GenerateButton } from './generate-button.tsx'
import { SettingsRow } from './settings-row.tsx'

type DockControlsProps = {
  families: PickableFamily[]
  family: PickableFamily
  model: PickableModel
  settings: Record<string, unknown>
  credits: { enabled: boolean; perUsd: number } | null
  pending: boolean
  blocked: boolean
  empty: boolean
  directing: boolean
  asking: boolean
  onDirect: () => void
  onModelChange: (family: PickableFamily) => void
  onSettingChange: (name: string, value: unknown) => void
  onSubmit: () => void
}

/**
 * The row under the prompt, in both of the box's modes.
 *
 * Directing hides the model and its settings, because none of them apply to a
 * question, and turns the button into one that costs a fraction of a cent
 * rather than one that shows a price. What it does not do is move: the toggle
 * and the button stay where they were, so switching mode does not relocate the
 * thing you are about to press.
 */
export function DockControls(props: DockControlsProps) {
  return (
    <div className="flex items-end gap-2 px-3 pt-2 pb-3">
      <button
        type="button"
        aria-pressed={props.directing}
        onClick={props.onDirect}
        title="Talk to the director"
        className={
          props.directing
            ? 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-(--radius-control) bg-surface-hover px-2.5 text-ink text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent'
            : 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-(--radius-control) bg-control px-2.5 text-ink-muted text-xs outline-none hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent'
        }
      >
        <Icon name="sliders" className="size-3.5" />
        Direct
      </button>

      {props.directing ? (
        <span className="flex-1" />
      ) : (
        <SettingsRow
          families={props.families}
          family={props.family}
          model={props.model}
          settings={props.settings}
          onModelChange={props.onModelChange}
          onSettingChange={props.onSettingChange}
        />
      )}

      {props.directing ? (
        <Button
          type="button"
          tone="primary"
          size="md"
          className="shrink-0 px-4"
          pending={props.asking}
          disabled={props.empty}
          onClick={props.onSubmit}
        >
          Ask
        </Button>
      ) : (
        <GenerateButton
          model={props.model}
          settings={props.settings}
          credits={props.credits}
          pending={props.pending}
          disabled={props.empty || props.blocked}
          onClick={props.onSubmit}
        />
      )}
    </div>
  )
}
