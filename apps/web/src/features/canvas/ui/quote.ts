import { creditsFor, effectiveInput, estimateUnits } from '@genny/models/credits.ts'
import type { PickableModel } from '../model-list.ts'

/**
 * What this run would cost against what is left, in credits.
 *
 * The same three functions the Generate button prices with and the same ones
 * the server holds with, rather than a fourth copy of the arithmetic: the last
 * time this sum was written twice, one copy left out `creditMultiplier` and
 * every model sold above cost quoted a fifth less than it charged.
 *
 * Null in byok. There is nothing of ours to run out of there, because the
 * visitor is spending their own fal balance.
 */
export function quoteAgainstBalance(
  model: PickableModel | null,
  settings: Record<string, unknown>,
  prompt: string,
  credits: { enabled: boolean; perUsd: number; balance: number } | null,
): { credits: number; balance: number } | null {
  if (!model || !credits?.enabled) return null
  const units = estimateUnits(model, effectiveInput(model, settings, prompt))
  return {
    credits: Number(creditsFor(model, { units }, credits.perUsd)),
    balance: credits.balance,
  }
}
