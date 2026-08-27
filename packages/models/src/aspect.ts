export type Size = { width: number; height: number }

/** fal's named sizes, in pixels. One table, so pricing and layout never disagree. */
export const IMAGE_SIZES: Record<string, Size> = {
  square: { width: 512, height: 512 },
  square_hd: { width: 1024, height: 1024 },
  portrait_4_3: { width: 768, height: 1024 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1024, height: 576 },
}

export function resolveImageSize(name: string): Size {
  return IMAGE_SIZES[name] ?? { width: 1024, height: 1024 }
}

/** Accepts `16:9` and `16x9`, which different endpoints spell differently. */
function parseRatio(value: unknown): Size | null {
  const match = /^(\d+)\s*[:x]\s*(\d+)$/.exec(String(value ?? ''))
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? { width, height } : null
}

/** A waveform reads as a strip, and nothing about it is square. */
const AUDIO_ASPECT: Size = { width: 4, height: 1 }

/**
 * The shape the output will have, as a ratio, read from the settings about to be
 * submitted.
 *
 * Known before anything is generated, which is the point: a placeholder in the
 * wrong shape reflows the board the moment the real thing lands, and it lands
 * while the person is looking somewhere else on the canvas.
 */
export function outputAspect(
  modality: 'image' | 'video' | 'audio',
  settings: Record<string, unknown>,
): Size {
  if (modality === 'audio') return AUDIO_ASPECT

  const size = settings.image_size
  if (typeof size === 'string' && IMAGE_SIZES[size]) return IMAGE_SIZES[size]
  if (size && typeof size === 'object') {
    const { width, height } = size as Partial<Size>
    if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
      return { width, height }
    }
  }

  const ratio = parseRatio(settings.aspect_ratio) ?? parseRatio(settings.ratio)
  if (ratio) return ratio

  // Video without a stated ratio is landscape far more often than not; an image
  // without one is whatever the endpoint defaults to, and square is the safest
  // guess for a placeholder that has to be some shape.
  return modality === 'video' ? { width: 16, height: 9 } : { width: 1, height: 1 }
}
