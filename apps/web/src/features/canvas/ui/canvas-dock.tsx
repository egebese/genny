'use client'

import { Dock } from '@genny/ui/dock.tsx'
import type { Ref } from 'react'
import type { MentionableView } from '@/features/assets/server/list.ts'
import type { PickableModel } from '../model-list.ts'
import type { Attachment, MentionChip } from './attachment-strip.tsx'
import { KeyGate } from './key-gate.tsx'
import { PromptDock } from './prompt-dock.tsx'

type CanvasDockProps = {
  ref: Ref<HTMLDivElement>
  models: PickableModel[]
  model: PickableModel
  mentionables: MentionableView[]
  attachments: Attachment[]
  mentions: MentionChip[]
  resolvable: ReadonlySet<string>
  suggestion: PickableModel | null
  settings: Record<string, unknown>
  prompt: string
  pending: boolean
  error: string | null
  ready: boolean
  credits: { balance: string; holdBalance: string; perUsd: number } | null
  onRemoveAttachment: (index: number) => void
  onModelChange: (model: PickableModel) => void
  onSettingChange: (name: string, value: unknown) => void
  onPromptChange: (next: string) => void
  onSubmit: (prompt: string) => void
  onReady: () => void
}

/**
 * The dock over the board, or the gate that has to be passed before there is one.
 *
 * `pointer-events-none` on the wrapper so the strip either side of the dock
 * still reaches the board underneath; the dock's own card turns them back on.
 */
export function CanvasDock(props: CanvasDockProps) {
  return (
    <div ref={props.ref} className="pointer-events-none">
      <Dock>
        {props.ready ? (
          <PromptDock
            models={props.models}
            model={props.model}
            mentionables={props.mentionables}
            attachments={props.attachments}
            mentions={props.mentions}
            resolvable={props.resolvable}
            suggestion={props.suggestion}
            onRemoveAttachment={props.onRemoveAttachment}
            onModelChange={props.onModelChange}
            settings={props.settings}
            onSettingChange={props.onSettingChange}
            pending={props.pending}
            error={props.error}
            credits={props.credits ? { enabled: true, perUsd: props.credits.perUsd } : null}
            prompt={props.prompt}
            onPromptChange={props.onPromptChange}
            onSubmit={props.onSubmit}
          />
        ) : (
          <KeyGate onReady={props.onReady} />
        )}
      </Dock>
    </div>
  )
}
