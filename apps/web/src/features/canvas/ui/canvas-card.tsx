'use client'

import { ConfirmInline } from '@genny/ui/confirm-inline.tsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { discardCanvas } from '../server/actions.ts'
import type { CanvasCard as Card } from '../server/canvas-list.ts'

/**
 * One board. A board is a workspace rather than a deliverable: you reopen it,
 * swap a prompt and regenerate the two clips that changed, which is why the
 * count and the cover matter more than the date.
 */
export function CanvasCard({ canvas }: { canvas: Card }) {
  const router = useRouter()

  return (
    <li className="flex flex-col gap-2">
      <Link
        href={`/c/${canvas.id}`}
        className="group block overflow-hidden rounded-(--radius-panel) border border-line outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="aspect-video bg-surface">
          {canvas.coverUrl ? (
            <img
              src={canvas.coverUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex items-baseline justify-between gap-2 px-3 py-2">
          <span className="truncate text-ink text-sm">{canvas.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-ink-faint uppercase tracking-wider">
            {canvas.nodeCount} node{canvas.nodeCount === 1 ? '' : 's'}
          </span>
        </div>
      </Link>
      <ConfirmInline
        className="self-start"
        label="Delete"
        question={`Delete ${canvas.title} and everything on it?`}
        confirmLabel="Yes, delete"
        onConfirm={() => {
          void discardCanvas({ canvasId: canvas.id }).then(() => router.refresh())
        }}
      />
    </li>
  )
}
