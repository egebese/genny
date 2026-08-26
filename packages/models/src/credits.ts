import type { ModelDefinition } from './schema.ts'

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
  model: ModelDefinition,
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
export function estimateUnits(model: ModelDefinition, input: Record<string, unknown>): number {
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
      return positiveNumber(input.duration ?? input.duration_seconds, 5) * count
    case 'minutes':
      return positiveNumber(input.duration, 60) / 60
  }
}

/** A missing or nonsensical value bills as the model's default, never as zero. */
function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** fal's named sizes, in pixels. Kept here so pricing does not guess. */
const IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  square: { width: 512, height: 512 },
  square_hd: { width: 1024, height: 1024 },
  portrait_4_3: { width: 768, height: 1024 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1024, height: 576 },
}

function resolveImageSize(name: string): { width: number; height: number } {
  return IMAGE_SIZES[name] ?? { width: 1024, height: 1024 }
}
