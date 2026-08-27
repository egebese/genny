import { Button } from '@genny/ui/button.tsx'
import { Topbar } from '@genny/ui/topbar.tsx'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <Topbar
        brand={<span>genny</span>}
        actions={
          <Link href="/c">
            <Button tone="primary" size="sm">
              Open studio
            </Button>
          </Link>
        }
      />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Generate images, video and audio with your own fal key.
        </h1>
        <p className="text-lg text-ink-muted">
          One studio over the whole fal catalog. Bring your own key and it costs you nothing but the
          inference, or self-host it with credits and billing for your own users.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/c">
            <Button tone="primary">Start generating</Button>
          </Link>
          <Link href="https://github.com/egebese/genny">
            <Button tone="neutral">View source</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
