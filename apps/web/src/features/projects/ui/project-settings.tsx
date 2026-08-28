'use client'

import { Button } from '@genny/ui/button.tsx'
import { Field } from '@genny/ui/field.tsx'
import { useState, useTransition } from 'react'
import { saveProject } from '../server/actions.ts'
import type { ProjectView } from '../server/project-page.ts'
import { PaletteField } from './palette-field.tsx'

/**
 * What the project is, in one form.
 *
 * A route rather than a settings panel over the board, which is what the no
 * modal rule asks for and also what this deserves: the brief is read far more
 * often than it is written, and it is the thing every agent is told before it
 * is told anything else.
 */
export function ProjectSettings({ project }: { project: ProjectView }) {
  const [title, setTitle] = useState(project.title)
  const [brief, setBrief] = useState(project.brief)
  const [palette, setPalette] = useState(project.palette)
  const [saving, startSaving] = useTransition()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        startSaving(async () => {
          const saved = await saveProject({ projectId: project.id, title, brief, palette })
          setNotice(saved.ok ? 'Saved.' : (saved.reason ?? 'Could not save that.'))
        })
      }}
    >
      <Field id="project-title" label="Name" required>
        {(wiring) => (
          <input
            {...wiring}
            type="text"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            className="h-(--size-touch) w-full rounded-(--radius-control) bg-control px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        )}
      </Field>

      <Field
        id="project-brief"
        label="What this project is"
        help="Every agent is told this before it is told anything else. Who it is for, what it is selling, what it must never look like."
      >
        {(wiring) => (
          <textarea
            {...wiring}
            rows={6}
            value={brief}
            maxLength={4000}
            onChange={(event) => setBrief(event.target.value)}
            className="w-full resize-y rounded-(--radius-control) bg-control p-3 text-ink text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        )}
      </Field>

      <PaletteField palette={palette} onChange={setPalette} />

      <div className="flex items-center gap-3">
        <Button type="submit" tone="primary" pending={saving}>
          Save
        </Button>
        {notice ? (
          <p aria-live="polite" className="text-ink-muted text-sm">
            {notice}
          </p>
        ) : null}
      </div>
    </form>
  )
}
