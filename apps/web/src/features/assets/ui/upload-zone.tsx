'use client'

import { cn } from '@genny/ui/cn.ts'
import { useState, useTransition } from 'react'
import type { AssetView } from '../server/list.ts'

type UploadZoneProps = {
  onUploaded: (asset: AssetView) => void
}

/**
 * Drop or pick, inline on the page rather than behind something that opens.
 *
 * The whole area is a <label> for the file input, so clicking it opens the picker
 * with no JavaScript and no click handler, and the keyboard reaches it through
 * the input itself. That is also what makes the drop handlers legitimate: they
 * sit on an element that is already interactive.
 */
export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function send(files: FileList | null) {
    const chosen = [...(files ?? [])]
    if (chosen.length === 0) return
    setError(null)

    startTransition(async () => {
      for (const file of chosen) {
        const body = new FormData()
        body.append('file', file)
        const response = await fetch('/api/assets', { method: 'POST', body }).catch(() => null)
        const result = (await response?.json().catch(() => null)) as {
          ok: boolean
          asset?: AssetView
          reason?: string
        } | null

        if (result?.ok && result.asset) onUploaded(result.asset)
        else setError(result?.reason ?? `Could not upload ${file.name}.`)
      }
    })
  }

  return (
    <div>
      <label
        htmlFor="asset-upload"
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          send(event.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-(--radius-panel) border border-dashed p-8 text-center transition-colors',
          'focus-within:ring-2 focus-within:ring-accent',
          over ? 'border-accent bg-surface-hover' : 'border-line bg-surface hover:bg-surface-hover',
        )}
      >
        <span className="font-medium text-ink text-sm">
          {pending ? 'Uploading' : 'Drop files here, or click to choose'}
        </span>
        <span className="text-ink-muted text-sm">
          Images, video or audio. They become <span className="font-mono">@mentions</span>.
        </span>
        <input
          id="asset-upload"
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="sr-only"
          disabled={pending}
          onChange={(event) => send(event.target.files)}
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
