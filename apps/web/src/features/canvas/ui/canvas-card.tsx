'use client'

import { Button } from '@genny/ui/button.tsx'
import { ConfirmInline } from '@genny/ui/confirm-inline.tsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { discardCanvas, retitleCanvas } from '../server/actions.ts'
import type { CanvasCard as Card } from '../server/canvas-list.ts'
import { copyCanvas } from '../server/copy-canvas.ts'

/**
 * One board. A board is a workspace rather than a deliverable: you reopen it,
 * swap a prompt and regenerate the two clips that changed, which is why the
 * count and the cover matter more than the date.
 */
export function CanvasCard({ canvas }: { canvas: Card }) {
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(canvas.title)

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
      {renaming ? (
        /*
         * `retitleCanvas` was written when boards were first added and never
         * given a caller, so every board anyone had ever made was called
         * "Untitled" and there was no way to change it.
         */
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            setRenaming(false)
            void retitleCanvas({ canvasId: canvas.id, title: draft }).then(() => router.refresh())
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`Name for ${canvas.title}`}
            className="min-w-0 flex-1 rounded-(--radius-control) border border-line bg-canvas px-2 py-1 text-ink text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button type="submit" tone="primary" size="sm">
            Save
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            tone="ghost"
            size="sm"
            onClick={() => {
              setDraft(canvas.title)
              setRenaming(true)
            }}
          >
            Rename
          </Button>
          <Button
            type="button"
            tone="ghost"
            size="sm"
            onClick={() => {
              void copyCanvas({ canvasId: canvas.id }).then(() => router.refresh())
            }}
          >
            Duplicate
          </Button>
          <ConfirmInline
            className="ml-auto"
            label="Delete"
            question={`Delete ${canvas.title} and everything on it?`}
            confirmLabel="Yes, delete"
            onConfirm={() => {
              void discardCanvas({ canvasId: canvas.id }).then(() => router.refresh())
            }}
          />
        </div>
      )}
    </li>
  )
}
