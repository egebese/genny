import { publicUrlFor } from '@genny/assets/keys.ts'
import { env } from '@genny/env/env.ts'

/**
 * What we add to a job's stored output: the assets we ingested, so the gallery
 * reads urls from our own bucket rather than from fal, whose media expires after
 * about a week.
 */
export type IngestedOutput = {
  genny?: { assets?: { id: string; label: string; storageKey: string }[] }
}

export function ingestedUrls(output: unknown): string[] {
  return ingestedAssets(output).map((asset) => publicUrlFor(env().S3_PUBLIC_URL, asset.storageKey))
}

/** Handles of the ingested assets, so a past result stays mentionable. */
export function ingestedLabels(output: unknown): string[] {
  return ingestedAssets(output).map((asset) => asset.label)
}

function ingestedAssets(output: unknown) {
  return (output as IngestedOutput | null)?.genny?.assets ?? []
}
