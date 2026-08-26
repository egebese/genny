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
  const ingested = (output as IngestedOutput | null)?.genny?.assets
  if (!ingested || ingested.length === 0) return []
  return ingested.map((asset) => publicUrlFor(env().S3_PUBLIC_URL, asset.storageKey))
}
