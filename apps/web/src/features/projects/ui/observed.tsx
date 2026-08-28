import Link from 'next/link'
import type { ProjectView } from '../server/project-page.ts'

/**
 * What the boards turned out to be about.
 *
 * Shown next to the brief rather than merged into it. The brief is the owner's
 * sentence and this is an observation read back from forty prompts; a system
 * that quietly rewrites the first with the second is one nobody can correct.
 * Copying a line across is a decision, so it is left as one.
 */
export function Observed({ observed }: { observed: ProjectView['observed'] }) {
  if (observed.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-medium text-ink">What the work says</h2>
      <p className="mb-4 text-ink-faint text-sm">
        Read back from the prompts on each board every ten results, and from which results were
        reached for again. Nobody wrote this; it is what the boards look like from outside.
      </p>

      <ul className="space-y-4">
        {observed.map((one) => (
          <li key={one.canvasId} className="rounded-(--radius-panel) border border-line p-4">
            <Link
              href={`/c/${one.canvasId}`}
              className="rounded-(--radius-control) font-mono text-[10px] text-ink-faint uppercase tracking-wider outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
            >
              {one.title}
            </Link>
            <p className="mt-1 text-ink text-sm">{one.facts.summary}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Facet label="Subjects" items={one.facts.subjects} />
              <Facet label="Prefers" items={one.facts.preferences} />
              <Facet label="Avoids" items={one.facts.avoid} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Facet({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h3 className="mb-1 font-mono text-[10px] text-ink-faint uppercase tracking-wider">
        {label}
      </h3>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item} className="text-ink-muted text-xs">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
