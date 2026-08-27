import { projectList } from '@/features/canvas/server/project-list.ts'
import { ProjectGrid } from '@/features/canvas/ui/project-grid.tsx'

export const dynamic = 'force-dynamic'

export default async function CanvasesPage() {
  return (
    <main>
      <ProjectGrid projects={await projectList()} />
    </main>
  )
}
