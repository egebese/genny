import type { MediaKind } from './aspect.ts'
import type { ModelDefinition } from './schema.ts'

export type PromptReference = {
  /** The mention exactly as typed, including the @. */
  token: string
  /** Human label without the @, used when the model reads names as subject cues. */
  label: string
  /** Resolved, publicly fetchable url of the asset. */
  url: string
  /** What it is. A slot that takes stills has nowhere to put a clip. */
  kind: MediaKind
}

/** Reference slots the model insists on that the prompt did not fill. */
export function missingRequiredReferences(
  model: ModelDefinition,
  references: PromptReference[],
): string[] {
  if (references.length > 0) return []
  return model.references.filter((mapping) => mapping.required).map((mapping) => mapping.field)
}

export type ResolvedPrompt = {
  /** Prompt text after mention tokens have been rewritten or removed. */
  text: string
  /** Fields to merge into the model payload. */
  patch: Record<string, unknown>
  /** References the model cannot accept. Surfaced to the user, never silent. */
  dropped: PromptReference[]
}

/**
 * Turns "@ayse in @room1" plus its resolved assets into a payload the endpoint
 * actually accepts. Every model declares its own mapping, so this function is
 * the only place that has to understand the difference between `image_url` and
 * `image_urls`, and adding a model never touches the prompt component.
 */
export function resolvePrompt(
  model: ModelDefinition,
  text: string,
  references: PromptReference[],
): ResolvedPrompt {
  const patch: Record<string, unknown> = {}
  const dropped: PromptReference[] = []
  let remaining = [...references]
  let out = text

  for (const mapping of model.references) {
    /*
     * Only what this slot will take. Assigning by declaration order alone put
     * a clip's url into `image_url` on any model that declared one first, and
     * the endpoint answered 422 with a reason nobody could see. The slot says
     * what it accepts; that is what it is for.
     */
    const fits = remaining.filter((reference) => mapping.accepts.includes(reference.kind))
    const taken = fits.slice(0, mapping.maxCount)
    remaining = remaining.filter((reference) => !taken.includes(reference))
    if (taken.length === 0) continue

    patch[mapping.field] = mapping.array ? taken.map((r) => r.url) : taken[0]?.url
    for (const reference of taken) {
      out = rewriteToken(out, reference, mapping.token)
    }
  }

  // A model with no reference slots, or one already full, cannot use what is
  // left. Dropping it quietly would produce a generation that ignores half the
  // user's input for no visible reason.
  dropped.push(...remaining)
  for (const reference of remaining) {
    out = rewriteToken(out, reference, 'strip')
  }

  return { text: normalizeSpacing(out), patch, dropped }
}

function rewriteToken(
  text: string,
  reference: PromptReference,
  mode: 'strip' | 'keep-label',
): string {
  const replacement = mode === 'keep-label' ? reference.label : ''
  return text.split(reference.token).join(replacement)
}

function normalizeSpacing(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .trim()
}
