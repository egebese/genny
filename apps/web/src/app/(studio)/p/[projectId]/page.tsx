import { notFound } from 'next/navigation'
import { listAssetsFor } from '@/features/assets/server/list.ts'
import { CanvasCard } from '@/features/canvas/ui/canvas-card.tsx'
import { projectView } from '@/features/projects/server/project-page.ts'
import { BrandKitEditor } from '@/features/projects/ui/brand-kit-editor.tsx'
import { ProjectSettings } from '@/features/projects/ui/project-settings.tsx'
import { readActorId } from '@/features/session/actor.ts'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await projectView(projectId)
  // RLS already scoped the read, so a miss means "not yours or not real". Both
  // answer 404: telling them apart tells a stranger what exists.
  if (!project) notFound()

  const actorId = await readActorId()
  const library = actorId ? await listAssetsFor(actorId, { limit: 24, kind: 'image' }) : []

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 truncate font-semibold text-2xl tracking-tight">{project.title}</h1>

      <ProjectSettings project={project} />

      <BrandKitEditor project={project} library={library} />

      <section className="mt-10">
        <h2 className="mb-3 font-medium text-ink">Canvases</h2>
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
    </main>
  )
}
