import { resolveImageSize } from './aspect.ts'
import { secondsOf } from './duration.ts'
import type { ModelDefinition } from './schema.ts'

/** Everything the estimate needs. Keeps the browser from importing the catalog. */
export type PricedModel = Pick<ModelDefinition, 'pricing'>

/** The same, plus the margin. Only what we charge for needs that; a unit count
 * does not, and asking every caller of `estimateUnits` for it would be asking
 * the wrong question. */
export type ChargedModel = PricedModel & Pick<ModelDefinition, 'creditMultiplier'>

export type UsageEstimate = {
  /** Number of billed units: images produced, seconds of video, megapixels. */
  units: number
}

/**
 * Credits are integers. Rounding up means we never sell a fraction of a cent at
 * a loss, and it makes the number shown next to the generate button match the
 * number actually taken.
 */
export function creditsFor(
  model: ChargedModel,
  usage: UsageEstimate,
  creditPerUsd: number,
): number {
  if (usage.units <= 0) throw new Error('usage.units must be positive')
  const usd = model.pricing.unitPriceUsd * usage.units * model.creditMultiplier
  return Math.ceil(usd * creditPerUsd)
}

/** Megapixel-billed models need the requested size, not the image count. */
export function megapixelsFor(width: number, height: number, count: number): number {
  return ((width * height) / 1_000_000) * count
}

/**
 * What to hold before submitting. Video length and megapixel size are known up
 * front, so the estimate is usually exact; where it is not, the capture step
 * settles the difference against real usage.
 */
export function estimateUnits(model: PricedModel, input: Record<string, unknown>): number {
  return baseUnits(model, input) * rateFactor(model, input) + surchargeUnits(model, input)
}

/**
 * The multiplier for the setting that bills differently, or 1.
 *
 * Applied to the units rather than to the price so the whole calculation stays
 * one number: what gets held, what gets captured and what the button says are
 * all this, and they cannot drift apart if there is only one of them.
 */
function rateFactor(model: PricedModel, input: Record<string, unknown>): number {
  let factor = 1
  for (const rate of model.pricing.scale ?? []) {
    const chosen = input[rate.field]
    // Compared as text: an option can be a number now, and `4` and `"4"` are
    // the same choice to the person who picked it.
    if (chosen === undefined || chosen === null) continue
    if (!rate.and) {
      factor *= rate.factors[String(chosen)] ?? 1
      continue
    }
    const second = input[rate.and]
    if (second === undefined || second === null) continue
    factor *= rate.factors[`${String(chosen)}|${String(second)}`] ?? 1
  }
  return factor
}

/**
 * Flat fees, expressed as extra units so the whole calculation stays one
 * number. A web search on Nano Banana Pro is $0.015 on a $0.15 image, which is
 * a tenth of a unit however many images come back.
 */
function surchargeUnits(model: PricedModel, input: Record<string, unknown>): number {
  const price = model.pricing.unitPriceUsd
  if (price <= 0) return 0
  let extra = 0
  for (const fee of model.pricing.surcharges ?? []) {
    const chosen = input[fee.field]
    if (fee.when.some((value) => String(value) === String(chosen))) extra += fee.addUsd / price
  }
  return extra
}

function baseUnits(model: PricedModel, input: Record<string, unknown>): number {
  const count = positiveNumber(input.num_images, 1)

  switch (model.pricing.unit) {
    case 'images':
    case 'requests':
      return count
    case 'megapixels': {
      const size = resolveImageSize(String(input.image_size ?? 'landscape_4_3'))
      return megapixelsFor(size.width, size.height, count)
    }
    case 'seconds':
      return secondsOf(model.pricing, input) * count
    case 'minutes':
      return (secondsOf(model.pricing, input) / 60) * count
    case 'characters':
      // Exact rather than estimated: the text being read is the text we hold for.
      return Math.max(1, String(input.text ?? input.prompt ?? '').length)
  }
}

/**
 * A missing or nonsensical value bills as the model's default, never as zero.
 *
 * `parseFloat`, not `Number`: fal endpoints spell durations `5`, `"5"` and
 * `"8s"`, and the last one makes `Number` return NaN. That failure is silent and
 * permanent, because the estimate becomes the hold and `settle` never captures
 * more than it held: an eight second clip would be charged as five, forever.
 */
function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Just enough of an input to know what it is called and what it defaults to. */
type Defaulted = { name: string; default?: unknown }

/**
 * What the server will price, built from what the dock is holding.
 *
 * The dock keeps its settings as a delta: it starts empty and records only what
 * somebody changed, because the catalog's defaults are applied on the way in by
 * `buildInputSchema`. An estimate over the delta therefore prices a request
 * nobody is making. Ideogram bills double at its own default rendering speed,
 * so a form nobody touched quoted half of what it took.
 *
 * The prompt is merged under the model's own field name for the same reason: it
 * is injected server-side rather than carried in settings, and a model billed
 * per character was quoting for one character until it was sent.
 */
export function effectiveInput(
  model: { inputs: readonly Defaulted[]; promptField: string | null },
  settings: Record<string, unknown>,
  prompt: string,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const input of model.inputs) {
    if (input.default !== undefined) defaults[input.name] = input.default
  }
  // An upscaler names no prompt field, and has nothing to be priced by one.
  const typed = model.promptField ? { [model.promptField]: prompt } : {}
  return { ...defaults, ...settings, ...typed }
}
