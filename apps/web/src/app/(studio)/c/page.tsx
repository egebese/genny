import { canvasList } from '@/features/canvas/server/canvas-list.ts'
import { CanvasGrid } from '@/features/canvas/ui/canvas-grid.tsx'

export const dynamic = 'force-dynamic'

export default async function CanvasesPage() {
  return (
    <main>
      <CanvasGrid projects={await canvasList()} />
    </main>
  )
}
