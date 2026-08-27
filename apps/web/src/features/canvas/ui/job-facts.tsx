'use client'

import { CopyButton } from '@genny/ui/copy-button.tsx'
import type { JobDetail } from '../server/job-detail.ts'

/**
 * The part of the panel that is pure evidence: what was asked for, what was
 * sent, what it cost, and the two ids a support conversation is impossible
 * without. Every one of them copyable, because retyping a uuid off a screen is
 * how the wrong uuid ends up in the ticket.
 */
export function JobFacts(props: { detail: JobDetail; markUrl: string | null }) {
  const { detail } = props
  const settings = JSON.stringify(detail.settings, null, 2)

  return (
    <div className="flex flex-col gap-3 text-sm">
      <Section label="Prompt" copy={detail.prompt}>
        <p className="whitespace-pre-wrap break-words text-ink">{detail.prompt}</p>
      </Section>

      {detail.references.length > 0 ? (
        <Section label="References">
          <ul aria-label="References used" className="flex flex-wrap gap-1">
            {detail.references.map((reference) => (
              <li
                key={reference.id}
                className="rounded-(--radius-control) bg-control px-2 py-0.5 font-mono text-ink-muted text-xs"
              >
                {reference.token}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section label="Model" copy={detail.endpointId}>
        <p className="flex items-center gap-2 text-ink">
          {props.markUrl ? <img src={props.markUrl} alt="" className="size-4 shrink-0" /> : null}
          {detail.modelName}
        </p>
        <p className="break-all font-mono text-ink-faint text-xs">{detail.endpointId}</p>
      </Section>

      <Section label="Settings" copy={settings}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
          {Object.entries(detail.settings).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-ink-faint">{key}</dt>
              <dd className="truncate text-ink-muted" title={String(value)}>
                {format(value)}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section label="Job" copy={detail.jobId}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
          <Fact term="job" value={detail.jobId} />
          <Fact term="fal" value={detail.falRequestId} />
          <Fact term="seed" value={detail.seed === null ? null : String(detail.seed)} />
          <Fact term="charged" value={detail.creditsCharged ?? detail.creditsHeld} />
          <Fact term="started" value={new Date(detail.createdAt).toLocaleString()} />
        </dl>
      </Section>
    </div>
  )
}

/**
 * A heading, its content, and a way to copy it that stays out of the way.
 *
 * The copy control appears on hover or focus. Five sections meant five copy
 * buttons visible at once on a panel whose whole job is showing evidence, and
 * they read louder than the evidence did.
 */
function Section(props: { label: string; copy?: string; children: React.ReactNode }) {
  return (
    <section className="group/section flex flex-col gap-1">
      <div className="flex h-6 items-center justify-between gap-2">
        <h3 className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
          {props.label}
        </h3>
        {props.copy ? (
          <CopyButton
            value={props.copy}
            label={props.label}
            className="opacity-0 focus-visible:opacity-100 group-hover/section:opacity-100 group-focus-within/section:opacity-100"
          />
        ) : null}
      </div>
      {props.children}
    </section>
  )
}

function Fact({ term, value }: { term: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="contents">
      <dt className="text-ink-faint">{term}</dt>
      <dd className="truncate text-ink-muted" title={value}>
        {value}
      </dd>
    </div>
  )
}

function format(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
