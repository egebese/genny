'use client'

import { ConfirmInline } from '@genny/ui/confirm-inline.tsx'
import { CopyButton } from '@genny/ui/copy-button.tsx'
import { Icon } from '@genny/ui/icon.tsx'
import type { CanvasNodeView } from '../node-view.ts'
import type { JobDetail } from '../server/job-detail.ts'
import type { ReuseRequest } from './node-panel.tsx'

const ACTION =
  'flex size-8 items-center justify-center rounded-(--radius-control) text-ink-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent'

/**
 * One row of icons, not four labels wrapping onto two lines.
 *
 * Every one of them is a verb people already know the shape of, and the tooltip
 * and the accessible name still say the word. Delete keeps its own, because a
 * destructive action should be readable before it is pressed.
 */
export function PanelActions(props: {
  node: CanvasNodeView
  detail: JobDetail | null
  onMention: (label: string) => void
  onReuse: (request: ReuseRequest) => void
  onDelete: () => void
}) {
  const { node, detail } = props
  const failed = node.status === 'failed'

  return (
    <footer className="flex items-center gap-1 border-line border-t px-2 py-2">
      {node.url ? (
        <a href={node.url} download title="Download" aria-label="Download" className={ACTION}>
          <Icon name="download" className="size-4" />
        </a>
      ) : null}

      {node.label ? (
        <button
          type="button"
          title="Use as reference"
          aria-label="Use as reference"
          className={ACTION}
          onClick={() => props.onMention(node.label ?? '')}
        >
          <Icon name="link" className="size-4" />
        </button>
      ) : null}

      {detail ? (
        <button
          type="button"
          /*
           * The same action either way: it loads the model, the prompt and the
           * settings back into the dock. On a failed node that is a retry, and
           * calling it "Reuse settings" there meant the one thing somebody
           * wanted was hidden behind a name for something else.
           *
           * It stops at the dock rather than submitting. A failed generation
           * cost nothing, but the next one will, and the price belongs in front
           * of the person before the money moves.
           */
          title={failed ? 'Try again' : 'Reuse settings'}
          aria-label={failed ? 'Try again' : 'Reuse settings'}
          className={ACTION}
          onClick={() =>
            props.onReuse({
              modelId: detail.endpointId,
              prompt: detail.prompt,
              settings: detail.settings,
            })
          }
        >
          <Icon name="refresh" className="size-4" />
        </button>
      ) : null}

      {detail ? (
        <CopyButton
          value={diagnostics(detail)}
          label="ids for support"
          className="size-8 text-ink-muted hover:text-ink"
        />
      ) : null}

      <span className="ml-auto">
        <ConfirmInline
          label="Delete"
          question="Remove this from the board?"
          confirmLabel="Remove"
          onConfirm={props.onDelete}
        />
      </span>
    </footer>
  )
}

/**
 * The ids, on one line, for a support conversation.
 *
 * Not printed. Four rows of uuids at eye level are the least interesting true
 * thing a details panel can say, and retyping one off a screen is how the wrong
 * uuid ends up in the ticket. Copyable and out of the way is both halves.
 */
function diagnostics(detail: JobDetail): string {
  return [
    `endpoint: ${detail.endpointId}`,
    `job: ${detail.jobId}`,
    detail.falRequestId ? `fal: ${detail.falRequestId}` : null,
    `created: ${detail.createdAt}`,
  ]
    .filter((line) => line !== null)
    .join('\n')
}
