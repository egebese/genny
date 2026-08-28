import type { MediaKind } from '@genny/models/aspect.ts'

/** One dock over every modality, so it asks for whatever the chosen model makes. */
const PLACEHOLDERS: Record<MediaKind, string> = {
  image: 'Describe the image you want, or @mention an asset',
  video: 'Describe the shot you want, or @mention an image to animate',
  audio: 'Write what should be said, or describe the sound you want',
}

const DIRECTOR = 'Ask for what to shoot next, or what is wrong with these'

/**
 * A model that reads no prompt still has a box: the next model picked might
 * want one, and a dock that appears and disappears is worse than one that says
 * what it is for. An upscaler is handed a picture, not a sentence.
 */
const NOTHING_TO_TYPE = 'This model works from what you attach. Nothing to type.'

export function placeholderFor(
  directing: boolean,
  modality: MediaKind,
  promptField: string | null,
): string {
  if (directing) return DIRECTOR
  return promptField === null ? NOTHING_TO_TYPE : PLACEHOLDERS[modality]
}
