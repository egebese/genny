'use client'

import { readableSettings } from '@genny/models/readable.ts'
import type { ModelInput } from '@genny/models/schema.ts'
import { CopyButton } from '@genny/ui/copy-button.tsx'
import type { ReactNode } from 'react'
import type { JobDetail } from '../server/job-detail.ts'

type JobFactsProps = {
  detail: JobDetail
  markUrl: string | null
  /** The model's own controls, so the payload can be read under their names. */
  inputs: readonly ModelInput[]
  promptField: string
  /** Credits are a saas idea; in byok the visitor spends their own fal balance. */
  showCost: boolean
}

/**
 * What this generation was, for the person who made it.
 *
 * It used to print the payload as the payload: `num_images 1`, `output_format
 * png`, the prompt a second time under the prompt, and then four rows of uuids
 * and a `charged 0.0000`. All of that is true and almost none of it is what
 * someone opening a result wants to know.
 *
 * The ids are not gone, they are behind the copy button in the footer. They are
 * the only currency of a support conversation and they are worth exactly nothing
 * to read.
 */
export function JobFacts({ detail, markUrl, inputs, promptField, showCost }: JobFactsProps) {
  const settings = readableSettings(detail.settings, inputs, promptField)

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

      {/* No copy here, and no endpoint id under the name. The id is in the
          diagnostics button, where a thing nobody reads belongs. */}
      <Section label="Model">
        <p className="flex items-center gap-2 text-ink">
          {markUrl ? <img src={markUrl} alt="" className="size-4 shrink-0" /> : null}
          {detail.modelName}
        </p>
      </Section>

      {settings.length > 0 ? (
        <Section label="Settings" copy={JSON.stringify(detail.settings, null, 2)}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {settings.map((setting) => (
              <div key={setting.label} className="contents">
                <dt className="text-ink-faint">{setting.label}</dt>
                <dd className="truncate text-ink" title={setting.value}>
                  {setting.value}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      <Section label="Made">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <Fact term="When" value={when(detail.createdAt)} />
          <Fact term="Took" value={took(detail.createdAt, detail.finishedAt)} />
          {showCost ? <Fact term="Cost" value={cost(detail)} /> : null}
          {/* The one number worth reading and reusing: it is what keeps a face
              the same from one shot to the next. */}
          <Fact term="Seed" value={detail.seed === null ? null : String(detail.seed)} />
        </dl>
      </Section>
    </div>
  )
}

function when(iso: string): string {
  const made = new Date(iso)
  const today = new Date().toDateString() === made.toDateString()
  const time = made.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return today ? `Today ${time}` : `${made.toLocaleDateString()} ${time}`
}

function took(from: string, to: string | null): string | null {
  if (!to) return null
  const seconds = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/** Held until the outputs are counted, so before that the charge is a promise. */
function cost({ creditsCharged, creditsHeld }: JobDetail): string | null {
  const settled = creditsCharged !== null
  const amount = Number(creditsCharged ?? creditsHeld ?? '0')
  if (!Number.isFinite(amount) || amount <= 0) return null
  return `${Math.round(amount)} credits${settled ? '' : ' held'}`
}

/**
 * A heading, its content, and a way to copy it that stays out of the way.
 *
 * The copy control appears on hover or focus. Five sections meant five copy
 * buttons visible at once on a panel whose whole job is showing evidence, and
 * they read louder than the evidence did.
 */
function Section(props: { label: string; copy?: string; children: ReactNode }) {
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
            className="opacity-0 focus-visible:opacity-100 group-focus-within/section:opacity-100 group-hover/section:opacity-100"
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
      <dd className="truncate text-ink" title={value}>
        {value}
      </dd>
    </div>
  )
}
