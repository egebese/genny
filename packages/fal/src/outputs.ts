/**
 * Every modality nests its media differently: `images[].url`, `video.url`,
 * `audio.url`, sometimes a bare `output`. Walking the payload for anything
 * url-shaped means a new endpoint works without a parser per output shape.
 */
export function collectMediaUrls(payload: unknown, depth = 0): string[] {
  if (depth > 6) return []
  if (Array.isArray(payload)) return payload.flatMap((item) => collectMediaUrls(item, depth + 1))
  if (payload && typeof payload === 'object') {
    return Object.entries(payload).flatMap(([key, value]) =>
      key === 'url' && typeof value === 'string' && isMediaUrl(value)
        ? [value]
        : collectMediaUrls(value, depth + 1),
    )
  }
  return []
}

/**
 * Only https, and never a .json: fal includes schema and metadata links in some
 * payloads, and ingesting those as media produces broken gallery cards.
 */
function isMediaUrl(value: string): boolean {
  return value.startsWith('https://') && !value.endsWith('.json')
}
