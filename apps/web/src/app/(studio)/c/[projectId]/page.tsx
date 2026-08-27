import { notFound } from 'next/navigation'
import { projectPage } from '@/features/canvas/server/project-page.ts'
import { Canvas } from '@/features/canvas/ui/canvas.tsx'

export const dynamic = 'force-dynamic'

export default async function CanvasPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const page = await projectPage(projectId)
  // RLS already scoped the read, so a miss means "not yours or not real". Both
  // answer 404: telling them apart tells a stranger what exists.
  if (!page) notFound()

  return (
    <main className="relative flex h-full min-h-0 flex-col justify-end overflow-hidden">
      <h1 className="sr-only">{page.title}</h1>
      <Canvas {...page} />
    </main>
  )
}
