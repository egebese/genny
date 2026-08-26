import type { Database } from '@genny/db/client.ts'
import { sql } from 'drizzle-orm'

export type LedgerKind = 'grant' | 'topup' | 'capture' | 'refund' | 'expire'

/**
 * Money moves in two different ways here, and keeping them apart is what makes
 * the arithmetic checkable.
 *
 * **The ledger records net change.** Every row is a real gain or loss: a grant, a
 * top-up, a capture at the price fal actually charged, an expiry. Append-only, and
 * `genny_app` holds no UPDATE or DELETE on it by grant.
 *
 * **A hold is not a net change.** It moves credits from spendable to reserved and
 * back, so it writes no ledger row: `credit_balance` alone tracks it, and the job
 * row remembers how much was held for it. A released hold that never became a
 * capture changed nothing, and the ledger says nothing, which is correct.
 *
 * The invariant that follows, asserted in the tests:
 *
 *     sum(ledger.delta) = balance + hold_balance
 */
export type HoldResult =
  | { ok: true; balance: string; holdBalance: string }
  | { ok: false; reason: 'insufficient'; balance: string; shortfall: string }

/**
 * Reserves credits for a job. One conditional UPDATE, so concurrent submits
 * serialize on the row lock: one wins and the other gets a clean refusal instead
 * of a negative balance.
 */
export async function holdCredits(
  tx: Database,
  ownerId: string,
  amount: string,
): Promise<HoldResult> {
  assertPositive(amount)

  const rows = await tx.execute<{ balance: string; hold_balance: string }>(sql`
    update credit_balance
       set balance = balance - ${amount}::numeric,
           hold_balance = hold_balance + ${amount}::numeric,
           updated_at = now()
     where owner_id = ${ownerId}
       and balance >= ${amount}::numeric
    returning balance, hold_balance
  `)

  const row = rows[0]
  if (row) return { ok: true, balance: row.balance, holdBalance: row.hold_balance }

  const current = await readBalance(tx, ownerId)
  return {
    ok: false,
    reason: 'insufficient',
    balance: current.balance,
    shortfall: subtract(amount, current.balance),
  }
}

/**
 * Settles a hold at what the generation actually cost. The unused part of the
 * hold returns to spendable, and only the spent part reaches the ledger.
 *
 * Idempotent on `idempotencyKey`: a replayed webhook or a retried completion
 * finds the row already there and changes nothing.
 */
export async function captureHold(
  tx: Database,
  input: { ownerId: string; held: string; actual: string; jobId: string; idempotencyKey: string },
): Promise<{ applied: boolean }> {
  assertPositive(input.held)
  if (Number(input.actual) < 0) throw new Error('actual cost cannot be negative')

  const inserted = await tx.execute<{ id: string }>(sql`
    insert into credit_ledger (owner_id, delta, kind, job_id, idempotency_key, note)
    values (${input.ownerId}, ${`-${input.actual}`}::numeric, 'capture', ${input.jobId},
            ${input.idempotencyKey}, 'generation')
    on conflict (idempotency_key) do nothing
    returning id
  `)
  if (inserted.length === 0) return { applied: false }

  const unused = subtract(input.held, input.actual)
  await tx.execute(sql`
    update credit_balance
       set hold_balance = hold_balance - ${input.held}::numeric,
           balance = balance + ${unused}::numeric,
           updated_at = now()
     where owner_id = ${input.ownerId}
  `)
  return { applied: true }
}

/**
 * Returns a hold in full, for a generation that never happened. Writes no ledger
 * row, because nothing was gained or lost; the job row is where "this was held
 * and given back" is recorded.
 */
export async function releaseHold(
  tx: Database,
  ownerId: string,
  amount: string,
): Promise<{ applied: boolean }> {
  assertPositive(amount)
  const rows = await tx.execute<{ owner_id: string }>(sql`
    update credit_balance
       set hold_balance = hold_balance - ${amount}::numeric,
           balance = balance + ${amount}::numeric,
           updated_at = now()
     where owner_id = ${ownerId}
       and hold_balance >= ${amount}::numeric
    returning owner_id
  `)
  return { applied: rows.length > 0 }
}

/** A grant, a top-up or an expiry: anything that changes what the actor owns. */
export async function recordChange(
  tx: Database,
  input: {
    ownerId: string
    delta: string
    kind: Exclude<LedgerKind, 'capture'>
    idempotencyKey: string
    note?: string
  },
): Promise<{ applied: boolean }> {
  const inserted = await tx.execute<{ id: string }>(sql`
    insert into credit_ledger (owner_id, delta, kind, idempotency_key, note)
    values (${input.ownerId}, ${input.delta}::numeric, ${input.kind}, ${input.idempotencyKey},
            ${input.note ?? null})
    on conflict (idempotency_key) do nothing
    returning id
  `)
  if (inserted.length === 0) return { applied: false }

  await tx.execute(sql`
    insert into credit_balance (owner_id, balance)
    values (${input.ownerId}, ${input.delta}::numeric)
    on conflict (owner_id) do update
      set balance = credit_balance.balance + ${input.delta}::numeric,
          updated_at = now()
  `)
  return { applied: true }
}

export async function readBalance(
  tx: Database,
  ownerId: string,
): Promise<{ balance: string; holdBalance: string }> {
  const rows = await tx.execute<{ balance: string; hold_balance: string }>(
    sql`select balance, hold_balance from credit_balance where owner_id = ${ownerId}`,
  )
  const row = rows[0]
  return { balance: row?.balance ?? '0', holdBalance: row?.hold_balance ?? '0' }
}

function assertPositive(amount: string): void {
  if (!(Number(amount) > 0)) throw new Error(`amount must be positive, got ${amount}`)
}

/** Numeric strings throughout: credits are money and money is not a float. */
function subtract(a: string, b: string): string {
  return (Number(a) - Number(b)).toFixed(4)
}
