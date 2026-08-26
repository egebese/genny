import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ownerPolicy } from '../rls.ts'
import { users } from './auth.ts'

export const ledgerKind = pgEnum('ledger_kind', [
  'grant',
  'topup',
  'hold',
  'capture',
  'refund',
  'expire',
])

/**
 * Append-only. Nothing in this table is ever updated or deleted; a mistake is
 * corrected by writing its inverse. A single integer balance cannot answer "why
 * is this number what it is", and that question always gets asked eventually.
 *
 * `idempotencyKey` is what makes a replayed Stripe webhook or a retried job
 * submit a no-op instead of a double charge.
 */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Signed. Positive adds spendable credit, negative removes it. */
    delta: numeric('delta', { precision: 14, scale: 4 }).notNull(),
    kind: ledgerKind('kind').notNull(),
    jobId: uuid('job_id'),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_ledger_owner_created').on(t.ownerId, t.createdAt.desc()),
    ownerPolicy('credit_ledger'),
  ],
).enableRLS()

/**
 * Cached projection of the ledger, and the row every spend serializes on. A hold
 * is one conditional UPDATE: concurrent requests queue on the row lock and the
 * loser gets a clean "insufficient credits" instead of a negative balance.
 *
 * Invariant, asserted in the integration tests:
 *   sum(ledger.delta) = balance + holdBalance
 */
export const creditBalance = pgTable(
  'credit_balance',
  {
    ownerId: uuid('owner_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    balance: numeric('balance', { precision: 14, scale: 4 }).notNull().default('0'),
    holdBalance: numeric('hold_balance', { precision: 14, scale: 4 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [ownerPolicy('credit_balance')],
).enableRLS()
