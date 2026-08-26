import { Button } from '@genny/ui/button.tsx'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not here</h1>
      <p className="text-ink-muted">That page does not exist, or it is not yours to see.</p>
      <Link href="/image">
        <Button tone="primary">Go to the studio</Button>
      </Link>
    </main>
  )
}
