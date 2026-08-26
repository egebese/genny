import { loadCatalog } from '@genny/models/catalog.ts'
import { Dock } from '@genny/ui/dock.tsx'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Image' }

/**
 * Phase 0 shell: it proves the catalog loads, the layout holds on a phone, and
 * the prompt dock sits where it belongs. The composer, model picker and mention
 * input arrive in phase 1.
 */
export default async function ImageStudioPage() {
  const models = (await loadCatalog()).filter((entry) => entry.definition.modality === 'image')

  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Image</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {models.length} model{models.length === 1 ? '' : 's'} available.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map(({ definition }) => (
            <li
              key={definition.endpointId}
              className="rounded-(--radius-panel) border border-line bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{definition.displayName}</span>
                <span className="text-xs text-ink-faint">{definition.group}</span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">{definition.description}</p>
              <p className="mt-3 font-mono text-xs text-ink-faint">
                ${definition.pricing.unitPriceUsd} / {definition.pricing.unit}
              </p>
            </li>
          ))}
        </ul>
      </main>

      <Dock>
        <div className="rounded-(--radius-panel) border border-line bg-surface px-4 py-3 text-sm text-ink-faint">
          The prompt composer lands in phase 1.
        </div>
      </Dock>
    </>
  )
}
