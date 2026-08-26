import type { Database } from '@genny/db/client.ts'
import { sql } from 'drizzle-orm'
import type { LedgerKind } from './ledger.ts'

/**
 * Reads over the ledger for the account page. Nothing here writes, and nothing
 * here is on the generation path, so these are the only billing queries allowed
 * to be shaped for a human rather than for a transaction.
 */
export type LedgerEntry = {
  delta: string
  kind: LedgerKind
  note: string | null
  jobId: string | null
  createdAt: Date
}

type LedgerRow = Omit<LedgerEntry, 'createdAt'> & { createdAt: string | Date }

/**
 * The actor's own history, newest first. What a usage page is made of.
 *
 * The timestamp is rebuilt rather than trusted: a raw template goes through the
 * driver unparsed, so `created_at` arrives as a string however the column is
 * typed, and annotating it as a Date only moves the failure to the first caller
 * that treats it as one.
 */
export async function listLedger(
  tx: Database,
  ownerId: string,
  limit: number,
): Promise<LedgerEntry[]> {
  const rows = await tx.execute<LedgerRow>(sql`
    select delta, kind, note, job_id as "jobId", created_at as "createdAt"
      from credit_ledger
     where owner_id = ${ownerId}
     order by created_at desc
     limit ${Math.min(limit, 200)}
  `)
  return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }))
}

/**
 * Credits spent since a moment, as a positive number. Captures only.
 *
 * The timestamp goes over as an ISO string with an explicit cast: this driver
 * will not bind a Date into a raw template, and the failure is a runtime type
 * error rather than a compile one.
 */
export async function spentSince(
  tx: Database,
  ownerId: string,
  since: Date,
): Promise<{ credits: string; generations: number }> {
  const rows = await tx.execute<{ credits: string; generations: string }>(sql`
    select coalesce(-sum(delta), 0)::text as credits, count(*)::text as generations
      from credit_ledger
     where owner_id = ${ownerId} and kind = 'capture' and created_at >= ${since.toISOString()}::timestamptz
  `)
  const row = rows[0]
  return { credits: row?.credits ?? '0', generations: Number(row?.generations ?? '0') }
}
