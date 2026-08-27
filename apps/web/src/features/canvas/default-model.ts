import type { PickableFamily } from './family-list.ts'

/**
 * A board starts with a still: an image model, whichever is featured.
 *
 * Merging the three studios made this a real decision. Picking the first
 * featured model of any modality meant a text to speech endpoint was the
 * default, so the first prompt someone typed got read aloud.
 */
export function defaultFamily(models: PickableFamily[]): PickableFamily {
  const images = models.filter((candidate) => candidate.modality === 'image')
  return (images.find((candidate) => candidate.variants.some((v) => v.featured)) ??
    images[0] ??
    models[0]) as PickableFamily
}
