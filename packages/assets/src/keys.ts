import { randomUUID } from 'node:crypto'

/**
 * Storage keys are owner-scoped and opaque. Owner-scoped so a bucket listing is
 * partitioned the same way the database is; opaque so a key never leaks a prompt,
 * a filename, or the order in which things were made.
 */
export function buildStorageKey(ownerId: string, extension: string): string {
  return `u/${ownerId}/${randomUUID()}.${extension}`
}

/** True when the key belongs to this owner. Checked before ever signing a read. */
export function keyBelongsTo(ownerId: string, key: string): boolean {
  return key.startsWith(`u/${ownerId}/`) && !key.includes('..')
}

export function publicUrlFor(publicBase: string, key: string): string {
  return `${publicBase.replace(/\/$/, '')}/${key}`
}
