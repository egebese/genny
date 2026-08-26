import { createFalClient } from '@fal-ai/client'
import type { FalCredentials } from './credentials.ts'
import { classifyFalError } from './errors.ts'

/**
 * Hands a reference image to fal and returns a url fal can fetch.
 *
 * This exists because a reference url has to be reachable *by fal*, not by the
 * browser. Our own bucket is often not: in development it is localhost, and in
 * production it may be a private bucket. Uploading sidesteps both.
 *
 * ponytail: uploads on every generation. Cache the returned url on the asset row
 * (fal keeps it about a week) when the repeated upload shows up in latency.
 */
export async function uploadReference(
  credentials: FalCredentials,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  try {
    const client = createFalClient({ credentials: credentials.key })
    // Buffer copy keeps Blob happy about the exact byte range.
    return await client.storage.upload(new Blob([bytes.slice()], { type: mime }))
  } catch (error) {
    throw classifyFalError(error)
  }
}
