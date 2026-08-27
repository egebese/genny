'use client'

import { Button } from '@genny/ui/button.tsx'
import { ConfirmInline } from '@genny/ui/confirm-inline.tsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { discardProject, newProject } from '../server/actions.ts'
import type { ProjectCard } from '../server/project-list.ts'

/**
 * The boards you have. A board is a workspace rather than a deliverable: you
 * reopen it, swap a prompt and regenerate the two clips that changed, which is
 * why the count and the cover matter more than the date.
 */
export function ProjectGrid({ projects }: { projects: ProjectCard[] }) {
  const router = useRouter()
  const [creating, startCreating] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function create() {
    startCreating(async () => {
      const made = await newProject({ title: 'Untitled' })
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
        <Button type="button" tone="primary" pending={creating} onClick={create}>
          New canvas
        </Button>
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
        <ul aria-label="Canvases" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-col gap-2">
              <Link
                href={`/c/${project.id}`}
                className="group block overflow-hidden rounded-(--radius-panel) border border-line outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="aspect-video bg-surface">
                  {project.coverUrl ? (
                    <img
                      src={project.coverUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between gap-2 px-3 py-2">
                  <span className="truncate text-ink text-sm">{project.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                    {project.nodeCount} node{project.nodeCount === 1 ? '' : 's'}
                  </span>
                </div>
              </Link>
              <ConfirmInline
                className="self-start"
                label="Delete"
                question={`Delete ${project.title} and everything on it?`}
                confirmLabel="Yes, delete"
                onConfirm={() => {
                  void discardProject({ projectId: project.id }).then(() => router.refresh())
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
