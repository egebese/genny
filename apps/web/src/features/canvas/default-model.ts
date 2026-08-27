import type { PickableModel } from './model-list.ts'

/**
 * A board starts with a still: an image model, whichever is featured.
 *
 * Merging the three studios made this a real decision. Picking the first
 * featured model of any modality meant a text to speech endpoint was the
 * default, so the first prompt someone typed got read aloud.
 */
export function defaultModel(models: PickableModel[]): PickableModel {
  const images = models.filter((candidate) => candidate.modality === 'image')
  return (images.find((candidate) => candidate.featured) ?? images[0] ?? models[0]) as PickableModel
}
