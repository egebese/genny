'use client'

import Link from 'next/link'
import type { PickableFamily } from '../family-list.ts'
import type { DockBlock } from './dock-block.ts'

export function DockNotice(props: { block: DockBlock; family: PickableFamily }) {
  if (!props.block) return null

  if (props.block.kind === 'needs-setting') {
    return (
      <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
        {props.family.name} will not run without{' '}
        <span className="text-ink">{props.block.label.toLowerCase()}</span>. Set it below.
      </p>
    )
  }

  if (props.block.kind === 'needs-credits') {
    return (
      <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
        This run needs <span className="text-ink">{props.block.short.toLocaleString()}</span> more
        credits than you have.{' '}
        <Link href="/billing" className="text-accent underline underline-offset-2">
          Buy credits
        </Link>
      </p>
    )
  }

  if (props.block.kind === 'needs-reference') {
    return (
      <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
        {props.family.name} works from an image. Mention one with{' '}
        <span className="font-mono">@</span> or attach one to say which.
      </p>
    )
  }

  return (
    <p className="border-line border-t px-4 py-2 text-ink-muted text-sm">
      {props.family.name} has no way to take that.{' '}
      {props.family.accepts.length > 0
        ? `It works from ${props.family.accepts.join(' or ')}.`
        : 'It writes from text alone.'}
    </p>
  )
}
