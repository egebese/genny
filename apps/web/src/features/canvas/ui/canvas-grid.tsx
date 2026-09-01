'use client'

import { Button } from '@genny/ui/button.tsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { startProject } from '@/features/projects/server/lifecycle.ts'
import { newCanvas } from '../server/actions.ts'
import type { ProjectCanvases } from '../server/canvas-list.ts'
import { CanvasCard } from './canvas-card.tsx'

/**
 * Every board, grouped under the project it belongs to.
 *
 * Grouped rather than flat because a project is the thing that recurs: the same
 * product across a stills board, a motion board and a cutdown. A flat row of
 * boards gave no indication which three of the nine belonged together.
 */
export function CanvasGrid({ projects }: { projects: ProjectCanvases[] }) {
  const router = useRouter()
  const [creating, startCreating] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function create(projectId?: string) {
    startCreating(async () => {
      const made = await newCanvas({ title: 'Untitled', ...(projectId ? { projectId } : {}) })
      if (!made) {
        setError('Could not start a new canvas. Try again.')
        return
      }
      router.push(`/c/${made.id}`)
    })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">Canvases</h1>
        <div className="flex items-center gap-2">
          {/* Projects could only ever come into existence implicitly, through
              `defaultProject` on the first canvas, so everybody had exactly one
              and no way to start a second. */}
          <Button
            type="button"
            tone="ghost"
            pending={creating}
            onClick={() =>
              startCreating(async () => {
                await startProject({ title: 'New project' })
                router.refresh()
              })
            }
          >
            New project
          </Button>
          <Button type="button" tone="primary" pending={creating} onClick={() => create()}>
            New canvas
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-danger text-sm">
          {error}
        </p>
      ) : null}

      {projects.length === 0 ? (
        <p className="text-ink-muted">
          Nothing here yet. A canvas is where a prompt, its result and everything you make from it
          stay side by side.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {projects.map((project) => (
            <section key={project.id}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <Link
                  href={`/p/${project.id}`}
                  className="truncate rounded-(--radius-control) font-medium text-ink outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {project.title}
                </Link>
                <Button
                  type="button"
                  tone="ghost"
                  size="sm"
                  pending={creating}
                  onClick={() => create(project.id)}
                >
                  Add canvas
                </Button>
              </div>

              {project.canvases.length === 0 ? (
                <p className="text-ink-faint text-sm">No boards in this project yet.</p>
              ) : (
                <ul aria-label="Canvases" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {project.canvases.map((canvas) => (
                    <CanvasCard key={canvas.id} canvas={canvas} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
