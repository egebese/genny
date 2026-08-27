'use client'

import { estimateUnits } from '@genny/models/credits.ts'
import { Button } from '@genny/ui/button.tsx'
import { useMemo } from 'react'
import type { PickableModel } from '../model-list.ts'

/** Sub-cent prices are the common case, so two decimals would read as free. */
function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3).replace(/0$/, '')}`
  return `$${usd.toFixed(4)}`
}

/**
 * The one control that spends money, with the price on it.
 *
 * Priced on the client because the estimate is pure arithmetic over the catalog
 * entry, so it can update as the settings change without a round trip. The
 * server quotes again before it holds anything; this number is for the decision,
 * not for the ledger.
 */
export function GenerateButton(props: {
  model: PickableModel
  settings: Record<string, unknown>
  /** Credits when saas mode is on, dollars otherwise: the same number, priced. */
  credits: { enabled: boolean; perUsd: number } | null
  pending: boolean
  disabled: boolean
  onClick: () => void
}) {
  const cost = useMemo(
    () => estimateUnits(props.model, props.settings) * props.model.pricing.unitPriceUsd,
    [props.model, props.settings],
  )
  const priced = props.credits?.enabled
    ? `${Math.ceil(cost * props.credits.perUsd)} cr`
    : formatCost(cost)

  return (
    <Button
      type="button"
      tone="primary"
      size="md"
      className="shrink-0 px-4"
      disabled={props.disabled || props.pending}
      onClick={props.onClick}
    >
      <span>{props.pending ? 'Sending' : 'Generate'}</span>
      {/*
       * A fixed slot for the number, not a fixed button. `$0.0024` and `$0.10`
       * are four characters apart, so the button changed width as you dragged
       * the quality slider and the thing you were about to press moved out from
       * under the pointer. Reserving the widest ordinary price holds it still
       * without padding the word out to nothing.
       */}
      {props.pending ? null : (
        <span className="min-w-[4.25rem] text-right tabular-nums opacity-80">{priced}</span>
      )}
    </Button>
  )
}
